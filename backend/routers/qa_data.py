from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Optional
from database import get_db
import models
from datetime import datetime
import copy
import time
import random
import string
import logging

logger = logging.getLogger("qa.case_history")

router = APIRouter(prefix="/api/qa", tags=["qa"])

_TRACKED_FIELDS = {"name", "method", "endpoint", "expectedStatus", "catId", "type", "headers", "queryParams", "body"}
_CATCOLS = ['#4f8cff', '#7c3aed', '#16a34a', '#dc2626', '#d97706', '#0891b2', '#be185d', '#0ea5e9']


# ── Pydantic 스키마 ──────────────────────────────────────────────────────────

class QASaveRequest(BaseModel):
    data: Any


class ImportCasesRequest(BaseModel):
    cases: list[dict]
    category_names: list[str]


class ReorderCasesRequest(BaseModel):
    case_ids: list[str]


class RestoreSectionRequest(BaseModel):
    mode: str  # "tst" | "dep"
    cover: Optional[dict] = None
    cases: list[dict]   # [{id, actual, pf, owner, date, notes}]
    cat_names: Optional[dict] = None  # {case_id: cat_name}


# ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

def _sync_cases(data: dict) -> dict:
    """mgr.cases 기준으로 tst.cases · dep.cases · cats 를 서버에서 동기화.
    프론트 syncCases() 로직의 단일 정보 출처(Source of Truth) 역할."""
    data = copy.deepcopy(data)
    mgr = data.get("mgr", {})
    mgr_cases = mgr.get("cases", [])
    mgr_cats  = mgr.get("cats", [])
    mgr_ids   = {c["id"] for c in mgr_cases if c.get("id")}

    for mode, default_pf in (("tst", "N/A"), ("dep", "미완료")):
        section  = data.get(mode, {})
        existing = {c["id"]: c for c in section.get("cases", []) if c.get("id")}

        synced = []
        for mc in mgr_cases:
            cid = mc.get("id")
            if not cid:
                continue
            if cid in existing:
                ec = existing[cid]
                synced.append({**ec, "catId": mc.get("catId", ec.get("catId", ""))})
            else:
                if mode == "tst":
                    synced.append({"id": cid, "catId": mc.get("catId", ""),
                                   "actual": mc.get("actual", ""), "pf": mc.get("pf", default_pf),
                                   "owner": mc.get("owner", ""), "date": mc.get("date", ""),
                                   "notes": "", "evidence": []})
                else:
                    synced.append({"id": cid, "catId": mc.get("catId", ""),
                                   "actual": "", "pf": default_pf,
                                   "owner": "", "date": "", "notes": "", "evidence": []})

        section["cases"] = [c for c in synced if c["id"] in mgr_ids]
        section["cats"]  = mgr_cats
        data[mode] = section

    return data


def _get_snap(project_id: int, db: Session) -> models.QASnapshot:
    snap = db.query(models.QASnapshot).filter(models.QASnapshot.project_id == project_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="저장된 QA 데이터가 없습니다")
    return snap


def _rand_id() -> str:
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))


# ── 엔드포인트 ───────────────────────────────────────────────────────────────

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

    snap = db.query(models.QASnapshot).filter(models.QASnapshot.project_id == project_id).first()

    old_cases = (snap.data or {}).get("mgr", {}).get("cases", []) if snap else []

    # 서버에서 tst/dep 동기화 후 저장 (정합성 보장)
    synced = _sync_cases(body.data or {})

    logger.info("[case_history] project=%d old=%d new=%d",
                project_id, len(old_cases), len(synced.get("mgr", {}).get("cases", [])))

    if snap:
        snap.data = synced
    else:
        snap = models.QASnapshot(project_id=project_id, data=synced)
        db.add(snap)

    _record_case_history(project_id, old_cases, synced.get("mgr", {}).get("cases", []), db)
    _sync_deploy_history(project_id, synced, db)

    db.commit()
    return {"ok": True, "data": synced}


@router.post("/{project_id}/import-cases")
def import_cases(project_id: int, body: ImportCasesRequest, db: Session = Depends(get_db)):
    """OpenAPI / Excel 파싱 결과를 서버에서 머지.
    카테고리 생성·ID 중복 제거·sync 까지 한 번에 처리."""
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    snap = db.query(models.QASnapshot).filter(models.QASnapshot.project_id == project_id).first()
    data = copy.deepcopy(snap.data) if snap and snap.data else {"mgr": {"cats": [], "cases": []}}

    mgr   = data.setdefault("mgr", {})
    cats  = mgr.setdefault("cats", [])
    cases = mgr.setdefault("cases", [])

    # 카테고리 머지
    cat_name_to_id = {c["name"]: c["id"] for c in cats}
    for name in body.category_names:
        if name and name not in cat_name_to_id:
            cat_id = f"mc{int(time.time() * 1000)}_{_rand_id()}"
            cats.append({"id": cat_id, "name": name, "color": _CATCOLS[len(cats) % len(_CATCOLS)]})
            cat_name_to_id[name] = cat_id

    # 케이스 머지 (기존 ID 중복 제외)
    existing_ids = {c["id"] for c in cases}
    for c in body.cases:
        cid = c.get("id")
        if not cid or cid in existing_ids:
            continue
        cat_id = cat_name_to_id.get(c.get("catName", ""), "")
        cases.append({
            "id": cid, "name": c.get("name", ""), "type": c.get("type", "Positive"),
            "input": c.get("input", ""), "expected": c.get("expected", ""),
            "actual": "", "pf": "Pass", "owner": "", "date": "", "catId": cat_id,
            "baseUrl": c.get("baseUrl"), "endpoint": c.get("endpoint"),
            "method": c.get("method"), "expectedStatus": c.get("expectedStatus"),
            "headers": c.get("headers"), "queryParams": c.get("queryParams"),
            "body": c.get("body"), "assertions": c.get("assertions"),
        })

    old_cases = (snap.data or {}).get("mgr", {}).get("cases", []) if snap else []
    synced = _sync_cases(data)

    if snap:
        snap.data = synced
    else:
        snap = models.QASnapshot(project_id=project_id, data=synced)
        db.add(snap)

    _record_case_history(project_id, old_cases, synced["mgr"]["cases"], db)
    db.commit()
    return {"ok": True, "data": synced}


