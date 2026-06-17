<div align="center">

# 🧪 Single\_QA\_Tools

**테스트 케이스 관리 · 자동 실행 · 배포 점검을 하나의 인터페이스에서**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

![전체 플로우](docs/diagrams/1_전체플로우.png)

</div>

---

## 개요

**Single_QA_Tools**는 소규모 개발팀 또는 개인 QA 담당자를 위한 통합 QA 관리 도구입니다.
테스트 케이스 설계부터 자동화 실행, 결과 문서화, 배포 점검까지 하나의 UI에서 처리할 수 있으며,
실행 이력은 **불변(immutable)** 으로 보관되어 언제든 감사(Audit)가 가능합니다.

---

## 주요 기능

### 📋 케이스 관리
- 카테고리 단위로 테스트 케이스 구조화 관리
- HTTP 메서드 / 엔드포인트 / 헤더 / 파라미터 / 바디 직접 입력
- 연동규격서 **엑셀 임포트** 지원
- 실행 히스토리에서 이전 설정 **원클릭 복원**

### ⚡ 자동 실행
- 개별 케이스 + **테스트 플로우** 선택 후 실제 HTTP 요청 자동 실행
- Base URL만 지정하면 서버가 요청 대행 (Human-in-the-loop 방식)
- 실행 완료 후 결과(`case_results`, `flow_results`, `mgr_snapshot`) **불변 저장**
- 실시간 진행률 폴링 (1초 간격)

### 🔁 테스트 플로우
- 업무 흐름 단위로 케이스를 순서대로 묶은 플로우 정의
- **Stop-on-fail** — 스텝 실패 시 이후 스텝 자동 스킵
- 플로우 단위 성공/실패 결과 별도 기록

### 📊 실행 히스토리
- 모든 자동 실행 이력 시계열 보관
- Pass / Fail 필터 + **카테고리 필터** 동시 지원
- 케이스 행 클릭 시 actual / notes 인라인 확인
- 실행 단위 **댓글** 추가 (추가 전용, 감사 목적)
- 히스토리 설정 → 케이스관리 / 자동실행 **양방향 복원**

### 📄 테스트결과서 / 배포결과서
- 테스트 완료 결과를 커버 페이지 포함 문서 형식으로 정리
- 배포 버전 / 환경 / 유형(정기·긴급·롤백 등) 분류 기록
- **AI 분석** — Anthropic Claude API 기반 배포 패턴 리포트

---

## 아키텍처

```
Browser (React SPA)
  └── Zustand (전역 상태: 선택 케이스, 프로젝트, pendingRunRestore)
        │
        ▼
FastAPI REST API
  ├── /projects     프로젝트 CRUD
  ├── /qa           QA 스냅샷 load/save (mgr · tst · dep 통합)
  ├── /runs         자동 실행 생성 · 조회 · 폴링
  ├── /flows        테스트 플로우 CRUD
  ├── /deploy       배포결과서 이력
  └── /analysis     LLM 분석 (Claude API)
        │
        ▼
PostgreSQL
  projects · qa_snapshots · deploy_histories
  test_flows · test_runs · run_comments
```

---

## 다이어그램

| 자동 실행 시퀀스 | 히스토리 복원 플로우 |
|:---:|:---:|
| ![자동실행](docs/diagrams/2_자동실행시퀀스.png) | ![히스토리복원](docs/diagrams/3_히스토리복원.png) |

| 플로우 Stop-on-fail | 데이터 저장 흐름 |
|:---:|:---:|
| ![stop-on-fail](docs/diagrams/4_플로우stop-on-fail.png) | ![데이터흐름](docs/diagrams/5_데이터저장흐름.png) |

---

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/QA-Server.git
cd QA-Server
```

### 2. 데이터베이스 실행

```bash
docker-compose up -d
```

PostgreSQL 16이 `localhost:5432`에서 시작됩니다.

### 3. 백엔드 실행

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

> API 서버: **http://localhost:8000**
> Swagger 문서: **http://localhost:8000/docs**

### 4. 프론트엔드 실행

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

> 앱: **http://localhost:5173**

---

## 환경 변수

`frontend/.env`

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | FastAPI 서버 URL |

---

## 불변성 원칙

실행이 완료된 결과는 **절대 수정되지 않습니다.**

| 테이블 | 수정 가능 | 불변 |
|---|---|---|
| `test_runs` | `label` | `case_ids`, `flow_ids`, `case_results`, `flow_results`, `mgr_snapshot` |
| `run_comments` | — | `text`, `created_at` |

---

## 문서

- [테이블 정의서](docs/테이블정의서.md)
- [ERD](docs/ERD.md)
- [서비스 소개서](docs/서비스소개서.md)
- [서비스 플로우](docs/서비스플로우.md)

---

## 기술 스택 상세

| 영역 | 기술 |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| 상태관리 | Zustand, TanStack Query |
| UI 컴포넌트 | Radix UI, lucide-react, Sonner (toast) |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Database | PostgreSQL 16 (Docker) |
| AI | Anthropic Claude API |
| 기타 | openpyxl (엑셀), httpx (HTTP 실행), Docker Compose |
