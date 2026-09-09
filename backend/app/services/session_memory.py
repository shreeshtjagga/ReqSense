"""
Session Memory — local in-process implementation.

Replaces Redis with an asyncio-safe in-memory store. Falls back to DB on
process restart (the DB-load path was already implemented).

The public API (`get_messages`, `add_message`, `clear_memory`,
`seed_from_prior_session`) is identical to the Redis version so all callers
work unchanged.
"""
import asyncio
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── In-memory store ──────────────────────────────────────────────────────────
# { session_id_str: [{"sender": ..., "content": ...}, ...] }
_store: Dict[str, List[Dict[str, Any]]] = {}
_store_lock = asyncio.Lock()
_MAX_MESSAGES = 40

_CONVERSATIONAL_SENDERS = {"client", "user", "aria"}


# ── Fake Redis stub (used by messages.py for the distributed lock) ───────────
class _FakeRedis:
    """Minimal in-memory stub that satisfies the redis.asyncio API surface
    used by messages.py (set/delete for the per-session lock) and health.py
    (ping).  Not thread-safe for multi-process deployments — fine for local.
    """

    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def ping(self) -> bool:
        return True

    async def set(self, key: str, value: Any, nx: bool = False, ex: int = None) -> bool:
        async with self._lock:
            if nx and key in self._data:
                return False
            self._data[key] = value
            return True

    async def delete(self, *keys: str) -> int:
        async with self._lock:
            deleted = sum(1 for k in keys if self._data.pop(k, None) is not None)
            return deleted

    async def exists(self, key: str) -> int:
        return 1 if key in self._data else 0

    async def lrange(self, key: str, start: int, end: int) -> List[str]:
        items = self._data.get(key, [])
        if end == -1:
            return list(items[start:])
        return list(items[start: end + 1])

    async def rpush(self, key: str, *values: str) -> int:
        lst = self._data.setdefault(key, [])
        lst.extend(values)
        return len(lst)

    async def ltrim(self, key: str, start: int, end: int) -> bool:
        lst = self._data.get(key, [])
        if end == -1:
            self._data[key] = lst[start:]
        else:
            self._data[key] = lst[start: end + 1]
        return True

    async def expire(self, key: str, seconds: int) -> bool:
        # TTL not enforced in-memory for simplicity
        return True

    def pipeline(self, transaction: bool = True):
        return _FakePipeline(self)


class _FakePipeline:
    """Context-manager pipeline that batches ops and executes them atomically
    (single-threaded; sufficient for local dev)."""

    def __init__(self, redis: _FakeRedis):
        self._redis = redis
        self._ops: List = []

    def delete(self, key: str):
        self._ops.append(("delete", key))
        return self

    def rpush(self, key: str, *values: str):
        self._ops.append(("rpush", key, *values))
        return self

    def ltrim(self, key: str, start: int, end: int):
        self._ops.append(("ltrim", key, start, end))
        return self

    def expire(self, key: str, seconds: int):
        self._ops.append(("expire", key, seconds))
        return self

    async def execute(self) -> List:
        results = []
        for op in self._ops:
            cmd = op[0]
            if cmd == "delete":
                results.append(await self._redis.delete(op[1]))
            elif cmd == "rpush":
                results.append(await self._redis.rpush(op[1], *op[2:]))
            elif cmd == "ltrim":
                results.append(await self._redis.ltrim(op[1], op[2], op[3]))
            elif cmd == "expire":
                results.append(await self._redis.expire(op[1], op[2]))
        return results

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


_fake_redis = _FakeRedis()


def get_redis_client():
    """Returns the fake in-memory Redis stub."""
    return _fake_redis


# ── SessionMemory ─────────────────────────────────────────────────────────────

class SessionMemory:
    @staticmethod
    def _key(session_id: uuid.UUID) -> str:
        return str(session_id)

    @classmethod
    async def _load_from_db(cls, session_id: uuid.UUID, db: Any) -> List[Dict[str, Any]]:
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
            messages = [{"sender": m.sender, "content": m.content} for m in db_msgs]

            # Also load seeded context messages persisted when memory was cold
            seed_res = await db.execute(
                select(Message)
                .where(
                    Message.session_id == session_id,
                    Message.message_type == "context_seed",
                )
                .order_by(Message.created_at.asc())
            )
            seed_msgs = seed_res.scalars().all()
            for m in seed_msgs:
                try:
                    parsed = json.loads(m.content)
                    if parsed.get("sender") in _CONVERSATIONAL_SENDERS:
                        messages.append(parsed)
                except Exception:
                    pass

            return messages
        except Exception as db_exc:
            logger.error("DB fallback for SessionMemory failed: %s", db_exc)
            return []

    @classmethod
    async def get_messages(
        cls, session_id: uuid.UUID, db: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        key = cls._key(session_id)
        async with _store_lock:
            messages = list(_store.get(key, []))

        if not messages and db is not None:
            messages = await cls._load_from_db(session_id, db)
            if messages:
                async with _store_lock:
                    _store[key] = messages[-_MAX_MESSAGES:]

        return messages

    @classmethod
    async def add_message(cls, session_id: uuid.UUID, message: Dict[str, Any]) -> None:
        if message.get("message_type") == "conflict_alert":
            return

        key = cls._key(session_id)
        async with _store_lock:
            lst = _store.setdefault(key, [])
            lst.append(message)
            if len(lst) > _MAX_MESSAGES:
                _store[key] = lst[-_MAX_MESSAGES:]

    @classmethod
    async def clear_memory(cls, session_id: uuid.UUID) -> None:
        key = cls._key(session_id)
        async with _store_lock:
            _store.pop(key, None)

    @classmethod
    async def seed_from_prior_session(
        cls,
        current_session_id: uuid.UUID,
        project_id: uuid.UUID,
        db: Any,
    ) -> None:
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

            key = cls._key(current_session_id)
            async with _store_lock:
                if key in _store:
                    logger.debug(
                        "Session %s already has in-memory context — skipping seed.", current_session_id
                    )
                    return
                _store[key] = seeded[-_MAX_MESSAGES:]

            logger.info(
                "Seeded %d prior-session turns into session %s from session %s",
                len(seeded),
                current_session_id,
                prior_session.id,
            )
        except Exception as exc:
            logger.warning("seed_from_prior_session failed: %s", exc)
