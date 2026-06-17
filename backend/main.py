from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os

from database import engine
import models
from routers import projects, qa_data, excel, analysis, openapi, runs, flows

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

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
