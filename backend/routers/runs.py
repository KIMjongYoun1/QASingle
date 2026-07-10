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
import base64
from urllib.parse import urlencode
import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
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

# 프로젝트별 스냅샷 read-modify-write를 직렬화하는 락 (병렬 케이스 실행 시 lost update 방지)
_project_snapshot_locks: dict[int, threading.Lock] = {}
_project_snapshot_locks_guard = threading.Lock()


def _get_project_snapshot_lock(project_id: int) -> threading.Lock:
    with _project_snapshot_locks_guard:
        if project_id not in _project_snapshot_locks:
            _project_snapshot_locks[project_id] = threading.Lock()
        return _project_snapshot_locks[project_id]


class RunCreateRequest(BaseModel):
    project_id: int
    base_url: str
    default_headers: Optional[dict[str, str]] = None
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
            step_cases = [
                {**case_map[s["case_id"]], "extract_path": s.get("extract_path"), "extract_var": s.get("extract_var")}
                for s in sorted_steps if s["case_id"] in case_map and case_map[s["case_id"]].get("endpoint")
            ]
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

    _run_executor.submit(_execute_run, run.id, req.project_id, req.base_url, req.default_headers or {}, individual, flows_data)
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


def _get_json_path(obj, path: str):
    """점 표기법으로 JSON 경로 탐색 (예: "data.success", "items.0.id")"""
    if not path:
        return obj
    current = obj
    for part in path.split('.'):
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list) and part.isdigit():
            current = current[int(part)]
        else:
            return None
    return current


def _eval_assertion(a: dict, resp) -> dict:
    """단일 assertion 평가. 결과 dict 반환"""
    target = a.get('target', 'status_code')
    operator = a.get('operator', 'eq')
    expected = str(a.get('value') or '')
    path = a.get('path') or ''

    try:
        if target == 'status_code':
            actual_val = str(resp.status_code)
        elif target == 'body_json':
            actual_val = _get_json_path(resp.json(), path)
            actual_val = str(actual_val) if actual_val is not None else 'null'
        elif target == 'body_text':
            actual_val = resp.text
        elif target == 'header':
            actual_val = resp.headers.get(path, '')
        else:
            actual_val = ''

        if operator == 'eq':
            passed = actual_val == expected
        elif operator == 'contains':
            passed = expected in str(actual_val)
        elif operator == 'not_contains':
            passed = expected not in str(actual_val)
        elif operator == 'exists':
            passed = actual_val not in (None, 'null', '')
        elif operator == 'not_exists':
            passed = actual_val in (None, 'null', '')
        elif operator == 'gt':
            passed = float(actual_val) > float(expected)
        elif operator == 'lt':
            passed = float(actual_val) < float(expected)
        else:
            passed = False
    except Exception as e:
        actual_val = f'평가 오류: {e}'
        passed = False

    return {'target': target, 'path': path, 'operator': operator, 'expected': expected, 'actual': str(actual_val), 'passed': passed}


def _substitute_vars(text: str, variables: dict) -> str:
    """{{변수명}} 패턴을 플로우 변수 저장소 값으로 치환 (포스트맨 {{var}} 문법과 동일)"""
    if not text or not variables:
        return text
    def repl(m):
        key = m.group(1).strip()
        return str(variables[key]) if key in variables else m.group(0)
    return re.sub(r"\{\{\s*([^}]+?)\s*\}\}", repl, text)


def _extract_json_path(data, path: str):
    """단순 JSON path 파서: 'a.b[0].c' 형태 지원"""
    current = data
    tokens = re.findall(r"[^.\[\]]+|\[\d+\]", path)
    for tok in tokens:
        if tok.startswith("["):
            idx = int(tok[1:-1])
            current = current[idx]
        else:
            current = current[tok]
    return current


# ── 암복호화 (AES-256-GCM, ApiEndpointTest의 CryptoUtil.java와 호환) ────────────

def _aes_gcm_encrypt_embedded(plain_text: str, key_b64: str) -> str:
    """바디 전체 암호화: IV(12바이트)를 암호문 앞에 붙여 Base64 하나로 반환"""
    key = base64.b64decode(key_b64)
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, plain_text.encode("utf-8"), None)
    return base64.b64encode(iv + ct).decode("utf-8")


def _aes_gcm_decrypt_embedded(b64_payload: str, key_b64: str) -> str:
    key = base64.b64decode(key_b64)
    raw = base64.b64decode(b64_payload)
    iv, ct = raw[:12], raw[12:]
    return AESGCM(key).decrypt(iv, ct, None).decode("utf-8")


def _aes_gcm_encrypt_external_iv(plain_text: str, key_b64: str, iv: bytes) -> str:
    """파라미터 단위 암호화: 공유 IV로 암호문만 반환 (IV 미포함)"""
    key = base64.b64decode(key_b64)
    ct = AESGCM(key).encrypt(iv, plain_text.encode("utf-8"), None)
    return base64.b64encode(ct).decode("utf-8")


