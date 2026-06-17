from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
import httpx
import os

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


class AnalysisRequest(BaseModel):
    project_id: int
    mode: str  # "testcase" | "deploy" | "business"
    question: Optional[str] = None


@router.get("/deploy-history/{project_id}")
def get_deploy_history(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    histories = (
        db.query(models.DeployHistory)
        .filter(models.DeployHistory.project_id == project_id)
        .order_by(models.DeployHistory.created_at.desc())
        .all()
    )
    return [
        {
            "id": h.id,
            "version": h.version,
            "environment": h.environment,
            "deploy_type": h.deploy_type,
            "deployer": h.deployer,
            "target_server": h.target_server,
            "summary": h.summary,
            "total_cases": h.total_cases,
            "done_cases": h.done_cases,
            "fail_cases": h.fail_cases,
            "deployed_at": h.deployed_at.isoformat() if h.deployed_at else None,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in histories
    ]


@router.post("/analyze")
async def analyze(body: AnalysisRequest, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == body.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    snap = (
        db.query(models.QASnapshot)
        .filter(models.QASnapshot.project_id == body.project_id)
        .first()
    )
    if not snap:
        raise HTTPException(status_code=404, detail="QA 데이터가 없습니다")

    data = snap.data
    prompt = _build_prompt(body.mode, body.question, data, proj.name)

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            result = resp.json()
            return {"result": result.get("response", ""), "mode": body.mode}
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Ollama 서버에 연결할 수 없습니다 ({OLLAMA_URL}). ollama serve 명령으로 실행해주세요."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 분석 실패: {str(e)}")


def _build_prompt(mode: str, question: Optional[str], data: dict, project_name: str) -> str:
    mgr = data.get("mgr", {})
    cases = mgr.get("cases", [])
    cats = mgr.get("cats", [])
    dep_cover = data.get("dep", {}).get("cover", {})
    dep_cases = data.get("dep", {}).get("cases", [])

    total = len(cases)
    passed = sum(1 for c in cases if c.get("pf") == "Pass")
    failed = sum(1 for c in cases if c.get("pf") == "Fail")

    cat_map = {c["id"]: c["name"] for c in cats}
    fail_cases = [c for c in cases if c.get("pf") == "Fail"]

    if mode == "testcase":
        fail_text = "\n".join(
            f"- [{c.get('id')}] {c.get('name')} | 기대: {c.get('expected', '')} | 실제: {c.get('actual', '')}"
            for c in fail_cases
        )
        prompt = f"""당신은 QA 전문가입니다. 다음은 프로젝트 "{project_name}"의 테스트 수행 결과입니다.

[테스트 결과 요약]
- 전체 케이스: {total}건
- PASS: {passed}건
- FAIL: {failed}건
- 통과율: {round(passed/total*100) if total else 0}%

[FAIL 케이스 목록]
{fail_text if fail_text else "없음"}

{f"[질문] {question}" if question else ""}

위 결과를 분석하여 다음을 한국어로 답변해주세요:
1. FAIL 케이스의 공통 패턴이나 원인 분석
2. 품질 위험 영역
3. 개선 권고사항"""

    elif mode == "deploy":
        done = sum(1 for c in dep_cases if c.get("pf") == "완료")
        fail = sum(1 for c in dep_cases if c.get("pf") == "미완료")
        prompt = f"""당신은 배포 관리 전문가입니다. 다음은 프로젝트 "{project_name}"의 배포 결과입니다.

[배포 정보]
- 버전: {dep_cover.get('version', '-')}
- 환경: {dep_cover.get('environment', '-')}
- 배포 유형: {dep_cover.get('deployType', '-')}
- 대상 서버: {dep_cover.get('target', '-')}
- 배포 내용: {dep_cover.get('summary', '-')}
- 전체 항목: {len(dep_cases)}건, 완료: {done}건, 미완료: {fail}건

{f"[질문] {question}" if question else ""}

위 배포 결과를 분석하여 한국어로 다음을 답변해주세요:
1. 배포 완료 현황 평가
2. 미완료 항목에 대한 리스크
3. 후속 조치 권고사항"""

    else:  # business
        case_summary = "\n".join(
            f"- [{cat_map.get(c.get('catId',''), '미분류')}] {c.get('name', '')}: {c.get('expected', '')}"
            for c in cases[:30]
        )
        prompt = f"""당신은 비즈니스 분석 전문가입니다. 다음은 프로젝트 "{project_name}"의 테스트 케이스 목록입니다.

[케이스 목록 (최대 30건)]
{case_summary}

{f"[질문] {question}" if question else ""}

위 내용을 바탕으로 한국어로 다음을 분석해주세요:
1. 이 시스템/서비스의 핵심 비즈니스 기능 요약
2. 테스트 커버리지 관점에서의 누락 가능 영역
3. 비즈니스 리스크 관점에서의 중요 케이스"""

    return prompt
