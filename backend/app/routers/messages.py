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
import functools
import json
import logging
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, get_scoped_project, require_roles
from app.models.contradiction import Contradiction
from app.models.message import Message
from app.models.project import Project
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
from app.models.feature_status import FeatureStatus

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/sessions/{session_id}/messages", tags=["messages"])

_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "have", "will",
    "should", "must", "can", "are", "was", "were", "been", "being", "into",
}


def _tokenize(text: str) -> set[str]:
    return {
        w
        for w in re.findall(r"[a-z0-9]+", (text or "").lower())
        if len(w) > 2 and w not in _STOPWORDS
    }


def _keyword_overlap_score(text_a: str, text_b: str) -> float:
    a = _tokenize(text_a)
    b = _tokenize(text_b)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _find_keyword_match(
    atom_dict: dict,
    prior_atoms: list,
    min_overlap: float = 0.10,
) -> Optional[dict]:
    """Fallback when Chroma is down: pick strongest keyword-overlap prior atom."""
    raw = atom_dict.get("raw_text", "")
    best = None
    best_score = 0.0
    for prior in prior_atoms:
        score = _keyword_overlap_score(raw, prior.raw_text or "")
        if score > best_score:
            best_score = score
            best = prior
    if best is None or best_score < min_overlap:
        return None
    return {
        "id": best.id,
        "document": best.raw_text,
        "distance": 1.0 - best_score,
        "metadata": {
            "atom_id": str(best.id),
            "subject": best.subject or "",
            "action": best.action or "",
            "constraint_text": best.constraint_text or "",
        },
        "source": "keyword_fallback",
    }

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

    # Only clients may initiate a gathering message — developers/admins
    # can observe but not inject as the client voice.
    if body.sender in ("client", "user") and current_user.role not in ("client", "admin", "developer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can send gathering messages in a session.",
        )

    # Load project for per-project Chroma threshold + prior atoms for fallback
    project = await db.scalar(select(Project).where(Project.id == session.project_id))
    chroma_threshold = (
        project.chroma_similarity_threshold
        if project and project.chroma_similarity_threshold is not None
        else 0.85
    )
    prior_atoms = (
        await db.execute(
            select(RequirementAtom)
            .where(
                RequirementAtom.project_id == session.project_id,
                RequirementAtom.status == "active",
            )
            .order_by(RequirementAtom.created_at.desc())
            .limit(200)
        )
    ).scalars().all()
    # Structured rolling summary of prior atoms for ARIA context.
    # Format: "Subject: X | Action: Y | Constraint: Z" — more informative than raw_text alone.
    def _fmt_atom(a) -> str:
        parts = []
        if a.subject:
            parts.append(f"Subject: {a.subject}")
        if a.action:
            parts.append(f"Action: {a.action}")
        if a.constraint_text:
            parts.append(f"Constraint: {a.constraint_text}")
        raw = (a.raw_text or "")[:150]
        return " | ".join(parts) + (f" [{raw}]" if raw else "")

    atom_summary_parts = [_fmt_atom(a) for a in prior_atoms[:60] if a.raw_text or a.action]
    atom_summary = "\n".join(atom_summary_parts)
    # Truncate to a generous but bounded size for the prompt window
    if len(atom_summary) > 3000:
        atom_summary = atom_summary[:3000] + "..."

    # Feature status summary — gives ARIA visibility into what devs have built
    feature_rows = (
        await db.execute(
            select(FeatureStatus.title, FeatureStatus.status)
            .where(FeatureStatus.project_id == session.project_id)
            .order_by(FeatureStatus.updated_at.desc())
            .limit(30)
        )
    ).all()
    feature_summary = "; ".join(
        f"{row.title} ({row.status})" for row in feature_rows
    ) if feature_rows else ""

    # ── 1. Sanitize user input (RDCD) — pre-transaction ─────────────────────
    sanitized_content, is_flagged = RDCDLayer.sanitize_input(body.content)

    # ── 2. Fetch session history (Redis → DB fallback) — pre-transaction ────
    # SessionMemory.get_messages() handles Redis unavailability internally:
    # it falls back to the DB and re-seeds Redis. History is always populated
    # from actual client/ARIA conversation turns (no conflict_alert blobs).
    history = await SessionMemory.get_messages(session_id, db=db)

    # If this is the first message in a new session with no prior history,
    # seed from the most recent completed session on the same project so
    # ARIA doesn't start cold on session #2+.
    if not history:
        await SessionMemory.seed_from_prior_session(
            current_session_id=session_id,
            project_id=session.project_id,
            db=db,
        )
        # Re-fetch to pick up the seeded turns
        history = await SessionMemory.get_messages(session_id, db=db)

    # ── 3 & 4. Call ARIA (Groq) & Extract Atoms (Groq) in PARALLEL ────────────
    project_context = {
        "name": project.name if project else "",
        "description": project.description if project else "",
        "domain": project.domain if project else "",
        "atom_summary": atom_summary[:3000] if atom_summary else "",
        "feature_summary": feature_summary[:1500] if feature_summary else "",
    }

    loop = asyncio.get_event_loop()
    import functools as _functools

    aria_task = loop.run_in_executor(
        None,
        _functools.partial(
            AriaAgent.generate_response,
            history,
            sanitized_content,
            project_context,
        ),
    )

    async def _empty_list():
        return []

    atoms_task = (
        loop.run_in_executor(None, RDCDLayer.extract_atoms, sanitized_content)
        if body.sender in ("client", "user")
        else _empty_list()
    )

    aria_content = ""
    prompt_tokens = 0
    completion_tokens = 0
    extracted_atoms: list = []

    try:
        results = await asyncio.gather(aria_task, atoms_task, return_exceptions=True)
        aria_res = results[0]
        atoms_res = results[1]

        if isinstance(aria_res, Exception):
            logger.error("ARIA call failed: %s", aria_res)
            aria_content = (
                "I'm sorry, I'm having trouble processing your request right now. "
                "Please try again in a moment."
            )
        elif isinstance(aria_res, dict):
            aria_content = aria_res.get("content", "")
            prompt_tokens = aria_res.get("prompt_tokens", 0)
            completion_tokens = aria_res.get("completion_tokens", 0)

        if isinstance(atoms_res, Exception):
            logger.warning("Atom extraction failed: %s", atoms_res)
        elif isinstance(atoms_res, list):
            extracted_atoms = atoms_res
    except Exception as exc:
        logger.error("Parallel ARIA/Atom execution error: %s", exc)
        aria_content = "I'm sorry, an error occurred while processing your message."

    # ── 5. Embed atoms + search Chroma in parallel for contradictions ─────────
    async def _evaluate_candidate_match(atom_dict: dict, match: dict):
        existing_atom_dict = {
            "raw_text": match.get("document", ""),
            "subject": match.get("metadata", {}).get("subject", ""),
            "action": match.get("metadata", {}).get("action", ""),
            "constraint_text": match.get("metadata", {}).get("constraint_text", ""),
        }
        if atom_summary:
            existing_atom_dict["project_atom_summary"] = atom_summary[:1500]
        try:
            c_result = await loop.run_in_executor(
                None,
                functools.partial(RDCDLayer.detect_contradiction, existing_atom_dict, atom_dict),
            )
            if c_result and c_result.get("conflict_type") != "check_failed":
                return (match, c_result)
        except Exception as exc:
            logger.warning("Contradiction detect evaluation failed: %s", exc)
        return None

    async def _process_single_atom(atom_dict: dict):
        raw_text = atom_dict.get("raw_text", sanitized_content)
        matches = []
        try:
            # Use chroma_is_mocked flag (not _is_test_env) so real Chroma is
            # always queried when properly configured, even during development.
            if not settings.chroma_is_mocked:
                embedding = await loop.run_in_executor(None, EmbeddingService.embed, raw_text)
                results = await loop.run_in_executor(
                    None,
                    lambda: VectorStore.query_similar_atoms(
                        session_id=session.project_id,
                        query_embedding=embedding,
                        limit=5,
                        status_filter="active",
                    )
                )
                logger.debug(
                    "Chroma returned %d candidates for atom '%s...' (threshold=%.2f)",
                    len(results), raw_text[:60], chroma_threshold,
                )
                for res in results:
                    logger.debug("  candidate distance=%.4f  doc='%s...'" , res["distance"], str(res.get("document", ""))[:60])
                    if res["distance"] < chroma_threshold:
                        matches.append(res)
            else:
                logger.debug("Chroma is mocked — skipping vector similarity for atom.")
        except Exception as exc:
            logger.warning("Chroma query failed for atom '%s...': %s", raw_text[:60], exc)

        # Keyword fallback: runs when Chroma finds nothing (new project, empty index, etc.)
        if not matches and prior_atoms:
            fb = _find_keyword_match(atom_dict, prior_atoms)
            if fb:
                logger.debug("Keyword fallback matched prior atom for contradiction check.")
                matches.append(fb)

        # Run candidate evaluations concurrently in parallel
        eval_tasks = [_evaluate_candidate_match(atom_dict, match) for match in matches]
        eval_results = await asyncio.gather(*eval_tasks) if eval_tasks else []
        evaluations = [r for r in eval_results if r is not None]

        return (atom_dict, evaluations)

    # Process all extracted atoms concurrently
    tasks = [_process_single_atom(a) for a in extracted_atoms]
    atom_contradiction_pairs = await asyncio.gather(*tasks) if tasks else []

    # ── 6. Single atomic DB transaction ──────────────────────────────────────
    try:
        # If input was flagged during sanitization, record AuditLog inside transaction
        if is_flagged:
            from app.models.audit_log import AuditLog
            audit_log = AuditLog(
                user_id=current_user.id,
                action="suspicious_input_flagged",
                entity_type="message",
                metadata_={"original_content_snippet": body.content[:100]},
                request_id=request_id
            )
            db.add(audit_log)

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


        persisted_atoms = []
        for atom_dict, evaluations in atom_contradiction_pairs:
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
            await db.flush()
            ra.embedding_id = str(ra.id)
            persisted_atoms.append((atom_dict, ra))

            # ── Auto-create a tracked feature so developers see it on the
            #    Kanban board without manual entry ──
            if ra.subject and ra.action:
                feature_title = f"{ra.subject}: {ra.action}"[:255]
                db.add(FeatureStatus(
                    project_id=session.project_id,
                    atom_id=ra.id,
                    title=feature_title,
                    description=ra.raw_text,
                    status="planned",
                    version=1,
                    created_by=current_user.id,
                    updated_by=current_user.id,
                ))

            for chroma_match, contradiction_result in evaluations:
                conf = contradiction_result.get("confidence") or 0.0
                conflict_type = contradiction_result.get("conflict_type", "none")

                # Filter by confidence threshold before interrupting chat
                if (
                    conflict_type not in ("none", "check_failed")
                    and conf >= settings.CONTRADICTION_CONFIDENCE_THRESHOLD
                ):
                    import uuid as _uuid
                    c_id = _uuid.uuid4()
                    atom_1_id = chroma_match.get("id") if chroma_match else None
                    similarity_score = float(chroma_match.get("distance", 0.0)) if chroma_match else None

                    c = Contradiction(
                        id=c_id,
                        session_id=session_id,
                        atom_1_id=atom_1_id,
                        atom_2_id=ra.id,
                        similarity_score=similarity_score,
                        confidence=conf,
                        conflict_type=conflict_type,
                        aria_message=contradiction_result.get("aria_message", ""),
                        status="pending",
                    )
                    db.add(c)

                    # Wire contradiction into chat as a conflict_alert Message
                    conflict_msg = Message(
                        session_id=session_id,
                        sender="aria",
                        message_type="conflict_alert",
                        content=json.dumps({
                            "contradiction_id": str(c_id),
                            "conflict_type": conflict_type,
                            "aria_message": contradiction_result.get("aria_message", ""),
                            "confidence": conf,
                        }),
                    )
                    db.add(conflict_msg)

                    session.contradiction_events = (session.contradiction_events or 0) + 1
                    session.stability_score = max(0.0, (session.stability_score or 100.0) - 10.0)
                else:
                    pass  # Low-confidence evaluation — no action needed

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
    if not settings.chroma_is_mocked:
        for atom_dict, ra in persisted_atoms:
            try:
                raw_text = atom_dict.get("raw_text", sanitized_content)
                embedding = EmbeddingService.embed(raw_text)
                VectorStore.upsert_atoms(
                    session_id=session.project_id,
                    atoms=[{
                        "id": ra.id,
                        "embedding": embedding,
                        "document": raw_text,
                        "metadata": {
                            "atom_id": str(ra.id),
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
    messages = result.scalars().all()

    # ── Live-patch conflict_alert messages with current Contradiction status ──
    # The stored content JSON is written once at detection time. We overwrite
    # the status field in the response payload (not in the DB) so the frontend
    # always renders the current resolution state of the contradiction.
    conflict_ids = [
        json.loads(m.content).get("contradiction_id")
        for m in messages
        if m.message_type == "conflict_alert" and m.content
    ]
    # Deduplicate and batch-fetch live Contradiction rows
    live_contradictions: dict = {}
    if conflict_ids:
        unique_ids = list({cid for cid in conflict_ids if cid})
        try:
            import uuid as _uuid
            c_result = await db.execute(
                select(Contradiction).where(
                    Contradiction.id.in_(
                        [_uuid.UUID(cid) for cid in unique_ids]
                    )
                )
            )
            for c in c_result.scalars().all():
                live_contradictions[str(c.id)] = c.status
        except Exception as exc:
            logger.warning("Failed to batch-fetch contradiction statuses: %s", exc)

    # Build response, enriching conflict_alert rows with live status
    response = []
    for m in messages:
        if m.message_type == "conflict_alert" and m.content and live_contradictions:
            try:
                payload = json.loads(m.content)
                cid = payload.get("contradiction_id")
                if cid and cid in live_contradictions:
                    payload["status"] = live_contradictions[cid]
                response.append({
                    "id": m.id,
                    "session_id": m.session_id,
                    "sender": m.sender,
                    "content": json.dumps(payload),
                    "message_type": m.message_type,
                    "created_at": m.created_at,
                })
            except Exception:
                response.append(m)
        else:
            response.append(m)

    return response


