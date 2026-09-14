"""011 — add deletion_requested_by and deletion_requested_at to projects.

Revision ID: 011_add_project_deletion_fields
Revises: 010_add_is_false_positive_to_contradictions
Create Date: 2026-09-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '011_add_project_deletion_fields'
down_revision: Union[str, None] = '010_add_is_false_positive_to_contradictions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = [col['name'] for col in insp.get_columns('projects')]
    is_sqlite = bind.dialect.name == "sqlite"

    if 'deletion_requested_by' not in columns:
        op.add_column('projects', sa.Column('deletion_requested_by', sa.Uuid(), nullable=True))
    if 'deletion_requested_at' not in columns:
        op.add_column('projects', sa.Column('deletion_requested_at', sa.DateTime(timezone=True), nullable=True))

    if not is_sqlite:
        op.create_foreign_key(
            'fk_projects_deletion_requested_by',
            'projects',
            'users',
            ['deletion_requested_by'],
            ['id'],
            ondelete='SET NULL',
        )



def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    if not is_sqlite:
        op.drop_constraint('fk_projects_deletion_requested_by', 'projects', type_='foreignkey')
    with op.batch_alter_table('projects') as batch_op:
        batch_op.drop_column('deletion_requested_at')
        batch_op.drop_column('deletion_requested_by')


