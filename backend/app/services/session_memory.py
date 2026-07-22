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


class SessionMemory:
    @staticmethod
    def _get_key(session_id: uuid.UUID) -> str:
        return f"session_memory:{session_id}"

    @classmethod
    async def get_messages(cls, session_id: uuid.UUID, db: Optional[Any] = None) -> List[Dict[str, Any]]:
        """Retrieve the last 20 messages for the session. If Redis key is missing/empty, fall back to DB and re-seed Redis."""
        r = get_redis_client()
        key = cls._get_key(session_id)
        messages = []
        try:
            raw_msgs = await r.lrange(key, 0, -1)
            for msg in raw_msgs:
                try:
                    messages.append(json.loads(msg))
                except Exception as e:
                    logger.error(f"Failed to parse message from Redis memory: {e}")
        except Exception as exc:
            logger.warning("Redis read failed: %s", exc)

        if not messages and db is not None:
            try:
                from sqlalchemy import select
                from app.models.message import Message
                res = await db.execute(
                    select(Message)
                    .where(Message.session_id == session_id)
                    .order_by(Message.created_at.desc())
                    .limit(20)
                )
                db_msgs = list(reversed(res.scalars().all()))
                if db_msgs:
                    messages = [{"sender": m.sender, "content": m.content} for m in db_msgs if m.sender in ("client", "user", "aria")]
                    # Re-seed Redis
                    try:
                        async with r.pipeline(transaction=True) as pipe:
                            pipe.delete(key)
                            for m in messages:
                                pipe.rpush(key, json.dumps(m))
                            pipe.ltrim(key, -20, -1)
                            pipe.expire(key, 86400)
                            await pipe.execute()
                    except Exception as seed_exc:
                        logger.warning("Failed to re-seed Redis from DB: %s", seed_exc)
            except Exception as db_exc:
                logger.error("DB fallback for SessionMemory failed: %s", db_exc)

        return messages

    @classmethod
    async def add_message(cls, session_id: uuid.UUID, message: Dict[str, Any]) -> None:
        """Add a message to the session memory, keeping only the last 20."""
        r = get_redis_client()
        key = cls._get_key(session_id)
        # Serialize the message
        serialized = json.dumps(message)
        async with r.pipeline(transaction=True) as pipe:
            pipe.rpush(key, serialized)
            pipe.ltrim(key, -20, -1)
            # Set TTL to 24 hours so dead sessions clean up automatically
            pipe.expire(key, 86400)
            await pipe.execute()

    @classmethod
    async def clear_memory(cls, session_id: uuid.UUID) -> None:
        """Clear all messages from session memory."""
        r = get_redis_client()
        key = cls._get_key(session_id)
        await r.delete(key)
