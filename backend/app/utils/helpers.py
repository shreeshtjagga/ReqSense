"""
helpers.py — Shared utility functions used across the app.

Keep this file small: pure functions only, no imports from app.models
or app.services to avoid circular deps.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    """Generate a new random UUID v4."""
    return uuid.uuid4()


def truncate(text: str, max_len: int, suffix: str = "…") -> str:
    """Truncate *text* to *max_len* characters, appending *suffix* if cut."""
    if len(text) <= max_len:
        return text
    return text[: max_len - len(suffix)] + suffix


def strip_json_fences(text: str) -> str:
    """Strip markdown code fences (```json ... ```) from raw LLM responses."""
    text = (text or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text

