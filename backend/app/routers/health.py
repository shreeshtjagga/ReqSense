"""
Health router — GET /health

Returns a lightweight liveness check. Does NOT hit the database or any
external service (that's a readiness check, added later). This endpoint
is intentionally fast so Render's health-check poller doesn't add DB load.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness check")
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})
