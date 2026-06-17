"""더미 데이터 시드 — python3 seed.py"""
import random
from datetime import datetime, timedelta, timezone

from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ── 기존 데이터 전부 삭제 ──────────────────────────────────────────────────
print("기존 데이터 삭제 중...")
db.query(models.RunComment).delete()
db.query(models.CaseHistory).delete()
db.query(models.TestSuite).delete()
db.query(models.NotificationConfig).delete()
db.query(models.DeployHistory).delete()
db.query(models.TestRun).delete()
db.query(models.TestFlow).delete()
db.query(models.QASnapshot).delete()
db.query(models.Project).delete()
db.commit()

# ── 헬퍼 ──────────────────────────────────────────────────────────────────
def rnd_dt(days_ago_max=180, days_ago_min=0):
    offset = random.randint(days_ago_min * 86400, days_ago_max * 86400)
    return datetime.now(timezone.utc) - timedelta(seconds=offset)

METHODS     = ["GET", "POST", "PUT", "PATCH", "DELETE"]
ENVIRONMENTS = ["Production", "Staging", "Development", "QA"]
DEPLOY_TYPES = ["정기 배포", "긴급 배포", "신규 기능", "패치", "롤백"]
COLORS = ["#4f8cff", "#7c3aed", "#16a34a", "#dc2626", "#d97706", "#0891b2", "#be185d", "#0ea5e9", "#10b981", "#f59e0b"]

