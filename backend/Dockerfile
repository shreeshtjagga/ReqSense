FROM python:3.11-slim

# ── System deps (asyncpg needs libpq, argon2 needs build tools) ───────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (Docker layer cache) before copying source
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# ── Non-root user for security ────────────────────────────────────────────────
RUN addgroup --system reqsense && adduser --system --ingroup reqsense reqsense
USER reqsense

# Render injects $PORT; fallback to 8000 for local docker run
ENV PORT=8000

EXPOSE $PORT

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
