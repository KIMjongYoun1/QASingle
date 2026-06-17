from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
import models

router = APIRouter(prefix="/api/flows", tags=["flows"])


class FlowStep(BaseModel):
    case_id: str
    order: int


class FlowCreateRequest(BaseModel):
    project_id: int
    name: str
    steps: list[FlowStep]


class FlowUpdateRequest(BaseModel):
    name: str
    steps: list[FlowStep]


@router.get("")
def list_flows(project_id: int, db: Session = Depends(get_db)):
    flows = db.query(models.TestFlow).filter(models.TestFlow.project_id == project_id).all()
    return [
        {"id": f.id, "name": f.name, "steps": f.steps, "created_at": f.created_at}
        for f in flows
    ]


@router.post("")
def create_flow(req: FlowCreateRequest, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == req.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    flow = models.TestFlow(
        project_id=req.project_id,
        name=req.name,
        steps=[{"case_id": s.case_id, "order": s.order} for s in req.steps],
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return {"id": flow.id, "name": flow.name, "steps": flow.steps}


@router.put("/{flow_id}")
def update_flow(flow_id: int, req: FlowUpdateRequest, db: Session = Depends(get_db)):
    flow = db.query(models.TestFlow).filter(models.TestFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="플로우를 찾을 수 없습니다")
    flow.name = req.name
    flow.steps = [{"case_id": s.case_id, "order": s.order} for s in req.steps]
    db.commit()
    db.refresh(flow)
    return {"id": flow.id, "name": flow.name, "steps": flow.steps}


@router.delete("/{flow_id}")
def delete_flow(flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(models.TestFlow).filter(models.TestFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="플로우를 찾을 수 없습니다")
    db.delete(flow)
    db.commit()
    return {"ok": True}