# 프로젝트 이름과 그 도메인에 어울리는 카테고리·엔드포인트 매핑
PROJECT_DOMAINS = [
    ("커머스 API",      ["인증", "상품", "장바구니", "주문", "결제"],
     ["/auth/login", "/products", "/products/{id}", "/cart", "/cart/items", "/orders", "/payments"]),
    ("회원 서비스",     ["회원가입", "로그인", "프로필", "비밀번호"],
     ["/users/register", "/users/login", "/users/{id}", "/users/{id}/profile", "/users/{id}/password"]),
    ("결제 시스템",     ["결제 요청", "결제 확인", "환불", "취소"],
     ["/payments/request", "/payments/{id}/confirm", "/payments/{id}/refund", "/payments/{id}/cancel"]),
    ("상품 관리",       ["상품 조회", "상품 등록", "재고", "카테고리"],
     ["/products", "/products/{id}", "/products/{id}/stock", "/categories", "/categories/{id}"]),
    ("주문 서비스",     ["주문 생성", "주문 조회", "주문 취소", "배송"],
     ["/orders", "/orders/{id}", "/orders/{id}/cancel", "/orders/{id}/delivery"]),
    ("리뷰 플랫폼",     ["리뷰 작성", "리뷰 조회", "별점", "신고"],
     ["/reviews", "/reviews/{id}", "/reviews/{id}/like", "/reviews/{id}/report"]),
    ("쿠폰 엔진",       ["쿠폰 발급", "쿠폰 적용", "유효성 검사", "만료"],
     ["/coupons", "/coupons/apply", "/coupons/{id}/validate", "/coupons/{id}/expire"]),
    ("알림 서비스",     ["알림 발송", "읽음 처리", "알림 목록", "설정"],
     ["/notifications", "/notifications/{id}/read", "/notifications/bulk-read", "/notifications/settings"]),
    ("관리자 대시보드", ["통계 조회", "사용자 관리", "로그 조회", "설정"],
     ["/admin/stats", "/admin/users", "/admin/users/{id}", "/admin/logs", "/admin/settings"]),
    ("검색 서비스",     ["키워드 검색", "자동완성", "필터", "정렬"],
     ["/search", "/search/autocomplete", "/search/filter", "/search/popular"]),
    ("배송 추적",       ["배송 등록", "배송 조회", "배송 상태", "배송지 변경"],
     ["/delivery", "/delivery/{id}", "/delivery/{id}/status", "/delivery/{id}/address"]),
    ("정산 시스템",     ["정산 내역", "정산 요청", "세금계산서", "출금"],
     ["/settlement", "/settlement/{id}", "/settlement/invoice", "/settlement/withdraw"]),
    ("파트너 API",      ["파트너 인증", "상품 연동", "주문 수신", "재고 동기화"],
     ["/partner/auth", "/partner/products", "/partner/orders", "/partner/inventory/sync"]),
    ("모바일 게이트웨이", ["토큰 발급", "푸시 알림", "버전 체크", "설정 동기화"],
     ["/mobile/token", "/mobile/push", "/mobile/version", "/mobile/config/sync"]),
    ("CS 도구",         ["문의 접수", "문의 답변", "에스컬레이션", "통계"],
     ["/cs/tickets", "/cs/tickets/{id}/reply", "/cs/tickets/{id}/escalate", "/cs/stats"]),
    ("B2B 포털",        ["기업 인증", "대량 주문", "계약 관리", "세금계산서"],
     ["/b2b/auth", "/b2b/orders/bulk", "/b2b/contracts", "/b2b/invoice"]),
    ("리포팅 서비스",   ["리포트 생성", "리포트 조회", "스케줄 설정", "이메일 발송"],
     ["/reports", "/reports/{id}", "/reports/schedule", "/reports/{id}/send"]),
    ("인증 서버",       ["토큰 발급", "토큰 갱신", "토큰 검증", "로그아웃"],
     ["/auth/token", "/auth/token/refresh", "/auth/token/verify", "/auth/logout"]),
    ("파일 서버",       ["파일 업로드", "파일 조회", "파일 삭제", "서명 URL"],
     ["/files/upload", "/files/{id}", "/files/{id}/delete", "/files/{id}/signed-url"]),
    ("캐시 서비스",     ["캐시 조회", "캐시 저장", "캐시 삭제", "캐시 초기화"],
     ["/cache/{key}", "/cache/{key}/set", "/cache/{key}/delete", "/cache/flush"]),
    ("로그 수집기",     ["로그 수집", "로그 조회", "로그 검색", "로그 삭제"],
     ["/logs/ingest", "/logs", "/logs/search", "/logs/{id}/delete"]),
    ("이벤트 버스",     ["이벤트 발행", "이벤트 구독", "DLQ 처리", "이벤트 조회"],
     ["/events/publish", "/events/subscribe", "/events/dlq", "/events/{id}"]),
    ("스케줄러",        ["작업 등록", "작업 실행", "작업 취소", "실행 이력"],
     ["/scheduler/jobs", "/scheduler/jobs/{id}/run", "/scheduler/jobs/{id}/cancel", "/scheduler/jobs/{id}/history"]),
    ("배치 처리",       ["배치 실행", "배치 상태", "배치 취소", "배치 이력"],
     ["/batch/run", "/batch/{id}/status", "/batch/{id}/cancel", "/batch/history"]),
    ("웹훅 중계",       ["웹훅 등록", "웹훅 발송", "웹훅 재시도", "웹훅 이력"],
     ["/webhooks", "/webhooks/{id}/send", "/webhooks/{id}/retry", "/webhooks/{id}/history"]),
    ("AI 추천 엔진",    ["추천 조회", "모델 학습", "피드백 수집", "A/B 결과"],
     ["/recommend/{user_id}", "/recommend/model/train", "/recommend/feedback", "/recommend/ab-result"]),
    ("SEO 서비스",      ["메타 조회", "사이트맵 생성", "robots 설정", "캐노니컬 처리"],
     ["/seo/meta/{page}", "/seo/sitemap", "/seo/robots", "/seo/canonical"]),
    ("A/B 테스트",      ["실험 생성", "실험 배정", "결과 집계", "실험 종료"],
     ["/experiments", "/experiments/{id}/assign", "/experiments/{id}/results", "/experiments/{id}/stop"]),
    ("피처 플래그",     ["플래그 조회", "플래그 활성화", "플래그 비활성화", "대상 설정"],
     ["/flags/{key}", "/flags/{key}/enable", "/flags/{key}/disable", "/flags/{key}/targets"]),
    ("데이터 파이프라인", ["파이프라인 실행", "파이프라인 상태", "데이터 검증", "오류 처리"],
     ["/pipeline/run", "/pipeline/{id}/status", "/pipeline/{id}/validate", "/pipeline/{id}/errors"]),
    ("광고 서버",       ["광고 조회", "광고 노출", "클릭 추적", "전환 추적"],
     ["/ads/{placement}", "/ads/{id}/impression", "/ads/{id}/click", "/ads/{id}/conversion"]),
    ("구독 관리",       ["구독 생성", "구독 갱신", "구독 취소", "결제 실패 처리"],
     ["/subscriptions", "/subscriptions/{id}/renew", "/subscriptions/{id}/cancel", "/subscriptions/{id}/payment-failed"]),
    ("포인트 시스템",   ["포인트 적립", "포인트 사용", "포인트 조회", "만료 처리"],
     ["/points/earn", "/points/use", "/points/{user_id}", "/points/expire"]),
    ("멤버십 관리",     ["등급 조회", "등급 업그레이드", "혜택 조회", "포인트 전환"],
     ["/membership/{user_id}", "/membership/{user_id}/upgrade", "/membership/benefits", "/membership/convert"]),
    ("앱 설정 서버",    ["설정 조회", "설정 업데이트", "설정 초기화", "버전별 설정"],
     ["/app-config/{key}", "/app-config/{key}/update", "/app-config/reset", "/app-config/version/{v}"]),
    ("지도 서비스",     ["좌표 변환", "경로 탐색", "주소 검색", "반경 검색"],
     ["/geo/convert", "/geo/route", "/geo/address/search", "/geo/nearby"]),
    ("날씨 연동 API",   ["현재 날씨", "예보 조회", "지역 검색", "알림 설정"],
     ["/weather/current", "/weather/forecast", "/weather/location/search", "/weather/alert"]),
    ("소셜 로그인",     ["Google 로그인", "Kakao 로그인", "Naver 로그인", "토큰 교환"],
     ["/oauth/google", "/oauth/kakao", "/oauth/naver", "/oauth/token/exchange"]),
    ("이메일 발송",     ["이메일 발송", "대량 발송", "템플릿 관리", "발송 이력"],
     ["/email/send", "/email/bulk-send", "/email/templates", "/email/history"]),
    ("SMS 발송",        ["SMS 발송", "대량 발송", "수신 거부", "발송 이력"],
     ["/sms/send", "/sms/bulk-send", "/sms/opt-out", "/sms/history"]),
    ("QR 코드 API",     ["QR 생성", "QR 파싱", "QR 이력", "유효성 확인"],
     ["/qr/generate", "/qr/parse", "/qr/history", "/qr/{id}/validate"]),
    ("바코드 스캐너",   ["바코드 조회", "상품 매핑", "재고 확인", "이력 저장"],
     ["/barcode/{code}", "/barcode/{code}/product", "/barcode/{code}/stock", "/barcode/history"]),
    ("OCR 서비스",      ["이미지 분석", "텍스트 추출", "영수증 파싱", "신분증 인식"],
     ["/ocr/analyze", "/ocr/extract", "/ocr/receipt", "/ocr/id-card"]),
    ("번역 API",        ["텍스트 번역", "언어 감지", "지원 언어 목록", "용어집 관리"],
     ["/translate/text", "/translate/detect", "/translate/languages", "/translate/glossary"]),
    ("음성 인식 API",   ["음성→텍스트", "텍스트→음성", "화자 인식", "노이즈 제거"],
     ["/speech/to-text", "/speech/to-speech", "/speech/speaker-detect", "/speech/denoise"]),
    ("영상 스트리밍",   ["스트림 시작", "스트림 종료", "재생 목록", "품질 설정"],
     ["/stream/start", "/stream/{id}/stop", "/stream/playlist", "/stream/{id}/quality"]),
    ("이미지 처리",     ["이미지 리사이즈", "포맷 변환", "썸네일 생성", "워터마크"],
     ["/image/resize", "/image/convert", "/image/thumbnail", "/image/watermark"]),
    ("PDF 생성",        ["PDF 생성", "PDF 병합", "PDF 분할", "PDF 압축"],
     ["/pdf/generate", "/pdf/merge", "/pdf/split", "/pdf/compress"]),
    ("엑셀 export",     ["엑셀 생성", "CSV 변환", "템플릿 적용", "대용량 처리"],
     ["/excel/generate", "/excel/to-csv", "/excel/template/{id}", "/excel/async"]),
    ("인쇄 서버",       ["인쇄 요청", "프린터 상태", "대기열 조회", "취소"],
     ["/print/request", "/print/printer/{id}/status", "/print/queue", "/print/{id}/cancel"]),
]

