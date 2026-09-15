from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles
from app.models.audit_log import AuditLog
from app.models.project import Project
from app.models.change_request import ChangeRequest
from app.models.user import User

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


def _generate_event_summary(action: str, entity_type: Optional[str], metadata: Optional[dict], actor_name: str, entity_label: Optional[str]) -> str:
    act = (action or "").lower()
    meta = metadata or {}
    target = entity_label or (f"{entity_type} #{meta.get('id', '')[:8]}" if entity_type and meta.get('id') else entity_type or "")

    if act == "login":
        return f"{actor_name} logged into the platform"
    elif act == "logout":
        return f"{actor_name} logged out"
    elif act == "register":
        return f"New account registered: {target or actor_name}"
    elif act in ("admin_create_user", "create_user"):
        return f"{actor_name} created user account {target}"
    elif act in ("admin_update_user", "update_user"):
        return f"{actor_name} updated user profile {target}"
    elif act in ("admin_delete_user", "delete_user"):
        return f"{actor_name} deactivated/deleted user {target}"
    elif act == "project_created":
        return f"{actor_name} created project '{target}'"
    elif act == "project_updated":
        return f"{actor_name} updated settings for project '{target}'"
    elif act == "project_deleted":
        return f"{actor_name} deleted project '{target}'"
    elif act == "project_closure_requested":
        return f"{actor_name} requested project closure for '{target}'"
    elif act == "project_closure_approved":
        return f"{actor_name} approved closure for project '{target}'"
    elif act == "project_closure_rejected":
        return f"{actor_name} rejected closure request for '{target}'"
    elif act == "change_request_created":
        return f"{actor_name} submitted change request '{target}'"
    elif act == "change_request_reviewed":
        st = meta.get("status", "reviewed")
        return f"{actor_name} {st} change request '{target}'"
    elif act == "contradiction_resolved":
        res_action = meta.get("action", "resolved")
        return f"{actor_name} resolved requirement conflict ({res_action})"
    elif act == "suspicious_input_flagged":
        return f"Security shield flagged suspicious input / prompt injection pattern"
    elif act == "srs_generated":
        return f"{actor_name} generated new SRS document version for '{target}'"
    
    clean_action = action.replace("_", " ").title() if action else "System Event"
    if target:
        return f"{actor_name}: {clean_action} on {target}"
    return f"{actor_name}: {clean_action}"


def _get_category(action: str, entity_type: Optional[str]) -> str:
    act = (action or "").lower()
    ent = (entity_type or "").lower()
    if any(k in act for k in ["login", "logout", "register", "password", "token"]):
        return "Auth & Access"
    if any(k in act for k in ["user", "account", "invite"]):
        return "User Management"
    if any(k in act for k in ["change_request", "cr_"]):
        return "Change Requests"
    if any(k in act for k in ["contradiction", "conflict", "srs", "atom", "requirement"]):
        return "Requirements & SRS"
    if any(k in act for k in ["suspicious", "injection", "shield", "security", "blocked"]):
        return "Security & ARIA Shield"
    if any(k in ent for k in ["project"]) or any(k in act for k in ["project"]):
        return "Projects"
    return "Platform Activity"


@router.get("", summary="List audit log entries (admin only)")
async def list_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity_type"),
    entity_id: Optional[uuid.UUID] = Query(None, description="Filter by entity_id"),
    user_id: Optional[uuid.UUID] = Query(None, description="Filter by acting user"),
    category: Optional[str] = Query(None, description="Filter by high level category"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    q = select(AuditLog).order_by(AuditLog.created_at.desc())

    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.where(AuditLog.entity_id == entity_id)
    if user_id:
        q = q.where(AuditLog.user_id == user_id)

    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    logs = list(result.scalars().all())

    user_ids = {log.user_id for log in logs if log.user_id}
    users_map = {}
    if user_ids:
        u_res = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in u_res.scalars().all():
            users_map[u.id] = u

    project_entity_ids = {log.entity_id for log in logs if log.entity_type == "project" and log.entity_id}
    projects_map = {}
    if project_entity_ids:
        p_res = await db.execute(select(Project).where(Project.id.in_(project_entity_ids)))
        for p in p_res.scalars().all():
            projects_map[p.id] = p.name

    cr_entity_ids = {log.entity_id for log in logs if log.entity_type == "change_request" and log.entity_id}
    cr_map = {}
    if cr_entity_ids:
        cr_res = await db.execute(select(ChangeRequest).where(ChangeRequest.id.in_(cr_entity_ids)))
        for cr in cr_res.scalars().all():
            cr_map[cr.id] = cr.title

    enriched = []
    for log in logs:
        actor = users_map.get(log.user_id)
        actor_name = actor.name if actor else ("System Service" if not log.user_id else "User")
        actor_email = actor.email if actor else None
        actor_role = actor.role if actor else ("system" if not log.user_id else None)

        meta = log.metadata_ or {}
        
        entity_label = None
        if log.entity_type == "project":
            entity_label = projects_map.get(log.entity_id) or meta.get("project_name") or (f"Project {str(log.entity_id)[:8]}" if log.entity_id else "Project")
        elif log.entity_type == "user":
            target_user = users_map.get(log.entity_id)
            entity_label = target_user.name if target_user else meta.get("user_email") or meta.get("email") or (f"User {str(log.entity_id)[:8]}" if log.entity_id else "User")
        elif log.entity_type == "change_request":
            entity_label = cr_map.get(log.entity_id) or meta.get("title") or (f"Change Request {str(log.entity_id)[:8]}" if log.entity_id else "Change Request")
        elif meta.get("name") or meta.get("title"):
            entity_label = meta.get("name") or meta.get("title")

        event_summary = _generate_event_summary(log.action, log.entity_type, meta, actor_name, entity_label)
        cat = _get_category(log.action, log.entity_type)

        if category and category.lower() != "all" and cat.lower() != category.lower():
            continue

        enriched.append({
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "actor_name": actor_name,
            "actor_email": actor_email,
            "actor_role": actor_role,
            "action": log.action,
            "category": cat,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id) if log.entity_id else None,
            "entity_label": entity_label,
            "event_summary": event_summary,
            "metadata": meta,
            "ip_address": log.ip_address,
            "request_id": log.request_id,
            "created_at": log.created_at,
        })

    return enriched
