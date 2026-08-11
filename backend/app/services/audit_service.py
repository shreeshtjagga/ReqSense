import uuid
from typing import Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

async def log_audit_event(
    db: AsyncSession,
    user_id: Optional[uuid.UUID],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[uuid.UUID] = None,
    metadata: Optional[Dict] = None,
    ip_address: Optional[str] = None,
    request_id: Optional[str] = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_=metadata,
        ip_address=ip_address,
        request_id=request_id,
    )
    db.add(entry)
    await db.commit()
    return entry
