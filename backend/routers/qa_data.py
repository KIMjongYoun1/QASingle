from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any
from database import get_db
import models
from datetime import datetime

router = APIRouter(prefix="/api/qa", tags=["qa"])


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
    if snap:
        snap.data = body.data
    else:
        snap = models.QASnapshot(project_id=project_id, data=body.data)
        db.add(snap)

    # 배포결과서 데이터가 있으면 deploy_histories에도 저장
    _sync_deploy_history(project_id, body.data, db)

    db.commit()
    return {"ok": True}


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
