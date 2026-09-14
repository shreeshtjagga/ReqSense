# ReqSense AI

AI-powered requirements management platform. ARIA (AI Requirements Intelligence Agent) sits between clients and developers — gathering requirements through natural language chat, detecting contradictions in real time, and auto-generating structured SRS documents.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.0 (async), Alembic |
| AI / LLM | Groq API (Llama 3.1) |
| Vector DB | ChromaDB (local or hosted) |
| Frontend | React 18, Vite, Material UI v5 |
| Auth | JWT (PyJWT), Argon2 password hashing |
| Email | SendGrid |
| Storage | AWS S3 / Cloudflare R2 |
| Task Queue | Celery + Redis |

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Git**

For full production use you will also need:
- A [Groq API key](https://console.groq.com)
- A [SendGrid API key](https://sendgrid.com)
- PostgreSQL database (or use SQLite for local development)
- Redis (or run without it — the app falls back to in-memory mode)

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/shreeshtjagga/ReqSense.git
cd ReqSense
```

---

### 2. Backend

#### 2a. Create a virtual environment

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

#### 2b. Install dependencies

```bash
pip install -r requirements.txt
```

#### 2c. Configure environment variables

Create a `.env` file inside the `backend/` folder:

```bash
cp .env.example .env   # then edit .env
```

Minimum required variables for local development:

```env
DATABASE_URL=sqlite+aiosqlite:///./reqsense_local.db
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=any_random_string_at_least_32_chars_long
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
ENV=development
```

Leave all other variables at their defaults for local runs (Redis, Celery, S3, SendGrid all fall back to mock/in-memory mode automatically).

#### 2d. Initialize the database

```bash
# SQLite (local dev — no PostgreSQL needed)
python local_db_init.py

# OR — if using PostgreSQL, run Alembic migrations:
alembic upgrade head
```

#### 2e. Start the backend server

```bash
uvicorn app.main:app --reload --port 8000
```

API will be available at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

---

### 3. Frontend

```bash
cd ../frontend
npm install
```

Create a `.env` file inside `frontend/` (optional for local dev — the Vite dev server proxies `/api` to `localhost:8000` automatically):

```env
VITE_API_BASE_URL=http://localhost:8000
```

Start the frontend dev server:

```bash
npm run dev
```

App will be available at `http://localhost:5173`

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `sqlite+aiosqlite:///./reqsense_local.db` | DB connection string |
| `GROQ_API_KEY` | Yes | — | Groq LLM API key |
| `SECRET_KEY` | Yes | — | JWT signing secret (min 32 chars) |
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Frontend URL for CORS |
| `ALLOWED_ORIGINS` | Yes | `http://localhost:5173` | Comma-separated CORS origins |
| `ENV` | No | `development` | `development` or `production` |
| `REDIS_URL` | No | `memory://` | Redis URL (omit for in-memory fallback) |
| `SENDGRID_API_KEY` | No | `mock-*` | SendGrid key (omit to disable emails) |
| `CHROMA_MODE` | No | `local` | `local` or `hosted` |
| `CHROMA_API_KEY` | No | — | Required only if `CHROMA_MODE=hosted` |
| `S3_BUCKET_NAME` | No | `local-bucket` | S3/R2 bucket for SRS file storage |
| `S3_ACCESS_KEY_ID` | No | `mock-key` | S3/R2 access key |
| `S3_SECRET_ACCESS_KEY` | No | `mock-secret` | S3/R2 secret |
| `SENTRY_DSN` | No | — | Sentry error tracking DSN |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | No | proxied to `localhost:8000` in dev | Backend API base URL |

---

## Project Structure

```
ReqSense/
├── backend/
│   ├── alembic/          # Database migrations
│   ├── app/
│   │   ├── config.py     # Settings (pydantic-settings)
│   │   ├── main.py       # FastAPI app entry point
│   │   ├── database.py   # Async SQLAlchemy engine & session
│   │   ├── dependencies.py
│   │   ├── middleware/   # Error handlers, request ID
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── routers/      # API route handlers
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── services/     # Business logic (ARIA, SRS, auth, etc.)
│   │   ├── tasks/        # Celery background tasks
│   │   └── utils/        # Prompt templates, helpers
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/          # Axios API client modules
    │   ├── components/   # Reusable UI components
    │   ├── pages/        # Page-level components by role
    │   ├── store/        # Zustand state stores
    │   ├── hooks/        # Custom React hooks
    │   └── utils/        # Constants, helpers
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Running Both Servers

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
.venv\Scripts\activate    # Windows
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.
