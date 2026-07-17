"""Phase 2 migration — all remaining tables + composite indexes.

Revision ID: 002_phase2_projects_sessions
Revises: 001_initial_schema
Create Date: 2026-07-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002_phase2_projects_sessions'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── email_logs ────────────────────────────────────────────────────────────
    op.create_table('email_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('to_email', sa.String(length=255), nullable=False),
        sa.Column('template', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table('audit_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=True),
        sa.Column('action', sa.String(length=255), nullable=False),
        sa.Column('entity_type', sa.String(length=100), nullable=True),
        sa.Column('entity_id', sa.Uuid(), nullable=True),
        sa.Column('metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)

    # ── change_requests ───────────────────────────────────────────────────────
    op.create_table('change_requests',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('client_id', sa.Uuid(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('affected_features', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('impact_report', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default="'pending'"),
        sa.Column('developer_note', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default="1"),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_change_requests_client_id'), 'change_requests', ['client_id'], unique=False)
    op.create_index(op.f('ix_change_requests_project_id'), 'change_requests', ['project_id'], unique=False)
    # Composite Index (project_id, status)
    op.create_index('ix_change_requests_project_status', 'change_requests', ['project_id', 'status'], unique=False)

    # ── project_clients ───────────────────────────────────────────────────────
    op.create_table('project_clients',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=False),
        sa.Column('client_id', sa.Uuid(), nullable=False),
        sa.Column('invited_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_project_clients_client_id'), 'project_clients', ['client_id'], unique=False)
    op.create_index(op.f('ix_project_clients_project_id'), 'project_clients', ['project_id'], unique=False)

    # ── sessions ──────────────────────────────────────────────────────────────
    op.create_table('sessions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=False),
        sa.Column('client_id', sa.Uuid(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default="'active'"),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_messages', sa.Integer(), nullable=False, server_default="0"),
        sa.Column('drift_events', sa.Integer(), nullable=False, server_default="0"),
        sa.Column('contradiction_events', sa.Integer(), nullable=False, server_default="0"),
        sa.Column('stability_score', sa.Float(), nullable=False, server_default="100.0"),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sessions_client_id'), 'sessions', ['client_id'], unique=False)
    op.create_index(op.f('ix_sessions_project_id'), 'sessions', ['project_id'], unique=False)

    # ── llm_usage_logs ────────────────────────────────────────────────────────
    op.create_table('llm_usage_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=True),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('endpoint', sa.String(length=100), nullable=False),
        sa.Column('prompt_version', sa.String(length=20), nullable=True),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True),
        sa.Column('completion_tokens', sa.Integer(), nullable=True),
        sa.Column('estimated_cost_usd', sa.Numeric(precision=10, scale=6), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_llm_usage_logs_created_at'), 'llm_usage_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_llm_usage_logs_project_id'), 'llm_usage_logs', ['project_id'], unique=False)
    op.create_index(op.f('ix_llm_usage_logs_session_id'), 'llm_usage_logs', ['session_id'], unique=False)

    # ── messages ──────────────────────────────────────────────────────────────
    op.create_table('messages',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=False),
        sa.Column('sender', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_type', sa.String(length=50), nullable=False, server_default="'normal'"),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # Composite Index (session_id, created_at)
    op.create_index('ix_messages_session_created', 'messages', ['session_id', 'created_at'], unique=False)

    # ── requirement_atoms ─────────────────────────────────────────────────────
    op.create_table('requirement_atoms',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=True),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('subject', sa.String(length=255), nullable=True),
        sa.Column('action', sa.String(length=255), nullable=True),
        sa.Column('constraint_text', sa.Text(), nullable=True),
        sa.Column('raw_text', sa.Text(), nullable=False),
        sa.Column('embedding_id', sa.String(length=255), nullable=True),
        sa.Column('embedding_model', sa.String(length=100), nullable=True),
        sa.Column('embedding_version', sa.String(length=30), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default="'active'"),
        sa.Column('turn_number', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_requirement_atoms_project_id'), 'requirement_atoms', ['project_id'], unique=False)
    op.create_index(op.f('ix_requirement_atoms_session_id'), 'requirement_atoms', ['session_id'], unique=False)
    # Composite Index (project_id, created_at)
    op.create_index('ix_requirement_atoms_project_created', 'requirement_atoms', ['project_id', 'created_at'], unique=False)

    # ── srs_versions ──────────────────────────────────────────────────────────
    op.create_table('srs_versions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('session_id', sa.Uuid(), nullable=True),
        sa.Column('version', sa.String(length=20), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=True),
        sa.Column('generated_by', sa.String(length=50), nullable=False, server_default="'system'"),
        sa.Column('change_summary', sa.Text(), nullable=True),
        sa.Column('llm_model', sa.String(length=100), nullable=True),
        sa.Column('prompt_version', sa.String(length=20), nullable=True),
        sa.Column('generation_latency_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_srs_versions_project_id'), 'srs_versions', ['project_id'], unique=False)
    op.create_index(op.f('ix_srs_versions_session_id'), 'srs_versions', ['session_id'], unique=False)

    # ── contradictions ────────────────────────────────────────────────────────
    op.create_table('contradictions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=True),
        sa.Column('atom_1_id', sa.Uuid(), nullable=True),
        sa.Column('atom_2_id', sa.Uuid(), nullable=True),
        sa.Column('similarity_score', sa.Float(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('conflict_type', sa.String(length=100), nullable=True),
        sa.Column('aria_message', sa.Text(), nullable=True),
        sa.Column('client_clarification', sa.Text(), nullable=True),
        sa.Column('resolution', sa.Text(), nullable=True),
        sa.Column('resolved_by', sa.Uuid(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default="'pending'"),
        sa.Column('detected_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['atom_1_id'], ['requirement_atoms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['atom_2_id'], ['requirement_atoms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_contradictions_session_id'), 'contradictions', ['session_id'], unique=False)

    # ── feature_status ────────────────────────────────────────────────────────
    op.create_table('feature_status',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('atom_id', sa.Uuid(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default="'planned'"),
        sa.Column('version', sa.Integer(), nullable=False, server_default="1"),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['atom_id'], ['requirement_atoms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_feature_status_project_id'), 'feature_status', ['project_id'], unique=False)
    # Composite Index (project_id, status)
    op.create_index('ix_feature_status_project_status', 'feature_status', ['project_id', 'status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_feature_status_project_status', table_name='feature_status')
    op.drop_index(op.f('ix_feature_status_project_id'), table_name='feature_status')
    op.drop_table('feature_status')
    op.drop_index(op.f('ix_contradictions_session_id'), table_name='contradictions')
    op.drop_table('contradictions')
    op.drop_index(op.f('ix_srs_versions_session_id'), table_name='srs_versions')
    op.drop_index(op.f('ix_srs_versions_project_id'), table_name='srs_versions')
    op.drop_table('srs_versions')
    op.drop_index('ix_requirement_atoms_project_created', table_name='requirement_atoms')
    op.drop_index(op.f('ix_requirement_atoms_session_id'), table_name='requirement_atoms')
    op.drop_index(op.f('ix_requirement_atoms_project_id'), table_name='requirement_atoms')
    op.drop_table('requirement_atoms')
    op.drop_index('ix_messages_session_created', table_name='messages')
    op.drop_table('messages')
    op.drop_index(op.f('ix_llm_usage_logs_session_id'), table_name='llm_usage_logs')
    op.drop_index(op.f('ix_llm_usage_logs_project_id'), table_name='llm_usage_logs')
    op.drop_index(op.f('ix_llm_usage_logs_created_at'), table_name='llm_usage_logs')
    op.drop_table('llm_usage_logs')
    op.drop_index(op.f('ix_sessions_project_id'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_client_id'), table_name='sessions')
    op.drop_table('sessions')
    op.drop_index(op.f('ix_project_clients_project_id'), table_name='project_clients')
    op.drop_index(op.f('ix_project_clients_client_id'), table_name='project_clients')
    op.drop_table('project_clients')
    op.drop_index('ix_change_requests_project_status', table_name='change_requests')
    op.drop_index(op.f('ix_change_requests_project_id'), table_name='change_requests')
    op.drop_index(op.f('ix_change_requests_client_id'), table_name='change_requests')
    op.drop_table('change_requests')
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_table('email_logs')
