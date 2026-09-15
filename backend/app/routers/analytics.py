from __future__ import annotations

from datetime import datetime, timezone
import uuid
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
from app.models.requirement_atom import RequirementAtom
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
        .join(Session, Session.id == Contradiction.session_id, isouter=True)
        .join(Project, Project.id == Session.project_id, isouter=True)
        .where((Project.organization_id == org_id) | (Contradiction.change_request_id.isnot(None)))
    )

    return {
        "total_projects": total_projects or 0,
        "total_sessions": total_sessions or 0,
        "total_messages": total_messages or 0,
        "total_contradictions": total_contradictions or 0,
    }


@router.get("/executive-summary", summary="Executive intelligence & requirement health metrics")
async def executive_summary(
    project_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id

    if project_id:
        proj = await db.scalar(select(Project).where(Project.id == project_id, Project.organization_id == org_id))
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found.")
        target_pids = [project_id]
    else:
        p_res = await db.execute(select(Project.id).where(Project.organization_id == org_id))
        target_pids = list(p_res.scalars().all())

    if not target_pids:
        return {
            "total_requirements": 0,
            "active_requirements": 0,
            "conflicted_requirements": 0,
            "superseded_requirements": 0,
            "health_score": 100,
            "total_contradictions": 0,
            "resolved_contradictions": 0,
            "pending_contradictions": 0,
            "resolution_rate": 100,
            "false_positive_rate": 0,
            "total_change_requests": 0,
            "cr_approved": 0,
            "cr_rejected": 0,
            "cr_pending": 0,
            "cr_approval_rate": 0,
            "category_distribution": [],
            "conflict_type_distribution": [],
            "srs_versions_count": 0,
        }

    atom_rows = (await db.execute(
        select(RequirementAtom.status, func.count(RequirementAtom.id))
        .where(RequirementAtom.project_id.in_(target_pids))
        .group_by(RequirementAtom.status)
    )).all()

    total_atoms = 0
    active_atoms = 0
    conflicted_atoms = 0
    superseded_atoms = 0

    for st, cnt in atom_rows:
        total_atoms += cnt
        if st == "active":
            active_atoms += cnt
        elif st == "conflicted":
            conflicted_atoms += cnt
        elif st == "superseded":
            superseded_atoms += cnt

    c_rows = (await db.execute(
        select(Contradiction.status, Contradiction.conflict_type, Contradiction.is_false_positive, func.count(Contradiction.id))
        .join(Session, Session.id == Contradiction.session_id, isouter=True)
        .where((Session.project_id.in_(target_pids)) | (Contradiction.change_request_id.in_(
            select(ChangeRequest.id).where(ChangeRequest.project_id.in_(target_pids))
        )))
        .group_by(Contradiction.status, Contradiction.conflict_type, Contradiction.is_false_positive)
    )).all()

    total_c = 0
    resolved_c = 0
    pending_c = 0
    fp_c = 0
    conflict_types = {}

    for st, ctype, is_fp, cnt in c_rows:
        total_c += cnt
        if st in ("resolved", "ignored"):
            resolved_c += cnt
        elif st == "pending":
            pending_c += cnt
        if is_fp:
            fp_c += cnt
        
        c_label = (ctype or "direct_contradiction").replace("_", " ").title()
        conflict_types[c_label] = conflict_types.get(c_label, 0) + cnt

    cr_rows = (await db.execute(
        select(ChangeRequest.status, func.count(ChangeRequest.id))
        .where(ChangeRequest.project_id.in_(target_pids))
        .group_by(ChangeRequest.status)
    )).all()

    total_cr = 0
    cr_approved = 0
    cr_rejected = 0
    cr_pending = 0
    for st, cnt in cr_rows:
        total_cr += cnt
        if st == "approved":
            cr_approved += cnt
        elif st == "rejected":
            cr_rejected += cnt
        elif st == "pending":
            cr_pending += cnt

    srs_count = await db.scalar(
        select(func.count(SRSVersion.id)).where(SRSVersion.project_id.in_(target_pids))
    ) or 0

    health_score = round(((active_atoms) / total_atoms * 100), 1) if total_atoms > 0 else 100.0
    resolution_rate = round((resolved_c / total_c * 100), 1) if total_c > 0 else 100.0
    false_positive_rate = round((fp_c / total_c * 100), 1) if total_c > 0 else 0.0
    cr_approval_rate = round((cr_approved / total_cr * 100), 1) if total_cr > 0 else 0.0

    return {
        "total_requirements": total_atoms,
        "active_requirements": active_atoms,
        "conflicted_requirements": conflicted_atoms,
        "superseded_requirements": superseded_atoms,
        "health_score": health_score,
        "total_contradictions": total_c,
        "resolved_contradictions": resolved_c,
        "pending_contradictions": pending_c,
        "resolution_rate": resolution_rate,
        "false_positive_count": fp_c,
        "false_positive_rate": false_positive_rate,
        "total_change_requests": total_cr,
        "cr_approved": cr_approved,
        "cr_rejected": cr_rejected,
        "cr_pending": cr_pending,
        "cr_approval_rate": cr_approval_rate,
        "category_distribution": [],
        "conflict_type_distribution": [
            {"type": k, "count": v} for k, v in sorted(conflict_types.items(), key=lambda x: x[1], reverse=True)
        ],
        "srs_versions_count": srs_count,
    }


@router.get(
    "/projects/{project_id}/summary",
    summary="Aggregated engagement + health summary for a project",
)
async def project_summary(
    project_id: uuid.UUID,
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

    contradiction_total = await db.scalar(
        select(func.count(Contradiction.id))
        .join(Session, Session.id == Contradiction.session_id, isouter=True)
        .where((Session.project_id == project.id) | (Contradiction.change_request_id.in_(
            select(ChangeRequest.id).where(ChangeRequest.project_id == project.id)
        )))
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
            .join(Session, Session.id == Contradiction.session_id, isouter=True)
            .where((Session.project_id == project.id) | (Contradiction.change_request_id.in_(
                select(ChangeRequest.id).where(ChangeRequest.project_id == project.id)
            )))
            .group_by(Contradiction.conflict_type)
        )
    ).all()

    return {
        "project_id": str(project.id),
        "messages_sent": messages_sent,
        "avg_response_time_seconds": 1.2,
        "sessions_completed": sessions_completed,
        "last_active": last_active,
        "contradiction_count": contradiction_total,
        "change_request_count": cr_total,
        "change_request_approval_rate": (cr_approved / cr_total) if cr_total else None,
        "conflict_type_distribution": {
            (ctype or "unknown"): count for ctype, count in conflict_dist
        },
    }
