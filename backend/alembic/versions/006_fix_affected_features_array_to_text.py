"""Ensure affected_features column in change_requests table is TEXT instead of ARRAY.

Revision ID: 006_fix_affected_features_array_to_text
Revises: 005_drop_email_verified_and_add_invite_token
Create Date: 2026-07-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_fix_affected_features_array_to_text'
down_revision: Union[str, None] = '005_drop_email_verified_and_add_invite_token'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alter affected_features to TEXT using postgresql cast if needed
    op.execute("ALTER TABLE change_requests ALTER COLUMN affected_features TYPE TEXT USING affected_features::text;")


def downgrade() -> None:
    pass
