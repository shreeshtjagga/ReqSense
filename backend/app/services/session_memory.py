import json
import logging
import uuid
from typing import List, Dict, Any, Optional
import redis.asyncio as redis
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_redis_client = None

def get_redis_client():
    global _redis_client
    if _redis_client is None:
        logger.info(f"Initializing Redis client with URL: {settings.REDIS_URL}")
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


_CONVERSATIONAL_SENDERS = {"client", "user", "aria"}


class SessionMemory:
    @staticmethod
    def _get_key(session_id: uuid.UUID) -> str:
        return f"session_memory:{session_id}"

    @classmethod
    async def _load_from_db(cls, session_id: uuid.UUID, db: Any) -> List[Dict[str, Any]]:
        """
        Load the last 40 chat messages from the DB for a session.
        Excludes conflict_alert messages (raw JSON blobs) so ARIA context
        only contains actual human/ARIA conversation turns.
        """
        try:
            from sqlalchemy import select
            from app.models.message import Message
            res = await db.execute(
                select(Message)
                .where(
                    Message.session_id == session_id,
                    Message.sender.in_(list(_CONVERSATIONAL_SENDERS)),
                    Message.message_type != "conflict_alert",
                )
                .order_by(Message.created_at.desc())
                .limit(40)
            )
            db_msgs = list(reversed(res.scalars().all()))
            return [{"sender": m.sender, "content": m.content} for m in db_msgs]
        except Exception as db_exc:
            logger.error("DB fallback for SessionMemory failed: %s", db_exc)
            return []

    @classmethod
    async def get_messages(cls, session_id: uuid.UUID, db: Optional[Any] = None) -> List[Dict[str, Any]]:
        """
        Retrieve the last 40 messages for the session from Redis.
        If Redis is unavailable or returns nothing, falls back to the DB
        and re-seeds Redis for subsequent calls.

        Only conversational messages (client/user/aria, non-conflict_alert)
        are returned so ARIA never receives raw JSON contradiction blobs.
        """
        r = get_redis_client()
        key = cls._get_key(session_id)
        messages: List[Dict[str, Any]] = []
        redis_available = True

        try:
            raw_msgs = await r.lrange(key, 0, -1)
            for raw in raw_msgs:
                try:
                    parsed = json.loads(raw)
                    if parsed.get("sender") in _CONVERSATIONAL_SENDERS and parsed.get("message_type") != "conflict_alert":
                        messages.append(parsed)
                except Exception as e:
                    logger.error("Failed to parse message from Redis memory: %s", e)
        except Exception as exc:
            logger.warning("Redis unavailable, falling back to DB for history: %s", exc)
            redis_available = False

        if not messages and db is not None:
            messages = await cls._load_from_db(session_id, db)

            if messages and redis_available:
                try:
                    async with r.pipeline(transaction=True) as pipe:
                        pipe.delete(key)
                        for m in messages:
                            pipe.rpush(key, json.dumps(m))
                        pipe.ltrim(key, -40, -1)
                        pipe.expire(key, 86400)
                        await pipe.execute()
                except Exception as seed_exc:
                    logger.warning("Failed to re-seed Redis from DB: %s", seed_exc)

        return messages

    @classmethod
    async def add_message(cls, session_id: uuid.UUID, message: Dict[str, Any]) -> None:
        """
        Add a conversational message to session memory, keeping the last 40.
        Skips conflict_alert messages — they are DB-only, never in ARIA history.
        """
        if message.get("message_type") == "conflict_alert":
            return

        r = get_redis_client()
        key = cls._get_key(session_id)
        serialized = json.dumps(message)
        try:
            async with r.pipeline(transaction=True) as pipe:
                pipe.rpush(key, serialized)
                pipe.ltrim(key, -40, -1)
                pipe.expire(key, 86400)
                await pipe.execute()
        except Exception as exc:
            logger.warning("Redis add_message failed (message not cached): %s", exc)

    @classmethod
    async def clear_memory(cls, session_id: uuid.UUID) -> None:
        """Clear all messages from session memory."""
        r = get_redis_client()
        key = cls._get_key(session_id)
        try:
            await r.delete(key)
        except Exception as exc:
            logger.warning("Redis clear_memory failed: %s", exc)

    @classmethod
    async def seed_from_prior_session(
        cls,
        current_session_id: uuid.UUID,
        project_id: uuid.UUID,
        db: Any,
    ) -> None:
        """
        Seed the current session's Redis key with the last 20 conversational turns
        from the most recently active/completed prior session on the same project.

        Seeds from ANY prior session status (not just 'completed') so ARIA retains
        context even when a client abandons a session mid-way and starts a new one.
        A lightweight context-marker message is prepended so ARIA knows it already
        has history and should acknowledge it at the start of the new conversation.
        """
        try:
            from sqlalchemy import select
            from app.models.message import Message
            from app.models.session import Session

            prior_session_res = await db.execute(
                select(Session)
                .where(
                    Session.project_id == project_id,
                    Session.id != current_session_id,
                )
                .order_by(Session.started_at.desc())
                .limit(1)
            )
            prior_session = prior_session_res.scalar_one_or_none()
            if not prior_session:
                logger.info(
                    "No prior session found for project %s — ARIA starts fresh.", project_id
                )
                return

            msgs_res = await db.execute(
                select(Message)
                .where(
                    Message.session_id == prior_session.id,
                    Message.sender.in_(list(_CONVERSATIONAL_SENDERS)),
                    Message.message_type != "conflict_alert",
                )
                .order_by(Message.created_at.desc())
                .limit(20)
            )
            prior_msgs = list(reversed(msgs_res.scalars().all()))
            if not prior_msgs:
                return

            marker = {
                "sender": "aria",
                "content": (
                    "[Context from prior session — these requirements have already been captured "
                    "and do not need to be asked again.]"
                ),
            }
            seeded = [marker] + [{"sender": m.sender, "content": m.content} for m in prior_msgs]

            r = get_redis_client()
            key = cls._get_key(current_session_id)
            try:
                async with r.pipeline(transaction=True) as pipe:
                    for m in seeded:
                        pipe.rpush(key, json.dumps(m))
                    pipe.ltrim(key, -40, -1)
                    pipe.expire(key, 86400)
                    await pipe.execute()
                logger.info(
                    "Seeded %d prior-session turns into session %s from session %s",
                    len(seeded),
                    current_session_id,
                    prior_session.id,
                )
            except Exception as redis_exc:
                logger.warning("Failed to seed prior session into Redis: %s", redis_exc)
        except Exception as exc:
            logger.warning("seed_from_prior_session failed: %s", exc)

