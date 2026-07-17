"""Analytics schemas — admin dashboard aggregates."""
from pydantic import BaseModel


class ProjectAnalytics(BaseModel):
    total_sessions: int
    total_messages: int
    total_contradictions: int
    resolved_contradictions: int
    avg_stability_score: float
    total_srs_versions: int


class PlatformAnalytics(BaseModel):
    total_organizations: int
    total_users: int
    total_projects: int
    total_sessions: int
    total_messages: int
    total_contradictions: int
