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

    projects ||--o{ qa_snapshots       : "1:1 (upsert)"
    projects ||--o{ deploy_histories   : "1:N"
    projects ||--o{ test_flows         : "1:N"
    projects ||--o{ test_runs          : "1:N"
    test_runs ||--o{ run_comments      : "1:N (append-only)"
```

## 비고

| 관계 | 설명 |
|---|---|
| projects → qa_snapshots | 프로젝트당 1행 (upsert). mgr / tst / dep 전체 상태 저장 |
| projects → deploy_histories | qa_snapshots.dep 저장 시 정규화 동기화 (version+environment 기준 upsert) |
| projects → test_flows | 사용자 정의 순서형 케이스 묶음 |
| projects → test_runs | 자동 실행 1회 = 1행. case_results / flow_results / mgr_snapshot 불변 |
| test_runs → run_comments | 추가 전용 댓글. 수정·삭제 엔드포인트 없음 |