class _DecryptedResponse:
    """복호화된 내용을 assertion/추출 로직이 그대로 쓸 수 있게 httpx.Response처럼 감싼 래퍼"""
    def __init__(self, status_code: int, decrypted_text: str, headers):
        self.status_code = status_code
        self.text = decrypted_text
        self.headers = headers

    def json(self):
        return json.loads(self.text)


def _make_request(client: httpx.Client, case: dict, base_url: str, variables: dict | None = None) -> tuple[bool, str, str, dict]:
    """httpx로 단일 케이스 실행. (passed, actual_text, notes, extracted_vars) 반환"""
    variables = variables or {}
    method = (case.get("method") or "GET").upper()
    endpoint = re.sub(r"\{[^}]+\}", "1", _substitute_vars(case["endpoint"], variables))
    expected_status = case.get("expectedStatus") or 200

    case_headers = {h["key"]: _substitute_vars(h["value"], variables) for h in (case.get("headers") or []) if h.get("key")}
    query_params = {q["key"]: _substitute_vars(q["value"], variables) for q in (case.get("queryParams") or []) if q.get("key")}
    body_str = _substitute_vars(case.get("body") or "", variables)
    body_data = None
    if body_str:
        try:
            body_data = json.loads(body_str)
        except Exception:
            body_data = body_str

    # 암호화 호출 — 케이스에 저장된 키로 이번 요청 전용 IV를 즉석에서 생성해 암호화
    # (IV는 저장하지 않고 요청마다 새로 만듦, 엔드포인트는 /secure 접두어 사용)
    if case.get("encrypted") and case.get("encryptionKeyBase64"):
        key_b64 = case["encryptionKeyBase64"]
        scope = case.get("encryptionScope") or "body"
        endpoint = "/secure" + endpoint
        if scope == "param" and isinstance(body_data, dict):
            encrypted_keys = set(case.get("encryptedFieldKeys") or [])
            iv = os.urandom(12)
            case_headers["X-IV"] = base64.b64encode(iv).decode("utf-8")
            new_body = {}
            for k, v in body_data.items():
                if k in encrypted_keys:
                    new_body[f"{k}_enc"] = _aes_gcm_encrypt_external_iv(json.dumps(v, ensure_ascii=False), key_b64, iv)
                else:
                    new_body[k] = v
            body_data = new_body
        else:
            plain_json = json.dumps(body_data if body_data is not None else {}, ensure_ascii=False)
            body_data = {"encData": _aes_gcm_encrypt_embedded(plain_json, key_b64)}

    # 케이스별 baseUrl이 있으면 우선 사용, 없으면 전역 base_url fallback
    effective_base = (case.get("baseUrl") or base_url).rstrip("/")
    full_url = f"{effective_base}{endpoint}"

    qs = f"?{urlencode(query_params)}" if query_params else ""
    request_line = f"{method} {full_url}{qs}"

    try:
        kwargs: dict = {"params": query_params, "headers": case_headers}
        if body_data is not None and method in ("POST", "PUT", "PATCH"):
            kwargs["json"] = body_data if isinstance(body_data, dict) else None
            if not isinstance(body_data, dict):
                kwargs["content"] = str(body_data)
        resp = client.request(method, full_url, **kwargs)

        status_ok = resp.status_code == expected_status
        body_snippet = resp.text[:500]

        # 암호화 호출이면 응답의 encData를 복호화해서, 이후 로직은 복호화된 내용을 보게 함
        eval_resp = resp
        decrypted_note = ""
        if case.get("encrypted") and case.get("encryptionKeyBase64"):
            try:
                raw_json = resp.json()
                enc_data = (raw_json.get("data") or {}).get("encData")
                if enc_data:
                    plain_text = _aes_gcm_decrypt_embedded(enc_data, case["encryptionKeyBase64"])
                    eval_resp = _DecryptedResponse(resp.status_code, plain_text, resp.headers)
                    decrypted_note = f"\n[Response Decrypted] {plain_text[:500]}"
            except Exception as e:
                decrypted_note = f"\n[Response Decrypt Error] {str(e)}"

        # assertion 평가
        assertions = case.get('assertions') or []
        assertion_results = [_eval_assertion(a, eval_resp) for a in assertions]

        if assertion_results:
            passed = status_ok and all(r['passed'] for r in assertion_results)
            pass_count = sum(1 for r in assertion_results if r['passed'])
            total_count = len(assertion_results)
            status_icon = '✓' if status_ok else '✗'
            if pass_count == total_count:
                actual_text = f"{status_icon} {resp.status_code} | 모든 조건 통과 ({total_count}개)"
            else:
                actual_text = f"✗ {resp.status_code} | {pass_count}/{total_count} 조건 통과"
        else:
            passed = status_ok
            actual_text = f"{resp.status_code} 응답"

        # notes 구성
        op_labels = {'eq': '=', 'contains': '포함', 'not_contains': '미포함', 'exists': '존재', 'not_exists': '미존재', 'gt': '>', 'lt': '<'}
        target_labels = {'status_code': '상태코드', 'body_text': '바디 텍스트'}
        notes_lines = [f"[Request] {request_line}"]
        if case_headers:
            notes_lines.append(f"[Request Headers] {json.dumps(case_headers, ensure_ascii=False)}")
        if body_data is not None:
            notes_lines.append(f"[Request Body] {json.dumps(body_data, ensure_ascii=False) if isinstance(body_data, (dict, list)) else body_data}")
        notes_lines.append(f"[Response {resp.status_code}] {body_snippet}")
        if decrypted_note:
            notes_lines.append(decrypted_note.lstrip("\n"))
        if assertion_results:
            notes_lines.append('[Assertions]')
            for r in assertion_results:
                icon = '✓' if r['passed'] else '✗'
                t_label = target_labels.get(r['target']) or (f"body.{r['path']}" if r['target'] == 'body_json' else f"헤더[{r['path']}]")
                op_label = op_labels.get(r['operator'], r['operator'])
                if r['operator'] in ('exists', 'not_exists'):
                    notes_lines.append(f"  {icon} {t_label} {op_label} → 실제: {r['actual']}")
                else:
                    notes_lines.append(f"  {icon} {t_label} {op_label} '{r['expected']}' → 실제: {r['actual']}")
        notes = '\n'.join(notes_lines)

        # 응답값 추출 (플로우 스텝에 extract_path/extract_var가 설정된 경우)
        extracted: dict = {}
        extract_var = case.get("extract_var")
        extract_path = case.get("extract_path")
        if passed and extract_var and extract_path:
            try:
                value = _extract_json_path(eval_resp.json(), extract_path)
                extracted[extract_var] = value
                notes += f"\n[Extract] {extract_path} → {{{{{extract_var}}}}} = {value}"
            except Exception as e:
                passed = False
                actual_text = f"응답값 추출 실패: {extract_path} ({str(e)})"
                notes += f"\n[Extract Error] {extract_path}: {str(e)}"

    except Exception as e:
        passed = False
        actual_text = f"요청 실패: {str(e)}"
        notes_lines = [f"[Request] {request_line}"]
        if case_headers:
            notes_lines.append(f"[Request Headers] {json.dumps(case_headers, ensure_ascii=False)}")
        if body_data is not None:
            notes_lines.append(f"[Request Body] {json.dumps(body_data, ensure_ascii=False) if isinstance(body_data, (dict, list)) else body_data}")
        notes_lines.append(f"[Error] {str(e)}")
        notes = '\n'.join(notes_lines)
        extracted = {}

    return passed, actual_text, notes, extracted


