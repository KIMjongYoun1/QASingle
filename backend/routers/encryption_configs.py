from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models

router = APIRouter(prefix="/api/encryption-configs", tags=["encryption-configs"])


class EncryptionConfigCreate(BaseModel):
    project_id: int
    label: str
    mode: str = "GCM"
    key_base64: str


class EncryptionConfigUpdate(BaseModel):
    label: Optional[str] = None
    mode: Optional[str] = None
    key_base64: Optional[str] = None


def _serialize(c: models.EncryptionConfig) -> dict:
    return {
        "id": c.id, "project_id": c.project_id, "label": c.label,
        "mode": c.mode, "key_base64": c.key_base64,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("")
def list_configs(project_id: int, db: Session = Depends(get_db)):
    configs = (
        db.query(models.EncryptionConfig)
        .filter(models.EncryptionConfig.project_id == project_id)
        .order_by(models.EncryptionConfig.id)
        .all()
    )
    return [_serialize(c) for c in configs]


@router.post("")
def create_config(body: EncryptionConfigCreate, db: Session = Depends(get_db)):
    if body.mode not in ("GCM", "CBC"):
        raise HTTPException(status_code=400, detail="mode는 GCM 또는 CBC만 가능합니다")
    config = models.EncryptionConfig(**body.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return _serialize(config)


@router.patch("/{config_id}")
def update_config(config_id: int, body: EncryptionConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(models.EncryptionConfig).filter(models.EncryptionConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="암호화 설정을 찾을 수 없습니다")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    db.commit()
    return _serialize(config)


@router.delete("/{config_id}")
def delete_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(models.EncryptionConfig).filter(models.EncryptionConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="암호화 설정을 찾을 수 없습니다")
    db.delete(config)
    db.commit()
    return {"ok": True}
