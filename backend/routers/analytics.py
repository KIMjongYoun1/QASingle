from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from database import get_db
import models

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except Exception:
        return None


@router.get("/{project_id}")
def get_analytics(
    project_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    프로젝트 실행 분석
    - start_date / end_date: ISO 날짜 문자열 (예: 2026-06-01). 미입력 시 전체.
    - 반환: 전체 통계, 케이스별 Pass율, 최근 추이, 마지막 실행일
    """
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    q = db.query(models.TestRun).filter(
        models.TestRun.project_id == project_id,
        models.TestRun.status == "done",
    )

    start_dt = _parse_dt(start_date)
    end_dt = _parse_dt(end_date)
    if start_dt:
        q = q.filter(models.TestRun.started_at >= start_dt)
    if end_dt:
        # end_date는 당일 포함이므로 하루 끝까지
        from datetime import timedelta
        q = q.filter(models.TestRun.started_at < end_dt + timedelta(days=1))

    runs = q.order_by(models.TestRun.started_at.desc()).limit(200).all()

    total_runs = len(runs)
    last_run_at = runs[0].started_at.isoformat() if runs and runs[0].started_at else None

    if total_runs == 0:
        return {
            "total_runs": 0,
            "overall_pass_rate": 0,
            "case_stats": [],
            "trend": [],
            "last_run_at": last_run_at,
        }

    full_pass_runs = sum(1 for r in runs if r.fail == 0)
    overall_pass_rate = round(full_pass_runs / total_runs * 100, 1)

    case_stats: dict[str, dict] = {}
    for run in runs:
        for cr in (run.case_results or []):
            cid = cr.get("case_id")
            if not cid:
                continue
            if cid not in case_stats:
                case_stats[cid] = {"case_id": cid, "total": 0, "pass": 0, "fail": 0}
            case_stats[cid]["total"] += 1
            if cr.get("pf") == "Pass":
                case_stats[cid]["pass"] += 1
            else:
                case_stats[cid]["fail"] += 1

    for v in case_stats.values():
        v["pass_rate"] = round(v["pass"] / v["total"] * 100, 1) if v["total"] else 0.0

    trend = [
        {
            "run_id": r.id,
            "label": r.label,
            "total": r.total,
            "fail": r.fail,
            "pass": r.total - r.fail,
            "pass_rate": round((r.total - r.fail) / r.total * 100, 1) if r.total else 0.0,
            "started_at": r.started_at.isoformat() if r.started_at else None,
        }
        for r in reversed(runs[:30])
    ]

    return {
        "total_runs": total_runs,
        "overall_pass_rate": overall_pass_rate,
        "case_stats": sorted(case_stats.values(), key=lambda x: x["fail"], reverse=True),
        "trend": trend,
        "last_run_at": last_run_at,
    }
