from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import logging
import logging.handlers
import sqlalchemy

from database import engine
import models
from routers import projects, qa_data, excel, analysis, openapi, runs, flows, notifications, analytics, suites, presets

# ── 로깅 설정 ──────────────────────────────────────────────────────────────
_LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(_LOG_DIR, exist_ok=True)

_fmt = logging.Formatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# 전체 앱 로그 (일별 로테이션, 30일 보관)
_file_handler = logging.handlers.TimedRotatingFileHandler(
    filename=os.path.join(_LOG_DIR, "app.log"),
    when="midnight", interval=1, backupCount=30, encoding="utf-8",
)
_file_handler.setFormatter(_fmt)

# 케이스 이력 전용 로그
_history_handler = logging.handlers.TimedRotatingFileHandler(
    filename=os.path.join(_LOG_DIR, "case_history.log"),
    when="midnight", interval=1, backupCount=30, encoding="utf-8",
)
_history_handler.setFormatter(_fmt)

# 실행(run) 전용 로그
_run_handler = logging.handlers.TimedRotatingFileHandler(
    filename=os.path.join(_LOG_DIR, "runs.log"),
    when="midnight", interval=1, backupCount=30, encoding="utf-8",
)
_run_handler.setFormatter(_fmt)

_console_handler = logging.StreamHandler()
_console_handler.setFormatter(_fmt)

# 루트 로거
logging.basicConfig(level=logging.INFO, handlers=[_file_handler, _console_handler])

# 케이스 이력 전용 로거
logging.getLogger("qa.case_history").addHandler(_history_handler)

# 실행 전용 로거
logging.getLogger("qa.runs").addHandler(_run_handler)

# uvicorn 로그도 파일로
for _name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
    logging.getLogger(_name).addHandler(_file_handler)

# ── DB 테이블 생성 ─────────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)

# ── 컬럼 추가 마이그레이션 (ADD COLUMN IF NOT EXISTS) ──────────────────────
with engine.connect() as _conn:
    _conn.execute(
        sqlalchemy.text(
            "ALTER TABLE notification_configs ADD COLUMN IF NOT EXISTS attach_excel BOOLEAN NOT NULL DEFAULT FALSE"
        )
    )
    _conn.commit()

app = FastAPI(title="QA Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(projects.router)
app.include_router(qa_data.router)
app.include_router(excel.router)
app.include_router(analysis.router)
app.include_router(openapi.router)
app.include_router(runs.router)
app.include_router(flows.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(suites.router)
app.include_router(presets.router)

# QA 디렉토리 정적 파일 서빙
QA_DIR = os.path.join(os.path.dirname(__file__), "..", "QA")
if os.path.isdir(QA_DIR):
    app.mount("/qa", StaticFiles(directory=QA_DIR, html=True), name="qa")

@app.get("/")
def root():
    index = os.path.join(QA_DIR, "index.html")
    if os.path.exists(index):
        return FileResponse(index)
    return {"message": "QA Server is running", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok"}
