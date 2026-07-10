from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models

router = APIRouter(prefix="/api/presets", tags=["presets"])


class PresetCreate(BaseModel):
    project_id: int
    kind: str            # "header" | "url" | "param" | "path" | "body"
    label: str
    key: Optional[str] = None
    value: str
    category_id: Optional[str] = None  # 지정 시 케이스 편집 화면에서 이 카테고리 선택 시 자동 적용


class PresetUpdate(BaseModel):
    label: Optional[str] = None
    key: Optional[str] = None
    value: Optional[str] = None
    category_id: Optional[str] = None


def _serialize(p: models.ProjectPreset) -> dict:
    return {
        "id": p.id, "project_id": p.project_id, "kind": p.kind,
        "label": p.label, "key": p.key, "value": p.value,
        "category_id": p.category_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("")
def list_presets(project_id: int, db: Session = Depends(get_db)):
    presets = (
        db.query(models.ProjectPreset)
        .filter(models.ProjectPreset.project_id == project_id)
        .order_by(models.ProjectPreset.id)
        .all()
    )
    return [_serialize(p) for p in presets]


@router.post("")
def create_preset(body: PresetCreate, db: Session = Depends(get_db)):
    if body.kind not in ("header", "url", "param", "path", "body"):
        raise HTTPException(status_code=400, detail="kind는 header, url, param, path, body만 가능합니다")
    preset = models.ProjectPreset(**body.model_dump())
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return _serialize(preset)


@router.patch("/{preset_id}")
def update_preset(preset_id: int, body: PresetUpdate, db: Session = Depends(get_db)):
    preset = db.query(models.ProjectPreset).filter(models.ProjectPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="저장된 값을 찾을 수 없습니다")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(preset, field, value)
    db.commit()
    return _serialize(preset)


@router.delete("/{preset_id}")
def delete_preset(preset_id: int, db: Session = Depends(get_db)):
    preset = db.query(models.ProjectPreset).filter(models.ProjectPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="저장된 값을 찾을 수 없습니다")
    db.delete(preset)
    db.commit()
    return {"ok": True}
