from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
from services.notification import notification_service, NotifyEvent

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationConfigCreate(BaseModel):
    project_id: int
    name: str
    type: str           # "discord" | "slack"
    webhook_url: str
    enabled: bool = True
    events: list[str] = ["run_completed", "run_failed"]
    attach_excel: bool = False


class NotificationConfigUpdate(BaseModel):
    name: Optional[str] = None
    webhook_url: Optional[str] = None
    enabled: Optional[bool] = None
    events: Optional[list[str]] = None
    attach_excel: Optional[bool] = None


def _serialize(cfg: models.NotificationConfig) -> dict:
    return {
        "id": cfg.id,
        "project_id": cfg.project_id,
        "name": cfg.name,
        "type": cfg.type,
        "webhook_url": cfg.webhook_url,
        "enabled": cfg.enabled,
        "events": cfg.events or [],
        "attach_excel": bool(cfg.attach_excel),
        "created_at": cfg.created_at.isoformat() if cfg.created_at else None,
    }


@router.get("")
def list_configs(project_id: int, db: Session = Depends(get_db)):
    configs = (
        db.query(models.NotificationConfig)
        .filter(models.NotificationConfig.project_id == project_id)
        .order_by(models.NotificationConfig.id)
        .all()
    )
    return [_serialize(c) for c in configs]


@router.post("")
def create_config(body: NotificationConfigCreate, db: Session = Depends(get_db)):
    if body.type not in ("discord", "slack"):
        raise HTTPException(status_code=400, detail="type은 discord 또는 slack만 가능합니다")
    cfg = models.NotificationConfig(**body.model_dump())
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _serialize(cfg)


@router.patch("/{config_id}")
def update_config(config_id: int, body: NotificationConfigUpdate, db: Session = Depends(get_db)):
    cfg = db.query(models.NotificationConfig).filter(models.NotificationConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="알림 설정을 찾을 수 없습니다")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cfg, field, value)
    db.commit()
    return _serialize(cfg)


@router.delete("/{config_id}")
def delete_config(config_id: int, db: Session = Depends(get_db)):
    cfg = db.query(models.NotificationConfig).filter(models.NotificationConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="알림 설정을 찾을 수 없습니다")
    db.delete(cfg)
    db.commit()
    return {"ok": True}


@router.post("/{config_id}/test")
def test_config(config_id: int, db: Session = Depends(get_db)):
    """웹훅 테스트 전송"""
    cfg = db.query(models.NotificationConfig).filter(models.NotificationConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="알림 설정을 찾을 수 없습니다")
    try:
        notification_service.dispatch(
            [_serialize(cfg)],
            "run_completed",
            {"run_id": 0, "label": "테스트 알림", "total": 5, "fail": 0},
        )
        return {"ok": True, "message": "테스트 알림을 전송했습니다"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"전송 실패: {str(e)}")
