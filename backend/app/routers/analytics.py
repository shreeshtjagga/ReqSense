"""
analytics.py — Read-only analytics endpoints for admin/developer dashboards.

All analytics are scoped to the caller's organization.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles
from app.models.contradiction import Contradiction
from app.models.message import Message
from app.models.project import Project
from app.models.session import Session
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", summary="High-level platform stats for the caller's org")
async def analytics_overview(
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    """Return total projects, sessions, messages, and contradictions for the org."""
    org_id = current_user.organization_id

    total_projects = await db.scalar(
        select(func.count(Project.id)).where(Project.organization_id == org_id)
    )
    total_sessions = await db.scalar(
        select(func.count(Session.id))
        .join(Project, Project.id == Session.project_id)
        .where(Project.organization_id == org_id)
    )
    total_messages = await db.scalar(
        select(func.count(Message.id))
        .join(Session, Session.id == Message.session_id)
        .join(Project, Project.id == Session.project_id)
        .where(Project.organization_id == org_id)
    )
    total_contradictions = await db.scalar(
        select(func.count(Contradiction.id))
        .join(Session, Session.id == Contradiction.session_id)
        .join(Project, Project.id == Session.project_id)
        .where(Project.organization_id == org_id)
    )

    return {
        "total_projects": total_projects or 0,
        "total_sessions": total_sessions or 0,
        "total_messages": total_messages or 0,
        "total_contradictions": total_contradictions or 0,
    }


@router.get(
    "/projects/{project_id}/stability",
    summary="Stability score trend for a project",
)
async def project_stability(
    project_id: str,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    """Return stability_score and contradiction_events per session for a project."""
    result = await db.execute(
        select(
            Session.id,
            Session.started_at,
            Session.stability_score,
            Session.contradiction_events,
            Session.total_messages,
        )
        .join(Project, Project.id == Session.project_id)
        .where(
            Session.project_id == project_id,
            Project.organization_id == current_user.organization_id,
        )
        .order_by(Session.started_at)
    )
    rows = result.all()
    return [
        {
            "session_id": str(r.id),
            "started_at": r.started_at,
            "stability_score": r.stability_score,
            "contradiction_events": r.contradiction_events,
            "total_messages": r.total_messages,
        }
        for r in rows
    ]
