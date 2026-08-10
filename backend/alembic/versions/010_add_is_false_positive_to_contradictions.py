"""Add is_false_positive column to contradictions table.

Revision ID: 010_add_is_false_positive_to_contradictions
Revises: 009_project_closure_request
Create Date: 2026-08-10
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '010_add_is_false_positive_to_contradictions'
down_revision: Union[str, None] = '009_project_closure_request'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'contradictions',
        sa.Column('is_false_positive', sa.Boolean(), nullable=True, server_default=sa.false())
    )


def downgrade() -> None:
    op.drop_column('contradictions', 'is_false_positive')
