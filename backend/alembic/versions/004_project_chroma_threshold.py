"""Add chroma_similarity_threshold to projects.

Revision ID: 004_project_chroma_threshold
Revises: 003_add_project_invite_tokens
Create Date: 2026-07-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '004_project_chroma_threshold'
down_revision: Union[str, None] = '003_add_project_invite_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'projects',
        sa.Column(
            'chroma_similarity_threshold',
            sa.Float(),
            nullable=False,
            server_default='0.3',
        ),
    )


def downgrade() -> None:
    op.drop_column('projects', 'chroma_similarity_threshold')
