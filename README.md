# ReqSense AI

> AI-powered requirements gathering — ARIA sits between client and developer, detects contradictions in real time, and auto-generates SRS documents.

---

## Stack

| Layer | Technology |
|---|---|
| **API** | FastAPI 0.111, Python 3.11, Uvicorn |
| **Database** | PostgreSQL 16 + SQLAlchemy 2 (asyncpg) |
| **Cache / Queue** | Redis 7 + Celery 5 |
| **AI** | Groq SDK (`llama-3.1-8b-instant`), Sentence Transformers |
| **Vector DB** | ChromaDB (hosted or local persistent volume) |
| **Object Storage** | Cloudflare R2 (or AWS S3) — SRS `.docx` files |
| **Email** | SendGrid (dispatched via Celery) |
| **Auth** | PyJWT + argon2-cffi, refresh-token rotation |
| **Frontend** | React 18 + Vite, Material UI v5, Zustand, Recharts |
| **Deploy** | Render (API + Worker), Vercel (frontend) |
| **Errors** | Sentry (tagged with `request_id`) |
| **Rate limits** | slowapi |

---

## Quick Start (Docker)

```bash
# 1. Clone
git clone https://github.com/shreeshtjagga/ReqSense
cd ReqSense

# 2. Configure backend
cp backend/.env.example backend/.env
# → fill in GROQ_API_KEY, SENDGRID_API_KEY, S3_*, SENTRY_DSN, SECRET_KEY

# 3. Start all services (postgres, redis, chroma, api, celery worker)
docker compose up -d

# 4. Run migrations
docker compose exec api alembic upgrade head

# 5. Start frontend (separate terminal — hot-reload)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

---

## Local Dev without Docker

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env             # fill in values
uvicorn app.main:app --reload

# Celery worker (separate terminal)
celery -A app.tasks.celery_app worker --loglevel=info

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for a fully commented list of every variable. Required fields cause a startup validation error if missing.

Key production-only settings:
- `ENV=production` — disables `/docs`, `/redoc`, `/openapi.json`
- `ALLOWED_ORIGINS=https://your-app.vercel.app` — locks CORS to your domain
- `SENTRY_DSN` — enables error tracking (tagged with `request_id`)

---

## Deployment

### Backend → Render

1. Fork / push to your repo.
2. Create a new Render Blueprint from `render.yaml` at the repo root.
3. Set secret environment variables in the Render dashboard (those marked `sync: false` in `render.yaml`).
4. On first deploy, run: `alembic upgrade head` from the Render shell.

### Frontend → Vercel

```bash
cd frontend
vercel --prod
# Set VITE_API_BASE_URL=https://reqsense-api.onrender.com
```

---

## Security Headers (verified on every response)

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'; ...` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Request-ID` | unique UUID per request (reflected in error responses) |

---

## API Endpoints

Swagger UI available at `/docs` **in development only** (`ENV=development`).  
In production, `/docs` returns `404`.

Base prefix: `/api/v1`

| Router | Prefix |
|---|---|
| Auth | `/api/v1/auth` |
| Users | `/api/v1/users` |
| Organizations | `/api/v1/organizations` |
| Projects | `/api/v1/projects` |
| Sessions | `/api/v1/sessions` |
| Messages / ARIA | `/api/v1/messages` |
| Contradictions | `/api/v1/contradictions` |
| SRS | `/api/v1/srs` |
| Feature Status | `/api/v1/feature-status` |
| Change Requests | `/api/v1/change-requests` |
| Analytics | `/api/v1/analytics` |
| Audit Logs | `/api/v1/audit-logs` |
| Health | `/health`, `/health/ready` |

---

## Chroma Data Persistence

- **Hosted Chroma Cloud** (`CHROMA_MODE=hosted`): data persists in Chroma Cloud — survives every Render redeploy with zero additional config.
- **Local Chroma** (`CHROMA_MODE=local`): attach a **Render Persistent Disk** at `/data` (see `render.yaml` comments). Without the disk, a local Chroma database is lost on every deploy.

---

## Running Tests

```bash
cd backend
.venv\Scripts\activate
pytest tests/ -v
```

Tests use an in-memory SQLite database (no real Postgres/Redis/Groq needed).

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:
- **Ruff** lint for backend
- **Pytest** for backend
- **Vite build** for frontend
