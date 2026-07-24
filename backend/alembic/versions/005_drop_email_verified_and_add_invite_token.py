"""Drop email_verified column from users and add token/accepted_at to project_invite_tokens.

Revision ID: 005_drop_email_verified_and_add_invite_token
Revises: 004_project_chroma_threshold
Create Date: 2026-07-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_drop_email_verified_and_add_invite_token'
down_revision: Union[str, None] = '004_project_chroma_threshold'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop email_verified from users if present
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('email_verified')

    # Add token and accepted_at to project_invite_tokens
    with op.batch_alter_table('project_invite_tokens') as batch_op:
        batch_op.add_column(sa.Column('token', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index('ix_project_invite_tokens_token', ['token'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('project_invite_tokens') as batch_op:
        batch_op.drop_index('ix_project_invite_tokens_token')
        batch_op.drop_column('accepted_at')
        batch_op.drop_column('token')

    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('email_verified', sa.Boolean(), server_default='0', nullable=False))
