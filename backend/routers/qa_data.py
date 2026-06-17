from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Optional
from database import get_db
import models
from datetime import datetime
import logging

logger = logging.getLogger("qa.case_history")

router = APIRouter(prefix="/api/qa", tags=["qa"])

# 변경 이력을 추적할 케이스 필드 목록
_TRACKED_FIELDS = {"name", "method", "endpoint", "expectedStatus", "catId", "type", "headers", "queryParams", "body"}


class QASaveRequest(BaseModel):
    data: Any  # HTML의 db 객체 전체


@router.get("/{project_id}/data")
def load_qa_data(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    snap = (
        db.query(models.QASnapshot)
        .filter(models.QASnapshot.project_id == project_id)
        .order_by(models.QASnapshot.updated_at.desc())
        .first()
    )
    if not snap:
        return {"data": None}
    return {"data": snap.data}


@router.post("/{project_id}/data")
def save_qa_data(project_id: int, body: QASaveRequest, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    snap = (
        db.query(models.QASnapshot)
        .filter(models.QASnapshot.project_id == project_id)
        .first()
    )

    # ★ 덮어쓰기 전에 old_cases 추출
    old_cases = (snap.data or {}).get("mgr", {}).get("cases", []) if snap else []
    new_cases = (body.data or {}).get("mgr", {}).get("cases", [])

    logger.info("[case_history] project=%d old=%d new=%d", project_id, len(old_cases), len(new_cases))

    if snap:
        snap.data = body.data
    else:
        snap = models.QASnapshot(project_id=project_id, data=body.data)
        db.add(snap)

    _record_case_history(project_id, old_cases, new_cases, db)

    # 배포결과서 데이터가 있으면 deploy_histories에도 저장
    _sync_deploy_history(project_id, body.data, db)

    db.commit()
    return {"ok": True}


@router.get("/{project_id}/case-history")
def get_case_history(
    project_id: int,
    case_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """케이스 변경 이력 조회. case_id 지정 시 해당 케이스만 반환"""
    q = (
        db.query(models.CaseHistory)
        .filter(models.CaseHistory.project_id == project_id)
    )
    if case_id:
        q = q.filter(models.CaseHistory.case_id == case_id)
    histories = q.order_by(models.CaseHistory.changed_at.desc()).limit(limit).all()
    return [
        {
            "id": h.id,
            "case_id": h.case_id,
            "action": h.action,
            "before": h.before,
            "after": h.after,
            "changed_at": h.changed_at.isoformat() if h.changed_at else None,
        }
        for h in histories
    ]


def _record_case_history(project_id: int, old_cases: list, new_cases: list, db: Session):
    """이전 mgr.cases와 새 mgr.cases를 비교해 생성/수정/삭제 이력 저장"""
    try:
        old_map = {c["id"]: c for c in old_cases if c.get("id")}
        new_map = {c["id"]: c for c in new_cases if c.get("id")}

        created, updated, deleted = [], [], []

        for cid, case in new_map.items():
            if cid not in old_map:
                created.append(cid)
                db.add(models.CaseHistory(project_id=project_id, case_id=cid,
                                          action="created", before=None, after=case))

        for cid, new_case in new_map.items():
            if cid not in old_map:
                continue
            old_case = old_map[cid]
            changed = any(old_case.get(f) != new_case.get(f) for f in _TRACKED_FIELDS)
            if changed:
                updated.append(cid)
                db.add(models.CaseHistory(project_id=project_id, case_id=cid,
                                          action="updated", before=old_case, after=new_case))

        for cid, case in old_map.items():
            if cid not in new_map:
                deleted.append(cid)
                db.add(models.CaseHistory(project_id=project_id, case_id=cid,
                                          action="deleted", before=case, after=None))

        logger.info(
            "[case_history] project=%d created=%s updated=%s deleted=%s",
            project_id, created, updated, deleted,
        )
    except Exception as e:
        logger.error("[case_history] project=%d 이력 저장 실패: %s", project_id, e, exc_info=True)


def _sync_deploy_history(project_id: int, data: Any, db: Session):
    try:
        dep = data.get("dep", {})
        cover = dep.get("cover", {})
        cases = dep.get("cases", [])
        mgr_cases = data.get("mgr", {}).get("cases", [])

        if not cover.get("version"):
            return

        done = sum(1 for c in cases if c.get("pf") == "완료")
        fail = sum(1 for c in cases if c.get("pf") == "미완료")

        deployed_at = None
        raw_end = cover.get("end")
        if raw_end:
            try:
                deployed_at = datetime.fromisoformat(raw_end.replace("T", " "))
            except Exception:
                pass

        existing = (
            db.query(models.DeployHistory)
            .filter(
                models.DeployHistory.project_id == project_id,
                models.DeployHistory.version == cover.get("version"),
                models.DeployHistory.environment == cover.get("environment"),
            )
            .first()
        )
        if existing:
            existing.summary = cover.get("summary", "")
            existing.total_cases = len(cases)
            existing.done_cases = done
            existing.fail_cases = fail
            existing.deployed_at = deployed_at
        else:
            hist = models.DeployHistory(
                project_id=project_id,
                version=cover.get("version", ""),
                environment=cover.get("environment", ""),
                deploy_type=cover.get("deployType", ""),
                deployer=cover.get("deployer", ""),
                target_server=cover.get("target", ""),
                summary=cover.get("summary", ""),
                total_cases=len(cases),
                done_cases=done,
                fail_cases=fail,
                deployed_at=deployed_at,
            )
            db.add(hist)
    except Exception:
        pass  # 배포 이력 저장 실패해도 메인 저장은 유지
