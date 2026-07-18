"""
ReqSense AI — Application Settings
Pydantic v2 BaseSettings with fail-fast validation on startup.
All required fields have no default; missing values raise an error before
the server accepts a single request.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BASE_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(..., description="PostgreSQL async URL (postgresql+asyncpg://...)")

    # ── Redis / Celery ────────────────────────────────────────────────────────
    REDIS_URL: str = Field(..., description="Redis URL for app cache")
    CELERY_BROKER_URL: str = Field(..., description="Redis URL used as Celery broker")
    CELERY_RESULT_BACKEND: str = Field(..., description="Redis URL for Celery result backend")

    # ── JWT / Auth ────────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(..., min_length=32, description="JWT signing secret (min 32 chars)")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=14)
    STREAM_TOKEN_EXPIRE_SECONDS: int = Field(default=60)

    # ── Groq ─────────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = Field(..., description="Groq API key")
    GROQ_MODEL: str = Field(default="llama-3.1-8b-instant")
    GROQ_TIMEOUT_SECONDS: int = Field(default=15)

    # ── SendGrid ──────────────────────────────────────────────────────────────
    SENDGRID_API_KEY: str = Field(..., description="SendGrid API key")
    SENDGRID_TIMEOUT_SECONDS: int = Field(default=5)
    FROM_EMAIL: str = Field(..., description="Verified sender email address")

    # ── ChromaDB ──────────────────────────────────────────────────────────────
    CHROMA_MODE: Literal["hosted", "local"] = Field(default="hosted")
    CHROMA_API_KEY: str = Field(default="")
    CHROMA_TENANT: str = Field(default="")
    CHROMA_DATABASE: str = Field(default="reqsense")
    CHROMA_PERSIST_DIRECTORY: str = Field(default="/data/chroma_db")
    CHROMA_TIMEOUT_SECONDS: int = Field(default=10)

    # ── Embeddings ────────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = Field(default="all-MiniLM-L6-v2")
    EMBEDDING_VERSION: str = Field(default="v1")

    # ── Object Storage (S3 / Cloudflare R2) ───────────────────────────────────
    S3_BUCKET_NAME: str = Field(..., description="S3/R2 bucket name for SRS .docx files")
    S3_ACCESS_KEY_ID: str = Field(..., description="S3/R2 access key")
    S3_SECRET_ACCESS_KEY: str = Field(..., description="S3/R2 secret key")
    S3_ENDPOINT_URL: str = Field(default="", description="Override endpoint for R2/non-AWS; omit for AWS S3")
    S3_REGION: str = Field(default="auto")
    S3_TIMEOUT_SECONDS: int = Field(default=10)

    # ── Sentry ────────────────────────────────────────────────────────────────
    SENTRY_DSN: str = Field(default="", description="Sentry DSN; empty disables Sentry")

    # ── CORS / Frontend ───────────────────────────────────────────────────────
    FRONTEND_URL: str = Field(default="http://localhost:5173")
    ALLOWED_ORIGINS: str = Field(default="http://localhost:5173")

    # ── Rate limits ───────────────────────────────────────────────────────────
    RATE_LIMIT_MESSAGES_PER_MINUTE: int = Field(default=30)
    RATE_LIMIT_LOGIN_PER_MINUTE: int = Field(default=5)
    RATE_LIMIT_ANALYTICS_PER_MINUTE: int = Field(default=100)
    RATE_LIMIT_DOWNLOADS_PER_MINUTE: int = Field(default=20)

    # ── Misc ──────────────────────────────────────────────────────────────────
    PROMPT_VERSION: str = Field(default="v1.0")
    ENV: Literal["development", "production"] = Field(default="development")

    # ── Derived helpers ───────────────────────────────────────────────────────
    @property
    def allowed_origins_list(self) -> list[str]:
        """Split comma-separated ALLOWED_ORIGINS into a list for FastAPI CORS."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def docs_enabled(self) -> bool:
        """Swagger/ReDoc only exposed in development."""
        return self.ENV == "development"

    # ── Fail-fast cross-field validation ──────────────────────────────────────
    @model_validator(mode="after")
    def _validate_chroma_hosted_credentials(self) -> "Settings":
        if self.CHROMA_MODE == "hosted":
            missing = [
                name
                for name, val in [
                    ("CHROMA_API_KEY", self.CHROMA_API_KEY),
                    ("CHROMA_TENANT", self.CHROMA_TENANT),
                ]
                if not val
            ]
            if missing:
                raise ValueError(
                    f"CHROMA_MODE=hosted requires: {', '.join(missing)}"
                )
        return self

    @model_validator(mode="after")
    def _validate_database_url_prefix(self) -> "Settings":
        if self.DATABASE_URL and not self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            raise ValueError(
                "DATABASE_URL must start with 'postgresql+asyncpg://' "
                "(not 'postgresql://'). Rename the prefix."
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the cached Settings singleton.
    Called once at startup; subsequent calls return the same object.
    The lru_cache means the .env file is read exactly once.
    """
    return Settings()
