"""Add mutual-acceptance closure request fields to projects.

Revision ID: 009_project_closure_request
Revises: 008_drop_llm_usage_logs
Create Date: 2026-08-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '009_project_closure_request'
down_revision: Union[str, None] = '008_drop_llm_usage_logs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('closure_requested_by', sa.Uuid(), nullable=True))
    op.add_column('projects', sa.Column('closure_requested_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        'fk_projects_closure_requested_by', 'projects', 'users',
        ['closure_requested_by'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_projects_closure_requested_by', 'projects', type_='foreignkey')
    op.drop_column('projects', 'closure_requested_at')
    op.drop_column('projects', 'closure_requested_by')
