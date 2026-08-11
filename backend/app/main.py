import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings
from app.middleware.error_handlers import register_error_handlers
from app.middleware.request_id import RequestIDMiddleware

settings = get_settings()

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.1,
        environment=settings.ENV,
    )

import asyncio
from contextlib import asynccontextmanager
from app.services.embedding_service import EmbeddingService

@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, EmbeddingService.preload_model)
    yield

app = FastAPI(
    title="ReqSense AI",
    version="1.0.0",
    description="AI-powered requirements gathering with ARIA",
    lifespan=lifespan,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.services.rate_limit_service import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)

register_error_handlers(app)

from app.routers import (
    health, auth, users, organizations, projects, sessions, messages,
    contradictions, srs, feature_status, change_requests,
    analytics, audit_logs, requirement_atoms,
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(contradictions.router, prefix="/api/v1")
app.include_router(srs.router, prefix="/api/v1")
app.include_router(feature_status.router, prefix="/api/v1")
app.include_router(change_requests.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(audit_logs.router, prefix="/api/v1")
app.include_router(requirement_atoms.router, prefix="/api/v1")
