from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    snapshots = relationship("QASnapshot", back_populates="project", cascade="all, delete-orphan")
    deploy_histories = relationship("DeployHistory", back_populates="project", cascade="all, delete-orphan")
    test_runs = relationship("TestRun", back_populates="project", cascade="all, delete-orphan")
    test_flows = relationship("TestFlow", back_populates="project", cascade="all, delete-orphan")
    notification_configs = relationship("NotificationConfig", back_populates="project", cascade="all, delete-orphan")
    case_histories = relationship("CaseHistory", back_populates="project", cascade="all, delete-orphan")
    test_suites = relationship("TestSuite", back_populates="project", cascade="all, delete-orphan")
    presets = relationship("ProjectPreset", back_populates="project", cascade="all, delete-orphan")
    encryption_configs = relationship("EncryptionConfig", back_populates="project", cascade="all, delete-orphan")


class QASnapshot(Base):
    """전체 QA 데이터 스냅샷 (HTML의 db 객체 그대로 저장)"""
    __tablename__ = "qa_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    data = Column(JSON, nullable=False)  # HTML의 db 객체 전체
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="snapshots")


class DeployHistory(Base):
    """배포 이력 (LLM 분석용 별도 저장)"""
    __tablename__ = "deploy_histories"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    version = Column(String(100))
    environment = Column(String(50))
    deploy_type = Column(String(100))
    deployer = Column(String(100))
    target_server = Column(String(255))
    summary = Column(Text)
    total_cases = Column(Integer, default=0)
    done_cases = Column(Integer, default=0)
    fail_cases = Column(Integer, default=0)
    deployed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="deploy_histories")


class TestRun(Base):
    """OpenAPI 기반 자동 실행 작업 상태 및 결과 히스토리"""
    __tablename__ = "test_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    base_url = Column(String(500))
    status = Column(String(20), default="pending")  # pending | running | done | failed
    total = Column(Integer, default=0)
    done = Column(Integer, default=0)
    fail = Column(Integer, default=0)
    error = Column(Text)
    label = Column(String(255), nullable=True)             # 사용자 지정 레이블
    case_ids = Column(JSON, nullable=True)                 # 실행한 개별 케이스 ID 목록
    flow_ids = Column(JSON, nullable=True)                 # 실행한 플로우 ID 목록
    case_results = Column(JSON, nullable=True)             # 케이스별 결과 스냅샷
    flow_results = Column(JSON, nullable=True)             # 플로우별 결과 스냅샷
    mgr_snapshot = Column(JSON, nullable=True)             # 실행 시점 케이스 내용 스냅샷 (id/name/endpoint/method/catId)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))

    project = relationship("Project", back_populates="test_runs")
    comments = relationship("RunComment", back_populates="run", cascade="all, delete-orphan",
                            order_by="RunComment.created_at")


class RunComment(Base):
    """실행 히스토리에 남기는 메모/댓글"""
    __tablename__ = "run_comments"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    run = relationship("TestRun", back_populates="comments")


class TestFlow(Base):
    """순서가 고정된 테스트 플로우 (결제, 회원가입 등 업무 단위)"""
    __tablename__ = "test_flows"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    steps = Column(JSON, nullable=False, default=list)  # [{"case_id": str, "order": int}]
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="test_flows")


class NotificationConfig(Base):
    """프로젝트별 알림 설정 (Discord / Slack 웹훅)"""
    __tablename__ = "notification_configs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)           # 식별용 이름
    type = Column(String(20), nullable=False)            # "discord" | "slack"
    webhook_url = Column(String(500), nullable=False)
    enabled = Column(Boolean, default=True)
    events = Column(JSON, default=list)                  # ["run_completed", "run_failed"]
    attach_excel = Column(Boolean, default=False)        # Discord 알림 시 Excel 첨부 여부
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="notification_configs")


class ProjectPreset(Base):
    """프로젝트별로 저장해두고 재사용하는 헤더/URL/파라미터 값"""
    __tablename__ = "project_presets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    kind = Column(String(20), nullable=False)    # "header" | "url" | "param" | "path" | "body" | "assertion_path"
    label = Column(String(100), nullable=False)  # 식별용 이름 (예: "인증 토큰")
    key = Column(String(200), nullable=True)      # header/param의 키 (url/path는 사용 안 함)
    value = Column(Text, nullable=False)
    category_id = Column(String(50), nullable=True)  # 지정 시 해당 카테고리 선택할 때 자동 적용됨 (mgr.cats의 id)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="presets")


class EncryptionConfig(Base):
    """프로젝트별 암복호화 설정 — 저장된 값(프리셋)과 별개의 전용 테이블/화면으로 관리
    (추후 사용자/관리자 권한으로 메뉴 노출을 나눌 수 있도록 의도적으로 분리)"""
    __tablename__ = "encryption_configs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    label = Column(String(100), nullable=False)   # 식별용 이름 (예: "결제 암호화 키")
    mode = Column(String(20), nullable=False, default="GCM")  # 현재는 GCM만 지원
    key_base64 = Column(String(100), nullable=False)  # AES-256 키 32바이트를 Base64로 저장
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="encryption_configs")


class CaseHistory(Base):
    """케이스 변경 이력 — qa_snapshot 저장 시 mgr.cases diff 자동 기록"""
    __tablename__ = "case_histories"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    case_id = Column(String(100), nullable=False, index=True)
    action = Column(String(20), nullable=False)          # "created" | "updated" | "deleted"
    before = Column(JSON, nullable=True)                 # 변경 전 케이스 전체
    after = Column(JSON, nullable=True)                  # 변경 후 케이스 전체
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="case_histories")


class TestSuite(Base):
    """프로젝트 비즈니스 로직 단위 묶음 — 케이스+플로우 세트를 이름 붙여 저장"""
    __tablename__ = "test_suites"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    case_ids = Column(JSON, default=list)    # ["TC-001", ...]
    flow_ids = Column(JSON, default=list)    # [1, 2, ...]
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="test_suites")
