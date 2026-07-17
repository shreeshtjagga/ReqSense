"""
Models package — import every model here so Alembic autogenerate
discovers all tables from a single `import app.models` in env.py.
"""

from app.models.organization import Organization
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.password_reset_token import PasswordResetToken
from app.models.project import Project, ProjectClient
from app.models.session import Session
from app.models.message import Message
from app.models.requirement_atom import RequirementAtom
from app.models.contradiction import Contradiction
from app.models.srs_version import SRSVersion
from app.models.feature_status import FeatureStatus
from app.models.change_request import ChangeRequest
from app.models.audit_log import AuditLog
from app.models.llm_usage_log import LLMUsageLog
from app.models.email_log import EmailLog

__all__ = [
    "Organization",
    "User",
    "RefreshToken",
    "PasswordResetToken",
    "Project",
    "ProjectClient",
    "Session",
    "Message",
    "RequirementAtom",
    "Contradiction",
    "SRSVersion",
    "FeatureStatus",
    "ChangeRequest",
    "AuditLog",
    "LLMUsageLog",
    "EmailLog",
]
