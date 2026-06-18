<div align="center">

# 🧪 Single\_QA\_Tools

**테스트 케이스 관리 · 자동 실행 · 배포 점검을 하나의 인터페이스에서**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## 개요

**Single_QA_Tools**는 소규모 개발팀 또는 개인 QA 담당자를 위한 통합 QA 관리 도구입니다.
테스트 케이스 설계부터 자동화 실행, 결과 문서화, 배포 점검까지 하나의 UI에서 처리할 수 있으며,
실행 이력은 **불변(immutable)** 으로 보관되어 언제든 감사(Audit)가 가능합니다.

---

## 주요 기능

### 🗂️ Test Suite
- 비즈니스 로직 단위로 케이스·플로우를 묶은 **스위트** 생성·관리
- 스위트 화면에서 케이스를 **직접 추가·수정·삭제** 가능 — 케이스 관리 탭과 실시간 동기화
- 체크박스 토글로 스위트 포함/제외 즉시 DB 반영 (자동 저장)
- 기본 스위트(`★`) 지정 — 프로젝트 진입 시 자동 로드
- **Additive 불러오기** — 여러 스위트·히스토리를 합산(union) 조합, 칩 단위 해제 가능

### 📋 케이스 관리
- 카테고리 단위로 테스트 케이스 구조화 관리
- **Postman 표준 방식**으로 케이스별 실행 파라미터 입력 (Base URL / Method / Endpoint / Headers / Query Params / Body)
- 케이스별 Base URL 개별 지정 가능 — 비워두면 전역 URL 자동 fallback
- **성공 판정 조건(Assertions)** 설정 — 상태코드 · Body JSON 경로 · Body 텍스트 · 헤더를 조건으로 Pass/Fail 자동 판정
- 연동규격서 **엑셀 임포트** 지원
- 스위트·히스토리 **복수 소스 additive 불러오기** — 합산(union) 필터, 칩 단위 개별 해제

### ⚡ 자동 실행
- 개별 케이스 + **테스트 플로우** 선택 후 실제 HTTP 요청 자동 실행
- **전역 설정**(Base URL, 기본 헤더 KV) + **케이스별 개별 설정** 공존 — 케이스 설정이 전역보다 우선
- Assertions 설정 시 상태코드 + 모든 조건 동시 충족 여부로 Pass/Fail 자동 판정
- 실행 완료 후 결과(`case_results`, `flow_results`, `mgr_snapshot`) **불변 저장**
- 실시간 진행률 폴링 (1초 간격)

### 🔔 알림 설정
- 프로젝트별 **Discord / Slack 웹훅** 복수 등록
- 구독 이벤트 선택: `실행 완료` / `실행 오류`
- 알림 메시지 내용: 프로젝트명 · 실행 레이블 · 통과/실패 수 · 실패 케이스 목록 · 플로우 결과 + 문서 형식 요약 보고서
- 테스트 전송 버튼으로 웹훅 즉시 검증
- 알림 설정 페이지에서 **메시지 미리보기** 확인 가능 (Discord / Slack 탭 전환)
- 활성화 / 비활성화 토글

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
  ├── /api/projects        프로젝트 CRUD
  ├── /api/qa              QA 스냅샷 load/save (mgr · tst · dep 통합) + 케이스 변경 이력
  ├── /api/runs            자동 실행 생성 · 조회 · 폴링
  ├── /api/flows           테스트 플로우 CRUD
  ├── /api/suites          Test Suite CRUD + 기본 스위트 지정
  ├── /api/analytics       실행 분석 (기간 필터)
  ├── /api/notifications   Discord / Slack 웹훅 설정
  ├── /api/deploy          배포결과서 이력
  └── /api/analysis        LLM 분석 (Claude API)
        │
        ▼
PostgreSQL (9개 테이블)
  projects · qa_snapshots · test_flows · test_runs
  run_comments · case_histories · test_suites
  notification_configs · deploy_histories
