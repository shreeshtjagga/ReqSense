"""Add source and change_request_id to contradictions table.

source: 'chat' (default) or 'change_request'
change_request_id: FK to change_requests.id (nullable, SET NULL on delete)

Revision ID: 007_add_contradiction_source
Revises: 006_fix_affected_features_array_to_text
Create Date: 2026-08-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '007_add_contradiction_source'
down_revision: Union[str, None] = '006_fix_affected_features_array_to_text'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add source column — defaults to 'chat' for all existing rows
    op.add_column(
        'contradictions',
        sa.Column('source', sa.String(20), nullable=False, server_default=sa.text("'chat'")),
    )
    # Add nullable FK to change_requests
    op.add_column(
        'contradictions',
        sa.Column('change_request_id', sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        'fk_contradictions_change_request',
        'contradictions', 'change_requests',
        ['change_request_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_contradictions_change_request', 'contradictions', type_='foreignkey')
    op.drop_column('contradictions', 'change_request_id')
    op.drop_column('contradictions', 'source')
