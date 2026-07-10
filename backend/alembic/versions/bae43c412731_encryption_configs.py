"""encryption_configs table

의도적으로 project_presets와 분리된 전용 테이블 — 나중에 사용자/관리자 권한으로
메뉴 노출을 나눌 수 있도록 별도 관리 화면(/api/encryption-configs)과 짝을 이룬다.
create_all()로 이미 개발 DB에 반영돼 있어 `alembic stamp head`로 적용 처리한다.

Revision ID: bae43c412731
Revises: 677f1b38bb3f
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'bae43c412731'
down_revision: Union[str, Sequence[str], None] = '677f1b38bb3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'encryption_configs' not in inspector.get_table_names():
        op.create_table(
            'encryption_configs',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('label', sa.String(length=100), nullable=False),
            sa.Column('mode', sa.String(length=20), nullable=False, server_default='GCM'),
            sa.Column('key_base64', sa.String(length=100), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'encryption_configs' in inspector.get_table_names():
        op.drop_table('encryption_configs')
