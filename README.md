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

### 📖 사용 설명서 (인앱 도움말)
- 사이드바 하단 "사용 설명서" 버튼으로 여는 **플로팅 패널** — 모달이 아니라서 열어둔 채로 뒤의 실제 화면을 그대로 조작 가능 (상단 바를 드래그해서 원하는 위치로 이동 가능)
- 처음 쓰는 사람 기준으로 화면의 버튼·입력칸 하나하나가 무슨 기능인지, API 통신의 기본 개념(요청/응답, 헤더/바디, 상태코드, 암호화 등)까지 실제 값 예시와 함께 설명
- 좌측 목차에서 원하는 항목만 골라볼 수 있음 (프로젝트/케이스 관리/판정 조건/저장된 값/자동 실행/암호화/Test Suite/히스토리/알림/엑셀·AI 등)

### 🗂️ Test Suite
- 비즈니스 로직 단위로 케이스·플로우를 묶은 **스위트** 생성·관리
- 스위트 화면에서 케이스를 **직접 추가·수정·삭제** 가능 — 케이스 관리 탭과 실시간 동기화
- 체크박스 토글로 스위트 포함/제외 즉시 DB 반영 (자동 저장)
- 기본 스위트(`★`) 지정 — 프로젝트 진입 시 자동 로드
- **Additive 불러오기** — 여러 스위트·히스토리를 합산(union) 조합, 칩 단위 해제 가능

### 📋 케이스 관리
- 카테고리 단위로 테스트 케이스 구조화 관리 (카테고리 추가·이름변경·삭제는 "저장된 값 관리" 화면에서 통합 관리)
- **Postman 표준 방식**으로 케이스별 실행 파라미터 입력 (Base URL / Method / Endpoint / Headers / Query Params / Body)
- 케이스별 Base URL 개별 지정 가능 — 비워두면 전역 URL 자동 fallback
- **성공 판정 조건(Assertions)** 설정 — 상태코드 · Body JSON 경로 · Body 텍스트 · 헤더를 조건으로 Pass/Fail 자동 판정. 대상(target)별로 의미 있는 연산자만 노출 (예: Body 텍스트는 항상 참이 되는 "존재/미존재" 연산자를 제외)
- **암호화 호출** — 케이스 단위로 요청 암호화 여부·범위(바디 전체 / 필드별)·사용할 암호화 키를 지정. 자세한 내용은 아래 "🔒 암호화" 항목 참고
- 연동규격서 **엑셀 임포트** 지원
- 스위트·히스토리 **복수 소스 additive 불러오기** — 합산(union) 필터, 칩 단위 개별 해제
- **저장된 값(프리셋) 관리** — 자주 쓰는 헤더 · URL · 엔드포인트 경로 · 파라미터 · 바디 필드 · 판정조건 경로를 프로젝트 단위로 등록해두고 케이스 편집 시 드롭다운으로 재사용. 프리셋을 카테고리에 연결해두면 케이스 작성 시 "카테고리로 선택하기" 탭에서 카테고리만 골라도 해당 헤더/파라미터/바디/URL이 자동 적용됨 (다른 카테고리로 바꾸면 이전 자동 적용분만 깔끔히 교체). 목록은 종류별 아코디언 + 카드 그리드로 정리되어 항목이 늘어도 특정 종류만 펼쳐볼 수 있음
- 케이스 편집 폼은 "카테고리로 선택하기"(자동 적용) / "직접입력"(수동, 바디는 raw JSON 직접 편집) 두 모드로 시작 가능, 모드 전환 시 각 모드에서 입력한 값 유지
- 헤더 · 파라미터 · 바디 편집 시 **중복 키 등록 방지**
- 저장 전 실제로 호출될 요청 전체(메서드·URL·헤더·바디)를 미리보기로 확인 후 저장
- 케이스 목록 테이블에 요청 Method 배지 + 설정값 요약(헤더/파라미터/바디/조건 개수)을 표시, 클릭하면 전체 설정값이 펼쳐짐

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
- **Discord Excel 첨부** — 설정 시 실행 완료 알림에 테스트 수행 내역서 `.xlsx` 파일을 자동 첨부 (openpyxl 서버 사이드 생성)
- Slack Incoming Webhook은 파일 첨부 미지원 — UI에서 안내 메시지 표시
- 테스트 전송 버튼으로 웹훅 즉시 검증
- 알림 설정 페이지에서 **메시지 미리보기** 확인 가능 (Discord / Slack 탭 전환)
- 활성화 / 비활성화 토글