def _run_individual_case(case: dict, base_url: str, default_headers: dict,
                         project_id: int, run_id: int, lock: threading.Lock):
    """개별 케이스 병렬 실행 워커"""
    with httpx.Client(base_url=base_url.rstrip("/"), headers=default_headers, timeout=30) as client:
        passed, actual_text, notes, _ = _make_request(client, case, base_url)

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


def _execute_run(run_id: int, project_id: int, base_url: str, default_headers: dict,
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
                    pool.submit(_run_individual_case, case, base_url, default_headers, project_id, run_id, lock): case
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
            with httpx.Client(base_url=base_url.rstrip("/"), headers=default_headers, timeout=30) as client:
                for flow in flows:
                    flow_result = {
                        "flow_id": flow["flow_id"],
                        "flow_name": flow["flow_name"],
                        "status": "running",
                        "steps": [],
                    }
                    stopped = False
                    flow_vars: dict = {}
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

                        passed, actual_text, notes, extracted = _make_request(client, case, base_url, flow_vars)
                        flow_vars.update(extracted)
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

        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        project_name = project.name if project else f"Project #{project_id}"

        # 케이스 이름 조회용 맵 (mgr_snapshot 활용)
        snapshot = run.mgr_snapshot or []
        case_name_map = {c["id"]: c.get("name", c["id"]) for c in snapshot}

        # 실패 케이스 목록
        case_results = run.case_results or []
        failed_cases = [
            {"id": r["case_id"], "name": case_name_map.get(r["case_id"], r["case_id"])}
            for r in case_results if r.get("pf") == "Fail"
        ]

        # 플로우 결과 요약
        flow_results = run.flow_results or []

        payload = {
            "run_id": run.id,
            "label": run.label,
            "total": run.total,
            "fail": run.fail,
            "error": error,
            "project_name": project_name,
            "base_url": run.base_url,
            "failed_cases": failed_cases,
            "flow_results": flow_results,
            "case_results": run.case_results or [],
            "mgr_snapshot": run.mgr_snapshot or [],
        }
        notification_service.dispatch(
            [{"id": c.id, "type": c.type, "webhook_url": c.webhook_url,
              "enabled": c.enabled, "events": c.events or [],
              "attach_excel": bool(c.attach_excel)} for c in configs],
            event,
            payload,
        )
    except Exception as e:
        logger.error("[notification] 전송 실패: %s", e, exc_info=True)


def _update_case_result(db: Session, project_id: int, case_id: str, actual_text: str,
                        passed: bool, now_str: str, notes: str = ""):
    # 같은 프로젝트의 스냅샷을 여러 스레드가 동시에 read-modify-write 하면 나중에 쓴 쪽이
    # 앞의 결과를 덮어쓰는 lost update가 발생하므로, 프로젝트 단위로 직렬화한다.
    with _get_project_snapshot_lock(project_id):
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
