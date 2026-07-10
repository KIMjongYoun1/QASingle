# QA-Server ERD

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

    deploy_histories {
        int id PK
        int project_id FK
        varchar version
        varchar environment
        varchar deploy_type
        varchar deployer
        varchar target_server
        text summary
        int total_cases
        int done_cases
        int fail_cases
        timestamp deployed_at
        timestamp created_at
    }

    test_flows {
        int id PK
        int project_id FK
        varchar name
        json steps
        timestamp created_at
        timestamp updated_at
    }

    test_runs {
        int id PK
        int project_id FK
        varchar base_url
        varchar status
        int total
        int done
        int fail
        text error
        varchar label
        json case_ids
        json flow_ids
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
        timestamp created_at
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
        text description
        json case_ids
        json flow_ids
        boolean is_default
        timestamp created_at
        timestamp updated_at
    }

    project_presets {
        int id PK
        int project_id FK
        varchar kind
        varchar label
        varchar key
        text value
        varchar category_id
        timestamp created_at
    }

    encryption_configs {
        int id PK
        int project_id FK
        varchar label
        varchar mode
        varchar key_base64
        timestamp created_at
    }

    projects ||--o{ qa_snapshots         : "1:1 (upsert)"
    projects ||--o{ deploy_histories     : "1:N"
    projects ||--o{ test_flows           : "1:N"
    projects ||--o{ test_runs            : "1:N"
    projects ||--o{ notification_configs : "1:N"
    projects ||--o{ case_histories       : "1:N (auto)"
    projects ||--o{ test_suites          : "1:N"
    projects ||--o{ project_presets      : "1:N"
    projects ||--o{ encryption_configs   : "1:N"
    test_runs ||--o{ run_comments        : "1:N (append-only)"
```

## 비고

| 관계 | 설명 |
|---|---|
| projects → qa_snapshots | 프로젝트당 1행 (upsert). mgr / tst / dep 전체 상태 저장 |
| projects → deploy_histories | qa_snapshots.dep 저장 시 정규화 동기화 (version+environment 기준 upsert) |
| projects → test_flows | 사용자 정의 순서형 케이스 묶음 |
| projects → test_runs | 자동 실행 1회 = 1행. case_results / flow_results / mgr_snapshot 불변 |
| projects → notification_configs | Discord / Slack 웹훅 설정. 여러 개 등록 가능 |
| projects → case_histories | 케이스 관리 저장 시 스냅샷 diff로 자동 생성. 수정·삭제 없음 |
| projects → test_suites | 케이스+플로우 묶음 스위트. is_default 설정 시 진입 시 자동 적용 |
| projects → project_presets | 저장된 값(헤더·URL·경로·파라미터·바디·판정조건경로). category_id로 카테고리 자동 적용 연결 |
| projects → encryption_configs | AES-256-GCM 암호화 키. project_presets와 별도 테이블로 분리 |
| test_runs → run_comments | 추가 전용 댓글. 수정·삭제 엔드포인트 없음 |