### 🔁 테스트 플로우
- 업무 흐름 단위로 케이스를 순서대로 묶은 플로우 정의
- **Stop-on-fail** — 스텝 실패 시 이후 스텝 자동 스킵
- 플로우 단위 성공/실패 결과 별도 기록
- **응답값 추출·변수 체이닝** (포스트맨 스타일) — 스텝별로 JSON path를 지정해 응답값을 변수로 추출, 이후 스텝의 헤더/파라미터/바디에서 `{{변수명}}`으로 참조. 로그인 → 토큰 추출 → 이후 스텝 인증 헤더에 자동 대입 같은 시나리오에 사용. 변수는 플로우 실행 중에만 유효 (실행 결과와 별도로 영속 저장하지 않음)

### 📊 실행 히스토리
- 모든 자동 실행 이력 시계열 보관
- Pass / Fail 필터 + **카테고리 필터** 동시 지원
- 케이스 행 클릭 시 actual / notes 인라인 확인
- notes에 **요청(헤더·바디 포함)과 응답을 모두 기록** — `[Request]` `[Request Headers]` `[Request Body]` `[Response]` 순으로 남아 실패 원인을 요청값부터 추적 가능
- 실행 단위 **댓글** 추가 (추가 전용, 감사 목적)
- 히스토리 설정 → 케이스관리 / 자동실행 **양방향 복원**

### 📄 테스트결과서 / 배포결과서
- 테스트 완료 결과를 커버 페이지 포함 문서 형식으로 정리
- 배포 버전 / 환경 / 유형(정기·긴급·롤백 등) 분류 기록
- **AI 분석** — 분석 모달에서 LLM 프로바이더를 **실시간 선택** (Local Ollama / Claude API)
  - `Local (Ollama)`: 로컬 설치 모델 — `ollama serve` 실행 필요
  - `Claude API`: Anthropic 외부 API — `ANTHROPIC_API_KEY` 환경변수 필요
  - > ⚠️ **샘플 구현** — 분석 프롬프트 및 응답 품질은 선택한 모델에 따라 크게 달라집니다. 실 운영 시 프롬프트 튜닝 및 모델 선택을 별도로 진행하세요.

### 🔒 암호화
- 프로젝트별 **암호화 설정** 전용 메뉴 — 헤더/URL 등을 다루는 일반 "저장된 값" 프리셋과는 별도 테이블·화면으로 분리 (추후 사용자/관리자 권한으로 메뉴 노출을 나눌 수 있도록 의도적으로 구분)
- `+ 추가` 버튼 하나로 AES-256용 32바이트 키를 Base64로 자동 생성 (Web Crypto 기반 랜덤 생성, 직접 키를 만들 필요 없음)
- 지원 알고리즘은 **AES-256-GCM**만 지원 (IV 12바이트, 인증 태그 포함 — 위변조 시 복호화 자체가 실패함)
- 케이스 단위로 암호화 범위 선택 가능
  - **바디 전체**: 요청 바디 전체를 `{ "encData": "Base64(IV+암호문+Tag)" }`로 암호화
  - **필드별**: 체크박스로 고른 필드만 `{ "field_enc": "Base64(암호문+Tag)" }`로 암호화하고 공유 IV는 `X-IV` 헤더로 전달, 나머지 필드는 평문 유지
- 암호화 케이스는 **평문 엔드포인트와 별도의 `/secure/api/...` 경로**를 호출하도록 설계 — 투명 필터로 자동 복호화하지 않고 명시적으로 분리해서, "암호화 전용 엔드포인트에 평문으로 호출하면 실제로 에러가 나는지"까지 Negative 케이스로 검증 가능
- 응답도 자동 복호화한 뒤 판정 조건(Assertions) 평가에 사용

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
  ├── /api/presets         저장된 값(헤더·URL·경로·파라미터·바디·판정조건경로) CRUD, 카테고리 연결
  ├── /api/encryption-configs  프로젝트별 암호화 키(AES-256-GCM) CRUD
  └── /api/analysis        LLM 분석 (Local Ollama | Claude API — 요청 시 프로바이더 선택)
        │
        ▼
PostgreSQL (11개 테이블)
  projects · qa_snapshots · test_flows · test_runs
  run_comments · case_histories · test_suites
  notification_configs · deploy_histories · project_presets
  encryption_configs
