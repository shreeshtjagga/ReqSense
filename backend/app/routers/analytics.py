"""
analytics.py — Read-only analytics endpoints for admin/developer dashboards.

All analytics are scoped to the caller's organization.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles
from app.models.change_request import ChangeRequest
from app.models.contradiction import Contradiction
from app.models.message import Message
from app.models.project import Project
from app.models.session import Session
from app.models.srs_version import SRSVersion
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


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


@router.get(
    "/projects/{project_id}/summary",
    summary="Aggregated engagement + health summary for a project",
)
async def project_summary(
    project_id: str,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    project = await db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    sessions_completed = await db.scalar(
        select(func.count(Session.id)).where(
            Session.project_id == project.id,
            Session.status == "completed",
        )
    ) or 0

    messages_sent = await db.scalar(
        select(func.count(Message.id))
        .join(Session, Session.id == Message.session_id)
        .where(
            Session.project_id == project.id,
            Message.sender == "client",
        )
    ) or 0

    last_active = await db.scalar(
        select(func.max(Message.created_at))
        .join(Session, Session.id == Message.session_id)
        .where(Session.project_id == project.id)
    )

    # Avg client→ARIA response time from ordered message pairs
    msg_rows = (
        await db.execute(
            select(Message.sender, Message.created_at, Message.session_id)
            .join(Session, Session.id == Message.session_id)
            .where(Session.project_id == project.id)
            .order_by(Message.session_id, Message.created_at)
        )
    ).all()

    deltas: list[float] = []
    prev_client_at: Optional[datetime] = None
    prev_session = None
    for sender, created_at, session_id in msg_rows:
        if session_id != prev_session:
            prev_client_at = None
            prev_session = session_id
        if sender == "client":
            prev_client_at = _as_utc(created_at)
        elif sender == "aria" and prev_client_at is not None:
            aria_at = _as_utc(created_at)
            if aria_at and aria_at >= prev_client_at:
                deltas.append((aria_at - prev_client_at).total_seconds())
            prev_client_at = None

    avg_response = sum(deltas) / len(deltas) if deltas else None

    contradiction_total = await db.scalar(
        select(func.count(Contradiction.id))
        .join(Session, Session.id == Contradiction.session_id)
        .where(Session.project_id == project.id)
    ) or 0

    cr_total = await db.scalar(
        select(func.count(ChangeRequest.id)).where(ChangeRequest.project_id == project.id)
    ) or 0
    cr_approved = await db.scalar(
        select(func.count(ChangeRequest.id)).where(
            ChangeRequest.project_id == project.id,
            ChangeRequest.status == "approved",
        )
    ) or 0

    conflict_dist = (
        await db.execute(
            select(Contradiction.conflict_type, func.count(Contradiction.id))
            .join(Session, Session.id == Contradiction.session_id)
            .where(Session.project_id == project.id)
            .group_by(Contradiction.conflict_type)
        )
    ).all()

    return {
        "project_id": str(project.id),
        "messages_sent": messages_sent,
        "avg_response_time_seconds": avg_response,
        "sessions_completed": sessions_completed,
        "last_active": last_active,
        "contradiction_count": contradiction_total,
        "change_request_count": cr_total,
        "change_request_approval_rate": (cr_approved / cr_total) if cr_total else None,
        "conflict_type_distribution": {
            (ctype or "unknown"): count for ctype, count in conflict_dist
        },
    }


@router.get(
    "/developer/portfolio",
    summary="Developer portfolio metrics across their projects",
)
async def developer_portfolio(
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id

    project_filter = Project.organization_id == org_id
    if current_user.role == "developer":
        project_filter = (Project.organization_id == org_id) & (
            Project.developer_id == current_user.id
        )

    project_ids = (
        await db.execute(select(Project.id).where(project_filter))
    ).scalars().all()

    if not project_ids:
        return {
            "contradictions_resolved_rate": None,
            "avg_srs_turnaround_hours": None,
            "change_request_approval_rate": None,
        }

    total_c = await db.scalar(
        select(func.count(Contradiction.id))
        .join(Session, Session.id == Contradiction.session_id)
        .where(Session.project_id.in_(project_ids))
    ) or 0

    resolved_c = await db.scalar(
        select(func.count(Contradiction.id))
        .join(Session, Session.id == Contradiction.session_id)
        .where(
            Session.project_id.in_(project_ids),
            Contradiction.status.in_(["resolved", "ignored"]),
        )
    ) or 0

    cr_total = await db.scalar(
        select(func.count(ChangeRequest.id)).where(
            ChangeRequest.project_id.in_(project_ids)
        )
    ) or 0
    cr_approved = await db.scalar(
        select(func.count(ChangeRequest.id)).where(
            ChangeRequest.project_id.in_(project_ids),
            ChangeRequest.status == "approved",
        )
    ) or 0

    # SRS turnaround: session start → first SRS version for that session
    srs_rows = (
        await db.execute(
            select(Session.started_at, SRSVersion.created_at)
            .join(SRSVersion, SRSVersion.session_id == Session.id)
            .where(Session.project_id.in_(project_ids))
        )
    ).all()

    turnaround_hours: list[float] = []
    for started_at, created_at in srs_rows:
        start = _as_utc(started_at)
        end = _as_utc(created_at)
        if start and end and end >= start:
            turnaround_hours.append((end - start).total_seconds() / 3600.0)

    return {
        "contradictions_resolved_rate": (resolved_c / total_c) if total_c else None,
        "avg_srs_turnaround_hours": (
            sum(turnaround_hours) / len(turnaround_hours) if turnaround_hours else None
        ),
        "change_request_approval_rate": (cr_approved / cr_total) if cr_total else None,
    }


@router.get(
    "/conflict-types",
    summary="Org-wide conflict_type distribution for ARIA tuning",
)
async def conflict_type_distribution(
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Contradiction.conflict_type, func.count(Contradiction.id))
            .join(Session, Session.id == Contradiction.session_id)
            .join(Project, Project.id == Session.project_id)
            .where(Project.organization_id == current_user.organization_id)
            .group_by(Contradiction.conflict_type)
        )
    ).all()
    return {
        "distribution": {(ctype or "unknown"): count for ctype, count in rows},
        "total": sum(count for _, count in rows),
    }
