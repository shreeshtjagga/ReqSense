"""
ReqSense AI — FastAPI application factory.

Middleware order (outermost → innermost):
  1. RequestIDMiddleware  — attaches/propagates X-Request-ID
  2. CORSMiddleware       — handles preflight before any auth runs
  3. Route handlers
  4. Error handlers       — catch everything that reaches the edge
"""

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings
from app.middleware.error_handlers import register_error_handlers
from app.middleware.request_id import RequestIDMiddleware

settings = get_settings()

# ── Sentry (skipped if DSN is blank — safe for local dev) ────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.1,
        environment=settings.ENV,
    )

# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="ReqSense AI",
    version="1.0.0",
    description="AI-powered requirements gathering with ARIA",
    # Hide docs in production
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

# ── Middleware (added in reverse — last added = outermost) ────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)

# ── Error handlers ────────────────────────────────────────────────────────────
register_error_handlers(app)

# ── Routers ───────────────────────────────────────────────────────────────────
from app.routers import (
    health, auth, users, organizations, projects, sessions, messages,
    contradictions, srs, feature_status, change_requests,
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