```

---

## 다이어그램

### 전체 서비스 플로우

![전체 플로우](docs/diagrams/1_전체플로우.png)

### 자동 실행 시퀀스

![자동 실행 시퀀스](docs/diagrams/2_자동실행시퀀스.png)

### 히스토리 복원 플로우

![히스토리 복원](docs/diagrams/3_히스토리복원.png)

### 테스트 플로우 Stop-on-fail

![stop-on-fail](docs/diagrams/4_플로우stop-on-fail.png)

### 데이터 저장 흐름

![데이터 저장 흐름](docs/diagrams/5_데이터저장흐름.png)

### 케이스 변경 이력 플로우

![변경 이력](docs/diagrams/6_변경이력플로우.png)

### 알림 전송 플로우

![알림 플로우](docs/diagrams/7_알림플로우.png)

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
alembic upgrade head            # DB 마이그레이션 적용
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

## 로컬 테스트 대상 서버 — ApiEndpointTest

QA-Server 자체는 API를 만드는 도구가 아니라 **호출하는** 도구라서, 자동 실행 기능을 실제로
검증하려면 호출할 대상 서버가 필요합니다. `/Users/ryankim/ApiEndpointTest`가 그 용도로 만든
별도의 Spring Boot 목(mock) 서버입니다 (QA-Server와는 완전히 다른 저장소).

```bash
cd /Users/ryankim/ApiEndpointTest
mvn spring-boot:run
```

- 포트 **8090** (`http://localhost:8090`), 요청/응답 로그는 `http://localhost:8090/admin/logs`
- 회원/인증·상품·주문·결제·쿠폰·배송·리뷰·알림·검색·정산 10개 카테고리, 카테고리별로 실제
  운영 API 같은 인증 헤더(`Authorization`/`X-Api-Key`/`X-Admin-Token`/`Idempotency-Key` 등)와
  공통 필수 바디 필드 7개를 요구하도록 구현되어 있어, Negative 케이스(인증 실패, 필드 누락)까지
  실제로 검증 가능
- 자세한 엔드포인트 목록·필수 헤더 표는 해당 저장소의 `README.md` 참고

QA-Server DB에는 이 서버를 대상으로 세팅된 **"ApiEndpointTest 연동"** 프로젝트가 있습니다 —
케이스 30여 개, 변수 체이닝을 쓰는 7단계 결제 플로우, 카테고리별로 정리된 저장된 값(프리셋)
세트가 이미 구성되어 있어 바로 열어서 자동 실행을 시험해볼 수 있습니다. 프론트엔드
`.env`의 `VITE_API_URL`과는 별개로, 이 프로젝트의 **자동실행 Base URL을
`http://localhost:8090`**으로 지정해서 사용합니다.

---

## 환경 변수

`frontend/.env`

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | FastAPI 서버 URL |

`backend/.env` (또는 실행 환경 변수)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `LLM_PROVIDER` | `local` | 기본 LLM 백엔드 (`local` \| `claude`) — UI 드롭다운으로 요청별 override 가능 |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `llama3.2` | 사용할 로컬 모델명 |
| `ANTHROPIC_API_KEY` | — | Claude API 키 (claude 선택 시 필수) |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | 사용할 Claude 모델 ID |

---

## DB 마이그레이션 (Alembic)

스키마 변경은 `create_all()` 대신 Alembic으로 관리합니다.

```bash
cd backend
source venv/bin/activate

# 운영 DB에 최신 마이그레이션 반영
alembic upgrade head

# 모델 변경 후 새 마이그레이션 생성
alembic revision --autogenerate -m "변경 내용 설명"
alembic upgrade head
```

> `alembic.ini`의 `sqlalchemy.url` 기본값이 로컬 개발 DB로 설정되어 있습니다.  
> 운영 환경에서는 `DATABASE_URL` 환경변수를 설정하면 자동으로 우선 적용됩니다.

> **참고**: 실제로는 앱 시작 시 `models.Base.metadata.create_all()`이 먼저 신규 테이블/컬럼을
> 만들기 때문에, 개발 중 스키마를 바꾼 뒤 Alembic 마이그레이션 파일을 새로 작성하고 나면
> (그 변경이 이미 DB에 반영돼 있으므로) `alembic upgrade head` 대신
> `alembic stamp head` 로 버전 포인터만 맞춰줍니다. 신규 환경에 처음부터 배포할 때는
> `alembic upgrade head`로 순차 적용하면 됩니다.

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
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic |
| Database | PostgreSQL 16 (Docker) |
| AI (LLM) | Ollama (로컬) / Anthropic Claude API (외부) — UI에서 요청별 선택 |
| 기타 | openpyxl (엑셀), httpx (HTTP 실행), cryptography (AES-256-GCM 암복호화), Docker Compose |