FLOW_TEMPLATES = [
    ("로그인 → 기본 동작 플로우",  lambda ids: ids[:3] if len(ids) >= 3 else ids),
    ("전체 CRUD 플로우",           lambda ids: ids[:4] if len(ids) >= 4 else ids),
    ("인증 → 핵심 기능 플로우",   lambda ids: [ids[0]] + ids[2:4] if len(ids) >= 4 else ids),
    ("오류 케이스 검증 플로우",    lambda ids: ids[-3:] if len(ids) >= 3 else ids),
]

SUITE_NAMES = [
    ("전체 기본 케이스",   "이번 스프린트 대상 전체 케이스"),
    ("스모크 테스트",     "배포 직후 핵심 경로만 빠르게 검증"),
    ("회귀 테스트 세트",  "이전 버그 재현 방지용 케이스 묶음"),
]

print(f"총 {len(PROJECT_DOMAINS)}개 프로젝트 생성 중...")

for proj_name, cat_names, endpoints in PROJECT_DOMAINS:
    p = models.Project(name=proj_name)
    db.add(p)
    db.flush()
    pid = p.id

    # ── 카테고리 ───────────────────────────────────────────────────────
    cats = [{"id": f"mc{pid}_{i}", "name": n, "color": COLORS[i % len(COLORS)]}
            for i, n in enumerate(cat_names)]

    # ── 케이스 생성 (엔드포인트 기반) ──────────────────────────────────
    cases_mgr, tst_cases, dep_cases = [], [], []
    case_counter = 1
    for ep in endpoints:
        for case_type in ["Positive", "Negative"]:
            cat = cats[case_counter % len(cats)]
            method = "GET" if ep.count("/") <= 2 and "{" not in ep else random.choice(METHODS)
            exp_status = 200 if case_type == "Positive" else random.choice([400, 401, 404])
            pf = random.choices(["Pass", "Fail"], weights=[85, 15])[0]
            cid = f"TC-{str(case_counter).zfill(3)}"
            case_name = f"{cat['name']} {ep.split('/')[-1].replace('{', '').replace('}', '')} {case_type}"
            cases_mgr.append({
                "id": cid, "name": case_name, "type": case_type,
                "method": method, "endpoint": ep, "expectedStatus": exp_status,
                "pf": pf, "owner": random.choice(["김QA", "이테스터", "박검증"]),
                "date": (datetime.now() - timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%dT%H:%M"),
                "catId": cat["id"], "headers": [], "queryParams": [], "body": "",
                "input": f"{method} {ep}", "expected": f"HTTP {exp_status}",
            })
            tst_cases.append({"id": cid, "catId": cat["id"], "actual": f"HTTP {exp_status} 반환",
                              "pf": pf, "owner": "김QA", "date": "2026-06-01", "notes": "", "evidence": []})
            dep_cases.append({"id": cid, "catId": cat["id"], "actual": "정상 동작 확인",
                              "pf": "완료", "owner": "이배포", "date": "2026-06-15", "notes": "", "evidence": []})
            case_counter += 1

    all_case_ids = [c["id"] for c in cases_mgr]

    snap_data = {
        "mgr": {"cats": cats, "cases": cases_mgr},
        "tst": {"cover": {"company": "테스트컴퍼니", "project": proj_name, "version": "v1.0",
                           "environment": "QA", "author": "김QA", "approver": "이리더",
                           "date": "2026-06-17", "start": "2026-06-01", "end": "2026-06-17"},
                "cats": cats, "cases": tst_cases},
        "dep": {"cover": {"company": "테스트컴퍼니", "project": proj_name, "version": "v1.0",
                           "environment": "Production", "deployType": "정기 배포",
                           "deployer": "이배포", "date": "2026-06-17",
                           "target": "api.example.com", "summary": f"{proj_name} 배포 완료"},
                "cats": cats, "cases": dep_cases},
    }
    db.add(models.QASnapshot(project_id=pid, data=snap_data))

    # ── 테스트 플로우 (프로젝트 케이스 기반) ───────────────────────────
    flow_ids = []
    n_flows = min(random.randint(1, 3), len(FLOW_TEMPLATES))
    for fi in range(n_flows):
        tpl_name, tpl_fn = FLOW_TEMPLATES[fi]
        step_case_ids = tpl_fn(all_case_ids)
        steps = [{"case_id": cid, "order": o} for o, cid in enumerate(step_case_ids)]
        f = models.TestFlow(project_id=pid, name=tpl_name, steps=steps)
        db.add(f)
        db.flush()
        flow_ids.append(f.id)

    # ── 자동 실행 이력 ─────────────────────────────────────────────────
    run_ids = []
    n_runs = random.randint(4, 10)
    for ri in range(n_runs):
        run_case_ids = random.sample(all_case_ids, min(random.randint(4, len(all_case_ids)), len(all_case_ids)))
        total = len(run_case_ids)
        fail = random.randint(0, max(1, total // 5))
        started = rnd_dt(days_ago_max=90)
        finished = started + timedelta(seconds=random.randint(30, 300))
        case_results = [
            {"case_id": cid, "pf": "Fail" if i < fail else "Pass",
             "actual": f"HTTP {random.choice([200, 201, 400, 500])}", "notes": ""}
            for i, cid in enumerate(run_case_ids)
        ]
        mgr_snap = [{"id": c["id"], "name": c["name"], "endpoint": c["endpoint"],
                     "method": c["method"], "catId": c["catId"]}
                    for c in cases_mgr if c["id"] in run_case_ids]
        run_flow_ids = random.sample(flow_ids, min(random.randint(0, 2), len(flow_ids)))
        run = models.TestRun(
            project_id=pid,
            base_url=f"https://api-{random.choice(['dev', 'stg', 'prod'])}.example.com",
            status="done", total=total, done=total, fail=fail,
            label=f"Sprint {random.randint(1, 20)} 회귀 테스트" if random.random() > 0.4 else None,
            case_ids=run_case_ids, flow_ids=run_flow_ids,
            case_results=case_results, flow_results=[], mgr_snapshot=mgr_snap,
            started_at=started, finished_at=finished,
        )
        db.add(run)
        db.flush()
        run_ids.append(run.id)

        if random.random() > 0.5:
            for _ in range(random.randint(1, 3)):
                db.add(models.RunComment(
                    run_id=run.id,
                    text=random.choice(["확인 완료", "재실행 필요", "개발팀 공유", "핫픽스 후 재검증", "이슈 제보함"]),
                    created_at=finished + timedelta(minutes=random.randint(1, 60)),
                ))

    # ── 케이스 변경 이력 ───────────────────────────────────────────────
    for _ in range(random.randint(3, 6)):
        c = random.choice(cases_mgr)
        action = random.choices(["created", "updated", "deleted"], weights=[40, 45, 15])[0]
        db.add(models.CaseHistory(
            project_id=pid, case_id=c["id"], action=action,
            before=c if action in ("updated", "deleted") else None,
            after={**c, "name": c["name"] + " (수정)"} if action in ("created", "updated") else None,
            changed_at=rnd_dt(days_ago_max=60),
        ))

    # ── Test Suite (프로젝트 케이스 기반) ──────────────────────────────
    for si, (suite_name, suite_desc) in enumerate(SUITE_NAMES):
        if si == 0:
            # 전체 기본 케이스 — 모든 케이스 포함
            s_case_ids = all_case_ids[:]
            s_flow_ids = flow_ids[:]
        elif si == 1:
            # 스모크 테스트 — Positive 케이스만, 각 카테고리 대표 1개씩
            positive_ids = [c["id"] for c in cases_mgr if c["type"] == "Positive"]
            s_case_ids = positive_ids[:max(3, len(positive_ids) // 2)]
            s_flow_ids = flow_ids[:1] if flow_ids else []
        else:
            # 회귀 테스트 — Negative 케이스 위주
            neg_ids = [c["id"] for c in cases_mgr if c["type"] == "Negative"]
            s_case_ids = neg_ids or all_case_ids[:3]
            s_flow_ids = []

        db.add(models.TestSuite(
            project_id=pid,
            name=suite_name,
            description=f"{proj_name}의 {suite_desc}",
            case_ids=s_case_ids,
            flow_ids=s_flow_ids,
            is_default=(si == 0),
        ))

    # ── 알림 설정 (절반 프로젝트) ──────────────────────────────────────
    if random.random() > 0.5:
        t = random.choice(["discord", "slack"])
        db.add(models.NotificationConfig(
            project_id=pid, name=f"{proj_name} {t.capitalize()} 알림", type=t,
            webhook_url=f"https://hooks.{'discord.com/api/webhooks/00000/DUMMY' if t == 'discord' else 'slack.com/services/T000/B000/DUMMY'}",
            enabled=True, events=["run_completed", "run_failed"],
        ))

    # ── 배포 이력 ──────────────────────────────────────────────────────
    for di in range(random.randint(2, 4)):
        total_c = len(cases_mgr)
        fail_c = random.randint(0, max(1, total_c // 6))
        db.add(models.DeployHistory(
            project_id=pid,
            version=f"v{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,20)}",
            environment=random.choice(ENVIRONMENTS),
            deploy_type=random.choice(DEPLOY_TYPES),
            deployer=random.choice(["김배포", "이DevOps", "박CI"]),
            target_server="api.example.com",
            summary=f"{proj_name} 기능 업데이트 및 버그 수정",
            total_cases=total_c, done_cases=total_c - fail_c, fail_cases=fail_c,
            deployed_at=rnd_dt(days_ago_max=120),
        ))

db.commit()
db.close()

print("✅ 시드 완료!")
# 건수 출력
from database import SessionLocal as S2
db2 = S2()
for name, model in [
    ("projects", models.Project), ("qa_snapshots", models.QASnapshot),
    ("test_flows", models.TestFlow), ("test_runs", models.TestRun),
    ("run_comments", models.RunComment), ("case_histories", models.CaseHistory),
    ("test_suites", models.TestSuite), ("notification_configs", models.NotificationConfig),
    ("deploy_histories", models.DeployHistory),
]:
    print(f"  {name}: {db2.query(model).count()}개")
db2.close()
