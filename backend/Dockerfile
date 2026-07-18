FROM python:3.11-slim

# ── System deps (asyncpg needs libpq, argon2 needs build tools) ───────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (Docker layer cache) before copying source
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# ── Non-root user for security ────────────────────────────────────────────────
RUN addgroup --system reqsense && adduser --system --ingroup reqsense reqsense

# Data directory for local Chroma persistence (only used if CHROMA_MODE=local)
RUN mkdir -p /data/chroma_db && chown -R reqsense:reqsense /data

USER reqsense

# Render injects $PORT; fallback to 8000 for local docker run
ENV PORT=8000

EXPOSE $PORT

# Liveness probe via curl — Render and docker-compose both use this
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2"]
