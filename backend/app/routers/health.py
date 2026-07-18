"""
Health router — GET /health and GET /health/ready
"""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.session_memory import get_redis_client
from app.tasks.celery_app import celery_app

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness check")
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})


@router.get("/health/ready", summary="Readiness check")
async def readiness(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """
    Readiness check reporting live DB, Redis, and Celery status.
    It does NOT make any external API calls to Groq, S3, or Chroma per spec.
    """
    db_ok = False
    redis_ok = False
    celery_ok = False

    # 1. Check DB
    try:
        await db.execute(select(1))
        db_ok = True
    except Exception:
        pass

    # 2. Check Redis
    try:
        r = get_redis_client()
        await r.ping()
        redis_ok = True
    except Exception:
        pass

    # 3. Check Celery Broker connection
    try:
        conn = celery_app.connection()
        conn.connect()
        conn.release()
        celery_ok = True
    except Exception:
        pass

    all_ok = db_ok and redis_ok and celery_ok
    status_code = status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_ok else "unready",
            "db": db_ok,
            "redis": redis_ok,
            "celery": celery_ok
        }
    )