@router.patch("/{project_id}/reorder-cases")
def reorder_cases(project_id: int, body: ReorderCasesRequest, db: Session = Depends(get_db)):
    """mgr.cases 순서를 변경. tst/dep 도 같은 순서로 동기화."""
    snap = _get_snap(project_id, db)
    data = copy.deepcopy(snap.data)

    mgr_cases = data.get("mgr", {}).get("cases", [])
    case_map  = {c["id"]: c for c in mgr_cases}

    reordered = [case_map[cid] for cid in body.case_ids if cid in case_map]
    extras    = [c for c in mgr_cases if c.get("id") not in set(body.case_ids)]
    data["mgr"]["cases"] = reordered + extras

    synced = _sync_cases(data)
    snap.data = synced
    db.commit()
    return {"ok": True, "data": synced}


@router.post("/{project_id}/restore-section")
def restore_section(project_id: int, body: RestoreSectionRequest, db: Session = Depends(get_db)):
    """JSON / Excel / Markdown 결과서 파일에서 tst 또는 dep 섹션을 복원."""
    if body.mode not in ("tst", "dep"):
        raise HTTPException(status_code=400, detail="mode는 tst 또는 dep 이어야 합니다")

    snap = _get_snap(project_id, db)
    data = copy.deepcopy(snap.data)

    section     = data.get(body.mode, {})
    cat_by_name = {c["name"]: c["id"] for c in section.get("cats", [])}
    restore_map = {c["id"]: c for c in body.cases}

    new_cases = []
    for c in section.get("cases", []):
        r = restore_map.get(c["id"])
        if r:
            cat_id = c.get("catId", "")
            if body.cat_names and c["id"] in body.cat_names:
                cat_id = cat_by_name.get(body.cat_names[c["id"]], cat_id)
            new_cases.append({**c, "actual": r.get("actual", ""), "pf": r.get("pf", c.get("pf")),
                               "owner": r.get("owner", ""), "date": r.get("date", ""),
                               "notes": r.get("notes", ""), "catId": cat_id})
        else:
            new_cases.append(c)

    section["cases"] = new_cases
    if body.cover:
        section["cover"] = {**section.get("cover", {}), **body.cover}

    data[body.mode] = section
    snap.data = data
    _sync_deploy_history(project_id, data, db)
    db.commit()
    return {"ok": True, "data": data}


@router.get("/{project_id}/case-history")
def get_case_history(
    project_id: int,
    case_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(models.CaseHistory).filter(models.CaseHistory.project_id == project_id)
    if case_id:
        q = q.filter(models.CaseHistory.case_id == case_id)
    histories = q.order_by(models.CaseHistory.changed_at.desc()).limit(limit).all()
    return [
        {"id": h.id, "case_id": h.case_id, "action": h.action,
         "before": h.before, "after": h.after,
         "changed_at": h.changed_at.isoformat() if h.changed_at else None}
        for h in histories
    ]


# ── 내부 함수 ─────────────────────────────────────────────────────────────────

def _record_case_history(project_id: int, old_cases: list, new_cases: list, db: Session):
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
            if any(old_case.get(f) != new_case.get(f) for f in _TRACKED_FIELDS):
                updated.append(cid)
                db.add(models.CaseHistory(project_id=project_id, case_id=cid,
                                          action="updated", before=old_case, after=new_case))

        for cid, case in old_map.items():
            if cid not in new_map:
                deleted.append(cid)
                db.add(models.CaseHistory(project_id=project_id, case_id=cid,
                                          action="deleted", before=case, after=None))

        logger.info("[case_history] project=%d created=%s updated=%s deleted=%s",
                    project_id, created, updated, deleted)
    except Exception as e:
        logger.error("[case_history] project=%d 이력 저장 실패: %s", project_id, e, exc_info=True)


def _sync_deploy_history(project_id: int, data: Any, db: Session):
    try:
        dep   = data.get("dep", {})
        cover = dep.get("cover", {})
        cases = dep.get("cases", [])

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

        existing = db.query(models.DeployHistory).filter(
            models.DeployHistory.project_id == project_id,
            models.DeployHistory.version == cover.get("version"),
            models.DeployHistory.environment == cover.get("environment"),
        ).first()

        if existing:
            existing.summary     = cover.get("summary", "")
            existing.total_cases = len(cases)
            existing.done_cases  = done
            existing.fail_cases  = fail
            existing.deployed_at = deployed_at
        else:
            db.add(models.DeployHistory(
                project_id=project_id, version=cover.get("version", ""),
                environment=cover.get("environment", ""), deploy_type=cover.get("deployType", ""),
                deployer=cover.get("deployer", ""), target_server=cover.get("target", ""),
                summary=cover.get("summary", ""), total_cases=len(cases),
                done_cases=done, fail_cases=fail, deployed_at=deployed_at,
            ))
    except Exception:
        pass
