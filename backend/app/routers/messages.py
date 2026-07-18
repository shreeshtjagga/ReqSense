"""
Messages router — Phase 3 AI Core.

POST /v1/sessions/{session_id}/messages
  1. Sanitize input (RDCD)
  2. Fetch session history from Redis  ← outside DB transaction
  3. Call ARIA via Groq SDK            ← outside DB transaction
  4. Extract requirement atoms (Groq)  ← outside DB transaction
  5. Embed atoms & search Chroma for contradictions ← outside DB transaction
  6. Open ONE atomic DB transaction — write Message, ARIA reply, atoms, contradictions
  7. Store messages in Redis session memory
  Returns the user message (ARIA reply saved separately).

GET /v1/sessions/{session_id}/messages/stream
  SSE streaming of ARIA tokens (best-effort; no DB writes during stream).
"""

import asyncio
import json
import logging
import uuid
from typing import AsyncGenerator, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, get_scoped_project, require_roles
from app.models.contradiction import Contradiction
from app.models.llm_usage_log import LLMUsageLog
from app.models.message import Message
from app.models.requirement_atom import RequirementAtom
from app.models.session import Session
from app.models.user import User
from app.schemas.message import MessageCreate, MessageRead
from app.services.aria_agent import AriaAgent
from app.services.embedding_service import EmbeddingService
from app.services.rdcd_layer import RDCDLayer
from app.services.session_memory import SessionMemory
from app.services.vector_store import VectorStore
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/sessions/{session_id}/messages", tags=["messages"])


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_scoped_active_session(
    session_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> Session:
    """Fetch session, verify access scoping, and ensure session is active."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )
    await get_scoped_project(project_id=session.project_id, user=user, db=db)
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot post to a session that is not active.",
        )
    return session


def _is_test_env() -> bool:
    return settings.GROQ_API_KEY.startswith("test") or settings.GROQ_API_KEY.startswith("mock")


# ── POST ──────────────────────────────────────────────────────────────────────

@router.post("", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(
    session_id: uuid.UUID,
    body: MessageCreate,
    request: Request,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    """
    Append a user message, run ARIA, extract atoms, detect contradictions.
    All external I/O (Groq, Chroma, Redis) completes BEFORE the DB transaction opens.
    A Groq timeout therefore never leaves a half-written DB row.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

    # ── 0. Session gating ────────────────────────────────────────────────────
    session = await _get_scoped_active_session(session_id, current_user, db)

    # ── 1. Sanitize user input (RDCD) — pre-transaction ─────────────────────
    sanitized_content = await RDCDLayer.sanitize_input(
        content=body.content,
        user_id=current_user.id,
        db=db,
        request_id=request_id,
    )

    # ── 2. Fetch session history from Redis — pre-transaction ────────────────
    try:
        history = await SessionMemory.get_messages(session_id)
    except Exception as exc:
        logger.warning("Redis unavailable; proceeding with empty history: %s", exc)
        history = []

    # ── 3. Call ARIA (Groq) — pre-transaction ────────────────────────────────
    aria_result: dict = {}
    prompt_tokens = 0
    completion_tokens = 0
    aria_content = ""
    try:
        aria_result = AriaAgent.generate_response(history, sanitized_content)
        aria_content = aria_result.get("content", "")
        prompt_tokens = aria_result.get("prompt_tokens", 0)
        completion_tokens = aria_result.get("completion_tokens", 0)
    except Exception as exc:
        logger.error("ARIA call failed: %s", exc)
        aria_content = (
            "I'm sorry, I'm having trouble processing your request right now. "
            "Please try again in a moment."
        )

    # ── 4. Extract requirement atoms (Groq) — pre-transaction ────────────────
    extracted_atoms: list = []
    if body.sender in ("client", "user"):
        try:
            extracted_atoms = RDCDLayer.extract_atoms(sanitized_content)
        except Exception as exc:
            logger.warning("Atom extraction failed: %s", exc)

    # ── 5. Embed atoms + search Chroma for contradictions — pre-transaction ──
    # Each element: (atom_dict, existing_atom_dict_or_None, contradiction_result_or_None)
    atom_contradiction_pairs: list = []
    for atom_dict in extracted_atoms:
        raw_text = atom_dict.get("raw_text", sanitized_content)
        chroma_match = None
        contradiction_result = None
        try:
            if not _is_test_env():
                embedding = EmbeddingService.embed(raw_text)
                # Use project_id as a stable UUID key for cross-session contradiction search
                results = VectorStore.query_similar_atoms(
                    session_id=session.project_id,
                    query_embedding=embedding,
                    limit=1,
                )
                if results and results[0]["distance"] < 0.3:
                    chroma_match = results[0]
                    existing_atom_dict = {
                        "raw_text": results[0].get("document", ""),
                        "subject": results[0].get("metadata", {}).get("subject", ""),
                        "action": results[0].get("metadata", {}).get("action", ""),
                        "constraint_text": results[0].get("metadata", {}).get("constraint_text", ""),
                    }
                    contradiction_result = RDCDLayer.detect_contradiction(
                        existing_atom_dict, atom_dict
                    )
            else:
                # Mock: skip Chroma in test env
                pass
        except Exception as exc:
            logger.warning("Chroma/contradiction check failed: %s", exc)

        atom_contradiction_pairs.append((atom_dict, chroma_match, contradiction_result))

    # ── 6. Single atomic DB transaction ──────────────────────────────────────
    # Everything from here is one commit or rollback — no Groq/Chroma calls allowed
    try:
        # Write user message
        user_msg = Message(
            session_id=session_id,
            sender=body.sender,
            content=sanitized_content,
            message_type=body.message_type,
        )
        db.add(user_msg)

        # Write ARIA reply
        aria_msg = Message(
            session_id=session_id,
            sender="aria",
            content=aria_content,
            message_type="normal",
        )
        db.add(aria_msg)

        # Increment session message counter
        session.total_messages = (session.total_messages or 0) + 2
        db.add(session)

        # Write LLM usage log
        if prompt_tokens or completion_tokens:
            usage_log = LLMUsageLog(
                session_id=session_id,
                project_id=session.project_id,
                endpoint="aria_response",
                prompt_version=settings.GROQ_MODEL,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )
            db.add(usage_log)

        # Write requirement atoms + contradictions
        for atom_dict, chroma_match, contradiction_result in atom_contradiction_pairs:
            ra = RequirementAtom(
                session_id=session_id,
                project_id=session.project_id,
                subject=atom_dict.get("subject"),
                action=atom_dict.get("action"),
                constraint_text=atom_dict.get("constraint_text"),
                raw_text=atom_dict.get("raw_text", sanitized_content),
                status="active",
            )
            db.add(ra)

            if (
                contradiction_result
                and contradiction_result.get("conflict_type", "none") != "none"
                and contradiction_result.get("confidence", 0) > 0.0
            ):
                import uuid as _uuid
                c_id = _uuid.uuid4()
                c = Contradiction(
                    id=c_id,
                    session_id=session_id,
                    confidence=contradiction_result.get("confidence"),
                    conflict_type=contradiction_result.get("conflict_type"),
                    aria_message=contradiction_result.get("aria_message", ""),
                    status="pending",
                )
                db.add(c)

                # ── Wire contradiction into chat as a conflict_alert Message ──
                # This is what makes contradictions visible to the client in real
                # time. ConflictAlert.jsx parses this JSON when message_type === 'conflict_alert'.
                conflict_msg = Message(
                    session_id=session_id,
                    sender="aria",
                    message_type="conflict_alert",
                    content=json.dumps({
                        "contradiction_id": str(c_id),
                        "conflict_type": contradiction_result.get("conflict_type"),
                        "aria_message": contradiction_result.get("aria_message", ""),
                        "confidence": contradiction_result.get("confidence"),
                    }),
                )
                db.add(conflict_msg)

                # ── Update session contradiction counter and stability score ──
                session.contradiction_events = (session.contradiction_events or 0) + 1
                # Each contradiction reduces stability by 10 points, floored at 0
                session.stability_score = max(
                    0.0, (session.stability_score if session.stability_score is not None else 100.0) - 10.0
                )

        await db.commit()
        await db.refresh(user_msg)
        await db.refresh(aria_msg)

    except Exception as exc:
        await db.rollback()
        logger.exception("DB transaction failed for message in session %s", session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist message.",
        ) from exc

    # ── 7. Update Redis session memory (after successful commit) ─────────────
    try:
        await SessionMemory.add_message(
            session_id, {"sender": body.sender, "content": sanitized_content}
        )
        await SessionMemory.add_message(
            session_id, {"sender": "aria", "content": aria_content}
        )
    except Exception as exc:
        logger.warning("Failed to update Redis session memory: %s", exc)

    # ── 8. Embed new atoms into Chroma (best-effort, after commit) ───────────
    if not _is_test_env():
        for atom_dict, _, _ in atom_contradiction_pairs:
            try:
                raw_text = atom_dict.get("raw_text", sanitized_content)
                embedding = EmbeddingService.embed(raw_text)
                VectorStore.upsert_atoms(
                    session_id=session.project_id,
                    atoms=[{
                        "id": uuid.uuid4(),
                        "embedding": embedding,
                        "document": raw_text,
                        "metadata": {
                            "subject": atom_dict.get("subject", ""),
                            "action": atom_dict.get("action", ""),
                            "constraint_text": atom_dict.get("constraint_text", ""),
                            "session_id": str(session_id),
                        },
                    }],
                )
            except Exception as exc:
                logger.warning("Chroma upsert failed for atom: %s", exc)

    return user_msg


# ── GET (list) ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[MessageRead])
async def list_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )
    await get_scoped_project(project_id=session.project_id, user=current_user, db=db)

    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