```

---

## ERD

```mermaid
erDiagram
    projects {
        int id PK
        varchar name
        timestamp created_at
        timestamp updated_at
    }
    qa_snapshots {
        int id PK
        int project_id FK
        json data
        timestamp updated_at
    }
    test_flows {
        int id PK
        int project_id FK
        varchar name
        json steps
    }
    test_runs {
        int id PK
        int project_id FK
        varchar base_url
        varchar status
        int total
        int done
        int fail
        varchar label
        json case_results
        json flow_results
        json mgr_snapshot
        timestamp started_at
        timestamp finished_at
    }
    run_comments {
        int id PK
        int run_id FK
        text text
        timestamp created_at
    }
    notification_configs {
        int id PK
        int project_id FK
        varchar name
        varchar type
        varchar webhook_url
        boolean enabled
        json events
    }
    case_histories {
        int id PK
        int project_id FK
        varchar case_id
        varchar action
        json before
        json after
        timestamp changed_at
    }
    test_suites {
        int id PK
        int project_id FK
        varchar name
        json case_ids
        json flow_ids
        boolean is_default
    }
    deploy_histories {
        int id PK
        int project_id FK
        varchar version
        varchar environment
        varchar deploy_type
        int total_cases
        int fail_cases
        timestamp deployed_at
    }

    projects ||--o{ qa_snapshots         : "1:1"
    projects ||--o{ test_flows           : "1:N"
    projects ||--o{ test_runs            : "1:N"
    projects ||--o{ notification_configs : "1:N"
    projects ||--o{ case_histories       : "1:N"
    projects ||--o{ test_suites          : "1:N"
    projects ||--o{ deploy_histories     : "1:N"
    test_runs ||--o{ run_comments        : "1:N"
```

---

## 서비스 플로우

```mermaid
flowchart TD
    A([사용자]) --> DASH[전체 대시보드]
    DASH -->|카드 클릭| B[프로젝트 진입]
    B --> C{탭 선택}

    C --> SU[Test Suite]
    C --> D[케이스 관리]
    C --> E[자동 실행]
    C --> F[실행 히스토리]
    C --> AN[실행 분석]
    C --> CH[변경 이력]
    C --> G[테스트결과서]
    C --> H[배포결과서]
    C --> NT[알림 설정]

    SU --> SU1[스위트 생성·편집]
    SU --> SU2[케이스 직접 추가·수정·삭제]
    SU --> SU3[케이스·플로우 체크박스 선택]
    SU3 --> SU4[Additive Union 불러오기]
    SU4 --> D
    SU4 --> E

    D --> D1[케이스 입력 / 엑셀 임포트]
    D --> D2[Assertions 성공 판정 조건 설정]
    D1 & D2 --> D3[저장 → 변경 이력 자동 기록]

    E --> E1[케이스 + 플로우 선택]
    E --> E2[전역·케이스별 URL·헤더 설정]
    E1 & E2 --> E3[실행]
    E3 --> E4[HTTP 요청 + Assertions 판정]
    E4 --> E5[결과 불변 저장]
    E5 --> E6[Discord·Slack 알림 전송]

    NT --> NT1[Discord·Slack 웹훅 등록]
    NT --> NT2[메시지 미리보기]
```

자동 실행 시퀀스, 알림 플로우, 데이터 저장 흐름 등 상세 다이어그램 → [서비스 플로우 문서](docs/서비스플로우.md)

---

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/QASingle.git
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

### 4. 더미 데이터 삽입 (선택)

실제 화면을 바로 확인하고 싶다면 시드 스크립트를 실행합니다.  
백엔드 가상환경이 활성화된 상태에서 실행하세요.

```bash
cd backend
python seed.py
```

50개 프로젝트 · 각 프로젝트당 케이스 수십 개 · Test Suite 3종 · 실행 이력·댓글이 한 번에 생성됩니다.  
**주의**: 기존 데이터가 전부 삭제되고 새로 삽입됩니다.

### 5. 프론트엔드 실행

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
