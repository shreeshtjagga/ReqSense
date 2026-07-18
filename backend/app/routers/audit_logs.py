"""
audit_logs.py — Read-only audit log endpoints (admin only).

Audit logs are append-only records created by app.services.audit_service.
No writes happen through this router — it is purely a read interface.
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", summary="List audit log entries (admin only)")
async def list_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity_type"),
    entity_id: Optional[uuid.UUID] = Query(None, description="Filter by entity_id"),
    user_id: Optional[uuid.UUID] = Query(None, description="Filter by acting user"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """
    Returns audit log entries in reverse chronological order.
    Only accessible by admins — audit logs are organisation-wide.
    """
    q = select(AuditLog).order_by(AuditLog.created_at.desc())

    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.where(AuditLog.entity_id == entity_id)
    if user_id:
        q = q.where(AuditLog.user_id == user_id)

    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    logs = result.scalars().all()

    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id) if log.entity_id else None,
            "metadata": log.metadata_,
            "ip_address": log.ip_address,
            "request_id": log.request_id,
            "created_at": log.created_at,
        }
        for log in logs
    ]
