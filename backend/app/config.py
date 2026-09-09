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

    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./reqsense_local.db",
        description="Async DB URL — sqlite+aiosqlite:// for local, postgresql+asyncpg:// for production",
    )

    # Redis / Celery — optional, defaults to in-memory mode when set to 'memory://'
    REDIS_URL: str = Field(default="memory://", description="Redis URL; 'memory://' disables Redis")
    CELERY_BROKER_URL: str = Field(default="memory://")
    CELERY_RESULT_BACKEND: str = Field(default="memory://")

    SECRET_KEY: str = Field(default="dev-secret-key-for-local-testing-only-not-for-prod", min_length=32, description="JWT signing secret (min 32 chars)")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30)
    STREAM_TOKEN_EXPIRE_SECONDS: int = Field(default=60)

    GROQ_API_KEY: str = Field(default="", description="Groq API key")
    GROQ_MODEL: str = Field(default="llama-3.3-70b-versatile")
    GROQ_TIMEOUT_SECONDS: int = Field(default=30)

    SENDGRID_API_KEY: str = Field(default="mock-sendgrid-key", description="SendGrid API key; mock-* disables sending")
    SENDGRID_TIMEOUT_SECONDS: int = Field(default=5)
    FROM_EMAIL: str = Field(default="noreply@reqsense.local", description="Verified sender email address")

    CHROMA_MODE: Literal["hosted", "local"] = Field(default="local")
    CHROMA_API_KEY: str = Field(default="")
    CHROMA_TENANT: str = Field(default="")
    CHROMA_DATABASE: str = Field(default="reqsense")
    CHROMA_PERSIST_DIRECTORY: str = Field(default="./chroma_data")
    CHROMA_TIMEOUT_SECONDS: int = Field(default=10)

    EMBEDDING_MODEL: str = Field(default="all-MiniLM-L6-v2")
    EMBEDDING_VERSION: str = Field(default="v1")

    S3_BUCKET_NAME: str = Field(default="local-bucket", description="S3/R2 bucket name for SRS .docx files")
    S3_ACCESS_KEY_ID: str = Field(default="mock-key", description="S3/R2 access key")
    S3_SECRET_ACCESS_KEY: str = Field(default="mock-secret", description="S3/R2 secret key")
    S3_ENDPOINT_URL: str = Field(default="", description="Override endpoint for R2/non-AWS; omit for AWS S3")
    S3_REGION: str = Field(default="auto")
    S3_TIMEOUT_SECONDS: int = Field(default=10)

    SENTRY_DSN: str = Field(default="", description="Sentry DSN; empty disables Sentry")

    FRONTEND_URL: str = Field(default="http://localhost:5173")
    ALLOWED_ORIGINS: str = Field(default="http://localhost:5173")

    RATE_LIMIT_MESSAGES_PER_MINUTE: int = Field(default=60)
    RATE_LIMIT_LOGIN_PER_MINUTE: int = Field(default=20)
    RATE_LIMIT_ANALYTICS_PER_MINUTE: int = Field(default=200)
    RATE_LIMIT_DOWNLOADS_PER_MINUTE: int = Field(default=50)

    PROMPT_VERSION: str = Field(default="v1.0")
    ENV: Literal["development", "production"] = Field(default="development")

    CONTRADICTION_CONFIDENCE_THRESHOLD: float = Field(default=0.5, description="Minimum confidence required to surface a contradiction")

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def redis_is_disabled(self) -> bool:
        """True when Redis is not configured (memory:// placeholder or empty)."""
        return not self.REDIS_URL or self.REDIS_URL.startswith("memory://")

    @property
    def groq_is_mocked(self) -> bool:
        return not self.GROQ_API_KEY or self.GROQ_API_KEY.startswith(("test", "mock", "dev"))

    @property
    def chroma_is_mocked(self) -> bool:
        if self.CHROMA_MODE == "local":
            return False  # local mode = real local ChromaDB, NOT mocked
        return not self.CHROMA_API_KEY or self.CHROMA_API_KEY.startswith(("test", "mock", "dev"))

    @property
    def s3_is_mocked(self) -> bool:
        return not self.S3_ACCESS_KEY_ID or self.S3_ACCESS_KEY_ID.startswith(("test", "mock", "dev"))

    @property
    def sendgrid_is_mocked(self) -> bool:
        return not self.SENDGRID_API_KEY or self.SENDGRID_API_KEY.startswith(("test", "mock", "dev", "SG.test"))

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def docs_enabled(self) -> bool:
        return self.ENV == "development"

    @model_validator(mode="after")
    def _validate_chroma_hosted_credentials(self) -> "Settings":
        if self.CHROMA_MODE == "hosted" and not self.chroma_is_mocked:
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

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
