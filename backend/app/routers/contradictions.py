import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_scoped_project
from app.models.contradiction import Contradiction
from app.models.requirement_atom import RequirementAtom
from app.models.session import Session
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.contradiction import ContradictionRead, ContradictionResolve

router = APIRouter(prefix="/contradictions", tags=["contradictions"])

def _atom_display_text(atom: Optional[RequirementAtom]) -> Optional[str]:
    if not atom:
        return None
    parts = []
    if atom.subject:
        parts.append(atom.subject)
    if atom.action:
        parts.append(atom.action)
    if atom.constraint_text:
        parts.append(f"({atom.constraint_text})")
    if parts:
        return " — ".join(parts)
    return atom.raw_text or None

async def _enrich(c: Contradiction, db: AsyncSession) -> ContradictionRead:
    atom_1 = await db.get(RequirementAtom, c.atom_1_id) if c.atom_1_id else None
    atom_2 = await db.get(RequirementAtom, c.atom_2_id) if c.atom_2_id else None

    data = ContradictionRead.model_validate(c)
    data.atom_1_text = _atom_display_text(atom_1)
    data.atom_2_text = _atom_display_text(atom_2)
    return data

@router.get("/project/{project_id}", response_model=List[ContradictionRead])
async def list_contradictions_for_project(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    await get_scoped_project(project_id, current_user, db)

    from app.models.change_request import ChangeRequest

    session_ids_res = await db.execute(
        select(Session.id).where(Session.project_id == project_id)
    )
    session_ids = [row[0] for row in session_ids_res.all()]

    cr_ids_res = await db.execute(
        select(ChangeRequest.id).where(ChangeRequest.project_id == project_id)
    )
    cr_ids = [row[0] for row in cr_ids_res.all()]

    from sqlalchemy import or_

    conditions = []
    if session_ids:
        conditions.append(Contradiction.session_id.in_(session_ids))
    if cr_ids:
        conditions.append(Contradiction.change_request_id.in_(cr_ids))

    if not conditions:
        return []

    result = await db.execute(
        select(Contradiction)
        .where(or_(*conditions))
        .order_by(Contradiction.detected_at.desc())
        .limit(min(limit, 200))
        .offset(offset)
    )
    rows = result.scalars().all()
    return [await _enrich(c, db) for c in rows]

@router.get("/session/{session_id}", response_model=List[ContradictionRead])
async def list_contradictions_for_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    session_res = await db.execute(select(Session).where(Session.id == session_id))
    session = session_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    await get_scoped_project(session.project_id, current_user, db)

    result = await db.execute(
        select(Contradiction)
        .where(Contradiction.session_id == session_id)
        .order_by(Contradiction.detected_at.desc())
        .limit(min(limit, 200))
        .offset(offset)
    )
    rows = result.scalars().all()
    return [await _enrich(c, db) for c in rows]

@router.patch("/{id}", response_model=ContradictionRead)
async def resolve_contradiction(
    id: uuid.UUID,
    body: ContradictionResolve,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db)
):
    c = await db.get(Contradiction, id)
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contradiction not found."
        )

    session = None
    target_project_id = None
    if c.session_id:
        session_res = await db.execute(select(Session).where(Session.id == c.session_id))
        session = session_res.scalar_one_or_none()
        if session:
            target_project_id = session.project_id

    if not target_project_id and c.change_request_id:
        from app.models.change_request import ChangeRequest
        cr_res = await db.execute(select(ChangeRequest).where(ChangeRequest.id == c.change_request_id))
        cr = cr_res.scalar_one_or_none()
        if cr:
            target_project_id = cr.project_id

    if not target_project_id and c.atom_1_id:
        atom_1_res = await db.get(RequirementAtom, c.atom_1_id)
        if atom_1_res:
            target_project_id = atom_1_res.project_id

    if not target_project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource associated with contradiction not found."
        )

    await get_scoped_project(target_project_id, current_user, db)

    c.status = body.action
    c.resolution = body.resolution or f"Marked as {body.action} by developer."
    c.is_false_positive = body.is_false_positive if body.is_false_positive is not None else False
    c.resolved_by = current_user.id
    c.resolved_at = datetime.now(timezone.utc)

    atom_1 = await db.get(RequirementAtom, c.atom_1_id) if c.atom_1_id else None
    atom_2 = await db.get(RequirementAtom, c.atom_2_id) if c.atom_2_id else None

    from app.services.vector_store import VectorStore

    if body.action == "resolved":
        if atom_1:
            atom_1.status = "superseded"
            db.add(atom_1)
            try:
                VectorStore.update_atom_status(target_project_id, atom_1.id, "superseded")
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning("Failed to sync atom_1 superseded status to Chroma: %s", exc)

        if atom_2:
            atom_2.status = "active"
            db.add(atom_2)

        if session:
            session.stability_score = min(100.0, (session.stability_score or 0) + 10.0)
            db.add(session)

    elif body.action == "ignored":
        if atom_1:
            atom_1.status = "active"
            db.add(atom_1)
        if atom_2:
            atom_2.status = "active"
            db.add(atom_2)

    audit = AuditLog(
        user_id=current_user.id,
        action="resolve_contradiction",
        entity_type="contradiction",
        entity_id=c.id,
        metadata_={"action_taken": body.action, "resolution_note": body.resolution, "is_false_positive": body.is_false_positive}
    )
    db.add(audit)
    db.add(c)
    await db.commit()
    await db.refresh(c)

    return await _enrich(c, db)
