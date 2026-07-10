"""project_presets table + category_id

이 프로젝트는 신규 테이블/컬럼을 SQLAlchemy의 create_all()로 먼저 반영하고,
기존 테이블 변경분만 수동 ALTER TABLE로 적용해온 이력이 있어 alembic_version이
비어있는 상태였다. 이 리비전은 그 실제 변경 이력을 형상관리 기록으로 남기기 위한
것으로, 개발 DB에는 이미 반영되어 있어 `alembic stamp` 로 적용 처리한다.
신규(빈) DB에 처음부터 적용할 때는 checkfirst 가드 덕분에 안전하게 동작한다.

Revision ID: 677f1b38bb3f
Revises: bfaf53d014da
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '677f1b38bb3f'
down_revision: Union[str, Sequence[str], None] = 'bfaf53d014da'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'project_presets' not in inspector.get_table_names():
        op.create_table(
            'project_presets',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('kind', sa.String(length=20), nullable=False),
            sa.Column('label', sa.String(length=100), nullable=False),
            sa.Column('key', sa.String(length=200), nullable=True),
            sa.Column('value', sa.Text(), nullable=False),
            sa.Column('category_id', sa.String(length=50), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    else:
        cols = {c['name'] for c in inspector.get_columns('project_presets')}
        if 'category_id' not in cols:
            op.add_column('project_presets', sa.Column('category_id', sa.String(length=50), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'project_presets' in inspector.get_table_names():
        cols = {c['name'] for c in inspector.get_columns('project_presets')}
        if 'category_id' in cols:
            op.drop_column('project_presets', 'category_id')
