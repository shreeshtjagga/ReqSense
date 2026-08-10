"""Drop llm_usage_logs table — feature removed, never surfaced in UI.

Revision ID: 008_drop_llm_usage_logs
Revises: 007_add_contradiction_source
Create Date: 2026-08-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '008_drop_llm_usage_logs'
down_revision: Union[str, None] = '007_add_contradiction_source'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_llm_usage_logs_session_id', table_name='llm_usage_logs')
    op.drop_index('ix_llm_usage_logs_project_id', table_name='llm_usage_logs')
    op.drop_index('ix_llm_usage_logs_created_at', table_name='llm_usage_logs')
    op.drop_table('llm_usage_logs')


def downgrade() -> None:
    op.create_table(
        'llm_usage_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=True),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('endpoint', sa.String(100), nullable=False),
        sa.Column('prompt_version', sa.String(20), nullable=True),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True),
        sa.Column('completion_tokens', sa.Integer(), nullable=True),
        sa.Column('estimated_cost_usd', sa.Numeric(10, 6), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
