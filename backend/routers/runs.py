from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import os
import re
import json
import copy
from urllib.parse import urlencode
import httpx
from database import get_db, SessionLocal
import models
from services.notification import notification_service
import logging

logger = logging.getLogger("qa.runs")

router = APIRouter(prefix="/api/runs", tags=["runs"])

# 동시에 실행 가능한 run 개수 제한
RUN_MAX_CONCURRENCY = int(os.getenv("RUN_MAX_CONCURRENCY", "3"))
# 개별 케이스 병렬 실행 시 최대 동시 요청 수
CASE_PARALLEL_WORKERS = int(os.getenv("CASE_PARALLEL_WORKERS", "10"))
_run_executor = ThreadPoolExecutor(max_workers=RUN_MAX_CONCURRENCY, thread_name_prefix="qa-run")


class RunCreateRequest(BaseModel):
    project_id: int
    base_url: str
    auth_header: Optional[str] = None
    case_ids: list[str] = []       # 순서 무관 개별 케이스 (병렬 실행)
    flow_ids: list[int] = []       # 순서 고정 플로우 (순차 실행, fail 시 해당 플로우 중단)


@router.post("")
def create_run(req: RunCreateRequest, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == req.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    snap = (
        db.query(models.QASnapshot)
        .filter(models.QASnapshot.project_id == req.project_id)
        .first()
    )
    if not snap:
        raise HTTPException(status_code=400, detail="저장된 QA 데이터가 없습니다")

    mgr_cases = snap.data.get("mgr", {}).get("cases", [])
    case_map = {c["id"]: c for c in mgr_cases}

    individual = [c for c in mgr_cases if c["id"] in req.case_ids and c.get("endpoint")]

    flows_data: list[dict] = []
    if req.flow_ids:
        db_flows = db.query(models.TestFlow).filter(models.TestFlow.id.in_(req.flow_ids)).all()
        flow_map = {f.id: f for f in db_flows}
        for fid in req.flow_ids:
            f = flow_map.get(fid)
            if not f:
                continue
            sorted_steps = sorted(f.steps, key=lambda s: s["order"])
            step_cases = [case_map[s["case_id"]] for s in sorted_steps if s["case_id"] in case_map and case_map[s["case_id"]].get("endpoint")]
            if step_cases:
                flows_data.append({"flow_id": f.id, "flow_name": f.name, "cases": step_cases})

    flow_case_count = sum(len(f["cases"]) for f in flows_data)
    total = len(individual) + flow_case_count

    if total == 0:
        raise HTTPException(status_code=400, detail="실행 가능한 케이스가 없습니다 (endpoint 정보 누락)")

    run = models.TestRun(
        project_id=req.project_id, base_url=req.base_url, status="pending", total=total,
        case_ids=[c["id"] for c in individual],
        flow_ids=[f["flow_id"] for f in flows_data],
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    _run_executor.submit(_execute_run, run.id, req.project_id, req.base_url, req.auth_header, individual, flows_data)
    return {"run_id": run.id, "total": total, "flow_count": len(flows_data)}


@router.get("")
def list_runs(project_id: int, db: Session = Depends(get_db)):
    """프로젝트의 실행 히스토리 목록 (최신순)"""
    runs = (
        db.query(models.TestRun)
        .filter(models.TestRun.project_id == project_id, models.TestRun.status.in_(["done", "failed"]))
        .order_by(models.TestRun.started_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": r.id, "status": r.status, "label": r.label,
            "base_url": r.base_url, "total": r.total, "done": r.done, "fail": r.fail,
            "case_ids": r.case_ids or [], "flow_ids": r.flow_ids or [],
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        }
        for r in runs
    ]


@router.get("/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(models.TestRun).filter(models.TestRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="실행 작업을 찾을 수 없습니다")
    return {
        "id": run.id, "status": run.status, "total": run.total, "done": run.done,
        "fail": run.fail, "error": run.error, "base_url": run.base_url,
        "label": run.label,
        "case_ids": run.case_ids or [],
        "flow_ids": run.flow_ids or [],
        "case_results": run.case_results or [],
        "flow_results": run.flow_results or [],
        "mgr_snapshot": run.mgr_snapshot or [],
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
    }


@router.patch("/{run_id}/label")
def update_run_label(run_id: int, payload: dict, db: Session = Depends(get_db)):
    """실행 레이블만 수정 가능 (결과 데이터는 불변)"""
    run = db.query(models.TestRun).filter(models.TestRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="실행 작업을 찾을 수 없습니다")
    run.label = payload.get("label", "")
    db.commit()
    return {"id": run.id, "label": run.label}


@router.get("/{run_id}/comments")
def list_comments(run_id: int, db: Session = Depends(get_db)):
    comments = (
        db.query(models.RunComment)
        .filter(models.RunComment.run_id == run_id)
        .order_by(models.RunComment.created_at)
        .all()
    )
    return [{"id": c.id, "text": c.text, "created_at": c.created_at.isoformat()} for c in comments]


@router.post("/{run_id}/comments")
def add_comment(run_id: int, payload: dict, db: Session = Depends(get_db)):
    run = db.query(models.TestRun).filter(models.TestRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="실행 작업을 찾을 수 없습니다")
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="댓글 내용을 입력하세요")
    comment = models.RunComment(run_id=run_id, text=text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {"id": comment.id, "text": comment.text, "created_at": comment.created_at.isoformat()}


def _make_request(client: httpx.Client, case: dict, base_url: str) -> tuple[bool, str, str]:
    """httpx로 단일 케이스 실행. (passed, actual_text, notes) 반환"""
    method = (case.get("method") or "GET").upper()
    endpoint = re.sub(r"\{[^}]+\}", "1", case["endpoint"])
    expected_status = case.get("expectedStatus") or 200

    case_headers = {h["key"]: h["value"] for h in (case.get("headers") or []) if h.get("key")}
    query_params = {q["key"]: q["value"] for q in (case.get("queryParams") or []) if q.get("key")}
    body_data = None
    if case.get("body"):
        try:
            body_data = json.loads(case["body"])
        except Exception:
            body_data = case["body"]

    qs = f"?{urlencode(query_params)}" if query_params else ""
    request_line = f"{method} {base_url.rstrip('/')}{endpoint}{qs}"

    try:
        kwargs: dict = {"params": query_params, "headers": case_headers}
        if body_data is not None and method in ("POST", "PUT", "PATCH"):
            kwargs["json"] = body_data if isinstance(body_data, dict) else None
            if not isinstance(body_data, dict):
                kwargs["content"] = str(body_data)
        resp = client.request(method, endpoint, **kwargs)
        passed = resp.status_code == expected_status
        actual_text = f"{resp.status_code} 응답"
        body_snippet = resp.text[:500]
        notes = f"[Request] {request_line}\n[Response {resp.status_code}] {body_snippet}"
    except Exception as e:
        passed = False
        actual_text = f"요청 실패: {str(e)}"
        notes = f"[Request] {request_line}\n[Error] {str(e)}"

    return passed, actual_text, notes


def _run_individual_case(case: dict, base_url: str, auth_header: Optional[str],
                         project_id: int, run_id: int, lock: threading.Lock):
    """개별 케이스 병렬 실행 워커"""
    headers = {"Authorization": auth_header} if auth_header else {}
    with httpx.Client(base_url=base_url.rstrip("/"), headers=headers, timeout=30) as client:
        passed, actual_text, notes = _make_request(client, case, base_url)

    now_str = datetime.now().strftime("%Y-%m-%dT%H:%M")
    db = SessionLocal()
    try:
        _update_case_result(db, project_id, case["id"], actual_text, passed, now_str, notes)
        with lock:
            run = db.query(models.TestRun).filter(models.TestRun.id == run_id).first()
            run.done += 1
            if not passed:
                run.fail += 1
            db.commit()
    finally:
        db.close()


def _execute_run(run_id: int, project_id: int, base_url: str, auth_header: Optional[str],
                 cases: list[dict], flows: list[dict] | None = None):
    db = SessionLocal()
    try:
        run = db.query(models.TestRun).filter(models.TestRun.id == run_id).first()
        run.status = "running"
        db.commit()
        db.close()

        lock = threading.Lock()

        # 개별 케이스: 병렬 실행
        if cases:
            with ThreadPoolExecutor(max_workers=CASE_PARALLEL_WORKERS) as pool:
                futures = {
                    pool.submit(_run_individual_case, case, base_url, auth_header, project_id, run_id, lock): case
                    for case in cases
                }
                for future in as_completed(futures):
                    try:
                        future.result()
                    except Exception as e:
                        logger.error("[run %d] 케이스 실행 오류: %s", run_id, e)

        # 플로우: 순차 실행 (fail 시 해당 플로우 즉시 중단)
        flow_results = []
        if flows:
            headers = {"Authorization": auth_header} if auth_header else {}
            with httpx.Client(base_url=base_url.rstrip("/"), headers=headers, timeout=30) as client:
                for flow in flows:
                    flow_result = {
                        "flow_id": flow["flow_id"],
                        "flow_name": flow["flow_name"],
                        "status": "running",
                        "steps": [],
                    }
                    stopped = False
                    for case in flow["cases"]:
                        now_str = datetime.now().strftime("%Y-%m-%dT%H:%M")
                        if stopped:
                            db2 = SessionLocal()
                            try:
                                _update_case_result(db2, project_id, case["id"],
                                                    "플로우 중단 - 이전 단계 실패로 건너뜀", False, now_str, "플로우 중단")
                                with lock:
                                    run2 = db2.query(models.TestRun).filter(models.TestRun.id == run_id).first()
                                    run2.done += 1
                                    run2.fail += 1
                                    db2.commit()
                            finally:
                                db2.close()
                            flow_result["steps"].append({"case_id": case["id"], "pf": "N/A", "skipped": True})
                            continue

                        passed, actual_text, notes = _make_request(client, case, base_url)
                        notes = f"[Flow: {flow['flow_name']}] {notes}"

                        db2 = SessionLocal()
                        try:
                            _update_case_result(db2, project_id, case["id"], actual_text, passed, now_str, notes)
                            with lock:
                                run2 = db2.query(models.TestRun).filter(models.TestRun.id == run_id).first()
                                run2.done += 1
                                if not passed:
                                    run2.fail += 1
                                    stopped = True
                                    flow_result["status"] = "stopped"
                                # 단계 완료 시 즉시 flow_results 저장 (프론트 실시간 폴링용)
                                flow_result["steps"].append({"case_id": case["id"], "pf": "Pass" if passed else "Fail", "skipped": False})
                                run2.flow_results = list(flow_results) + [flow_result]
                                db2.commit()
                        finally:
                            db2.close()

                    if not stopped:
                        flow_result["status"] = "done"
                    flow_results.append(flow_result)

        # 최종 결과 저장 (case_results 스냅샷 포함)
        db3 = SessionLocal()
        try:
            run3 = db3.query(models.TestRun).filter(models.TestRun.id == run_id).first()
            run3.status = "done"
            run3.flow_results = flow_results
            run3.finished_at = datetime.now(timezone.utc)

            # 실행된 케이스 결과를 run 레코드에 고정 저장 (히스토리 재현용, 이후 변경 불가)
            all_executed_ids = {c["id"] for c in cases}
            for f in (flows or []):
                all_executed_ids.update(c["id"] for c in f["cases"])
            snap3 = db3.query(models.QASnapshot).filter(models.QASnapshot.project_id == project_id).first()
            if snap3:
                tst_cases = snap3.data.get("tst", {}).get("cases", [])
                run3.case_results = [
                    {"case_id": c["id"], "pf": c.get("pf"), "actual": c.get("actual"), "notes": c.get("notes", "")}
                    for c in tst_cases if c.get("id") in all_executed_ids
                ]
                # 케이스 관리 스냅샷: 실행 시점의 케이스 내용 고정 저장
                mgr_cases = snap3.data.get("mgr", {}).get("cases", [])
                run3.mgr_snapshot = [
                    {"id": c["id"], "name": c.get("name", ""), "endpoint": c.get("endpoint", ""),
                     "method": c.get("method", ""), "catId": c.get("catId", "")}
                    for c in mgr_cases if c.get("id") in all_executed_ids
                ]
            db3.commit()

            # 알림 전송
            _dispatch_notification(project_id, run3, "run_completed", db3)
        finally:
            db3.close()

    except Exception as e:
        db4 = SessionLocal()
        try:
            run4 = db4.query(models.TestRun).filter(models.TestRun.id == run_id).first()
            if run4:
                run4.status = "failed"
                run4.error = str(e)
                db4.commit()
                _dispatch_notification(project_id, run4, "run_failed", db4, error=str(e))
        finally:
            db4.close()


def _dispatch_notification(project_id: int, run, event: str, db: Session, error: str = ""):
    logger.info("[notification] project=%d run=%d event=%s", project_id, run.id, event)
    try:
        configs = (
            db.query(models.NotificationConfig)
            .filter(models.NotificationConfig.project_id == project_id,
                    models.NotificationConfig.enabled == True)
            .all()
        )
        if not configs:
            return
        payload = {
            "run_id": run.id, "label": run.label,
            "total": run.total, "fail": run.fail, "error": error,
        }
        notification_service.dispatch(
            [{"id": c.id, "type": c.type, "webhook_url": c.webhook_url,
              "enabled": c.enabled, "events": c.events or []} for c in configs],
            event,
            payload,
        )
    except Exception as e:
        logger.error("[notification] 전송 실패: %s", e, exc_info=True)


def _update_case_result(db: Session, project_id: int, case_id: str, actual_text: str,
                        passed: bool, now_str: str, notes: str = ""):
    snap = db.query(models.QASnapshot).filter(models.QASnapshot.project_id == project_id).first()
    if not snap:
        return
    data = copy.deepcopy(snap.data)
    tst = data.get("tst", {"cover": {}, "cats": [], "cases": []})
    tst_cases = list(tst.get("cases", []))

    mgr_case = next((c for c in data.get("mgr", {}).get("cases", []) if c["id"] == case_id), None)
    cat_id = mgr_case.get("catId", "") if mgr_case else ""

    found = False
    for i, c in enumerate(tst_cases):
        if c["id"] == case_id:
            tst_cases[i] = {**c, "actual": actual_text, "pf": "Pass" if passed else "Fail",
                            "owner": "자동실행", "date": now_str, "notes": notes}
            found = True
            break
    if not found:
        tst_cases.append({
            "id": case_id, "catId": cat_id, "actual": actual_text,
            "pf": "Pass" if passed else "Fail",
            "owner": "자동실행", "date": now_str, "notes": notes, "evidence": [],
        })

    tst["cases"] = tst_cases
    data["tst"] = tst
    snap.data = data
    db.commit()
