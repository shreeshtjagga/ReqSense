from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def new_uuid() -> uuid.UUID:
    return uuid.uuid4()

def truncate(text: str, max_len: int, suffix: str = "…") -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - len(suffix)] + suffix

def strip_json_fences(text: str) -> str:
    text = (text or "").strip()

    json_fence_match = re.search(r"```json\s*\n?(.*?)\n?```", text, re.DOTALL | re.IGNORECASE)
    if json_fence_match:
        candidate = json_fence_match.group(1).strip()
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass

    for match in re.finditer(r"(\[[\s\S]*\]|\{[\s\S]*\})", text):
        candidate = match.group(0).strip()
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            continue

    brackets = [pos for pos in (text.find("["), text.find("{")) if pos != -1]
    if brackets:
        start = min(brackets)
        end = max(text.rfind("]"), text.rfind("}"))
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1].strip()

    return text
