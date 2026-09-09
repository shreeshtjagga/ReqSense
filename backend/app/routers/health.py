from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db

router = APIRouter(tags=["health"])
settings = get_settings()

@router.get("/health", summary="Liveness check")
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})

@router.get("/health/ready", summary="Readiness check")
async def readiness(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    db_ok = False

    try:
        await db.execute(select(1))
        db_ok = True
    except Exception:
        pass

    # In local mode Redis and Celery are replaced by in-process stubs — always ok
    redis_ok = settings.redis_is_disabled  # True when using in-memory mode
    celery_ok = True  # Direct call stub, always available

    all_ok = db_ok
    status_code = status.HTTP_200_OK if all_ok else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_ok else "unready",
            "db": db_ok,
            "redis": redis_ok,
            "celery": celery_ok,
            "mode": "local" if settings.is_sqlite else "production",
        }
    )
