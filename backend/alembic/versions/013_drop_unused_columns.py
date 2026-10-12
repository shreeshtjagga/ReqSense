"""013 - drop unused columns from requirement_atoms and sessions

Revision ID: 013_drop_unused_columns
Revises: 012_drop_unused_tables
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '013_drop_unused_columns'
down_revision: Union[str, None] = '012_drop_unused_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop unused columns from requirement_atoms
    with op.batch_alter_table('requirement_atoms', schema=None) as batch_op:
        batch_op.drop_column('embedding_model')
        batch_op.drop_column('embedding_version')
        batch_op.drop_column('turn_number')

    # Drop unused column from sessions
    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.drop_column('drift_events')


def downgrade() -> None:
    with op.batch_alter_table('sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('drift_events', sa.Integer(), nullable=False, server_default=sa.text('0')))

    with op.batch_alter_table('requirement_atoms', schema=None) as batch_op:
        batch_op.add_column(sa.Column('turn_number', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('embedding_version', sa.String(30), nullable=True))
        batch_op.add_column(sa.Column('embedding_model', sa.String(100), nullable=True))
