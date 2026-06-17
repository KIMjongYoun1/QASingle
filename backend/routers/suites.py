from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models

router = APIRouter(prefix="/api/suites", tags=["suites"])


class SuiteCreate(BaseModel):
    project_id: int
    name: str
    description: Optional[str] = None
    case_ids: list[str] = []
    flow_ids: list[int] = []
    is_default: bool = False


class SuiteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    case_ids: Optional[list[str]] = None
    flow_ids: Optional[list[int]] = None
    is_default: Optional[bool] = None


def _serialize(s: models.TestSuite) -> dict:
    return {
        "id": s.id,
        "project_id": s.project_id,
        "name": s.name,
        "description": s.description,
        "case_ids": s.case_ids or [],
        "flow_ids": s.flow_ids or [],
        "is_default": s.is_default,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("")
def list_suites(project_id: int, db: Session = Depends(get_db)):
    suites = (
        db.query(models.TestSuite)
        .filter(models.TestSuite.project_id == project_id)
        .order_by(models.TestSuite.id)
        .all()
    )
    return [_serialize(s) for s in suites]


@router.post("")
def create_suite(body: SuiteCreate, db: Session = Depends(get_db)):
    if body.is_default:
        # 같은 프로젝트의 기존 디폴트를 해제
        db.query(models.TestSuite).filter(
            models.TestSuite.project_id == body.project_id,
            models.TestSuite.is_default == True,
        ).update({"is_default": False})
    suite = models.TestSuite(**body.model_dump())
    db.add(suite)
    db.commit()
    db.refresh(suite)
    return _serialize(suite)


@router.get("/{suite_id}")
def get_suite(suite_id: int, db: Session = Depends(get_db)):
    s = db.query(models.TestSuite).filter(models.TestSuite.id == suite_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="스위트를 찾을 수 없습니다")
    return _serialize(s)


@router.patch("/{suite_id}")
def update_suite(suite_id: int, body: SuiteUpdate, db: Session = Depends(get_db)):
    s = db.query(models.TestSuite).filter(models.TestSuite.id == suite_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="스위트를 찾을 수 없습니다")
    data = body.model_dump(exclude_none=True)
    if data.get("is_default"):
        db.query(models.TestSuite).filter(
            models.TestSuite.project_id == s.project_id,
            models.TestSuite.id != suite_id,
            models.TestSuite.is_default == True,
        ).update({"is_default": False})
    for field, value in data.items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return _serialize(s)


@router.delete("/{suite_id}")
def delete_suite(suite_id: int, db: Session = Depends(get_db)):
    s = db.query(models.TestSuite).filter(models.TestSuite.id == suite_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="스위트를 찾을 수 없습니다")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.post("/{suite_id}/set-default")
def set_default(suite_id: int, db: Session = Depends(get_db)):
    s = db.query(models.TestSuite).filter(models.TestSuite.id == suite_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="스위트를 찾을 수 없습니다")
    db.query(models.TestSuite).filter(
        models.TestSuite.project_id == s.project_id,
        models.TestSuite.is_default == True,
    ).update({"is_default": False})
    s.is_default = True
    db.commit()
    return _serialize(s)
