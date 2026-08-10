# ReqSense AI — System Architecture & Repository Analysis Guide

This document provides a comprehensive technical overview of the **ReqSense AI** repository structure, domain services, database models, AI pipelines, and design patterns. It serves as an authoritative reference for human developers and AI analysis agents.

---

## 1. System Overview

ReqSense AI is an intelligent Software Requirements Engineering platform that automates requirements elicitation, atomization, contradiction detection, impact analysis, and Software Requirements Specification (SRS) generation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ReqSense AI Platform                             │
├────────────────────────────────┬────────────────────────────────────────────┤
│ React 18 + Material UI (MUI)   │ FastAPI + Async SQLAlchemy 2.0             │
│ (Client Hub / Developer Portal)│ (Async PostgreSQL + Redis + ChromaDB)      │
└────────────────────────────────┴────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
Req Sense/
├── backend/                        # FastAPI Backend Application
│   ├── alembic/                    # Database Migrations
│   │   └── versions/               # Schema Migration Scripts (001 - 007)
│   ├── app/
│   │   ├── models/                 # SQLAlchemy 2.0 Async ORM Models
│   │   │   ├── user.py             # Roles (client, developer, admin)
│   │   │   ├── project.py          # Project meta & settings
│   │   │   ├── chat_session.py     # Elicitation session tracking
│   │   │   ├── message.py          # Chat message records
│   │   │   ├── requirement_atom.py # Extracted granular requirements
│   │   │   ├── contradiction.py    # Detected requirement conflicts
│   │   │   ├── change_request.py   # Client change proposals
│   │   │   └── srs_version.py      # Generated SRS revisions
│   │   ├── schemas/                # Pydantic v2 Request/Response Schemas
│   │   ├── routers/                # REST API Endpoints & Route Handlers
│   │   │   ├── auth.py             # Auth & user registration
│   │   │   ├── projects.py         # Project management
│   │   │   ├── chat.py / messages.py# Live chat & ARIA interaction
│   │   │   ├── requirement_atoms.py# Atom management & status updates
│   │   │   ├── contradictions.py   # Conflict detection & overrides
│   │   │   ├── change_requests.py  # Change proposal submission & impact
│   │   │   ├── srs.py              # SRS document generation & export
│   │   │   └── analytics.py        # Project analytics & cost tracking
│   │   ├── services/               # AI & Infrastructure Core Services
│   │   │   ├── aria_agent.py       # Conversational ARIA agent logic
│   │   │   ├── rdcd_layer.py       # Requirement decomposition & atomization
│   │   │   ├── vector_store.py     # ChromaDB vector embedding engine
│   │   │   ├── impact_analyser.py  # Change request graph impact analysis
│   │   │   ├── session_memory.py   # Redis chat history memory & cache
│   │   │   ├── embedding_service.py# SentenceTransformers embeddings
│   │   │   ├── srs_generator.py    # Automated SRS document compiler
│   │   │   └── storage_service.py  # Cloudflare R2 / S3 storage wrapper
│   │   ├── utils/                  # System prompts, helpers, rate limiters
│   │   ├── config.py               # Pydantic Settings & environment config
│   │   ├── database.py             # Async engine & session factory
│   │   ├── dependencies.py         # Auth, scope, & DB session dependencies
│   │   └── main.py                 # FastAPI application & middleware initialization
│   └── tests/                      # Automated Test Suite (Phases 1-4)
│
├── frontend/                       # React 18 Single Page Application
│   ├── src/
│   │   ├── api/                    # Axios API service integrations
│   │   ├── components/             # Reusable UI components (MUI)
│   │   │   ├── chat/               # Conflict override & chat panels
│   │   │   ├── common/             # Banners, headers, navigation
│   │   │   └── project/            # Project hub & tab views
│   │   ├── pages/                  # Page Views
│   │   │   ├── auth/               # Login & Register views
│   │   │   ├── client/             # Client Hub & Chat Session
│   │   │   └── developer/          # Developer Dashboard & Project Details
│   │   ├── context/                # AuthContext & global state
│   │   └── theme.js                # Custom MUI theme palette & typography
│   └── vercel.json                 # Frontend deployment configuration
│
├── ARCHITECTURE.md                 # System Architecture & Repo Map (this file)
├── .gitattributes                  # Normalized LF line endings configuration
├── .gitignore                      # Git exclusion patterns
├── README.md                       # High-level project documentation
└── docker-compose.yml              # Local container orchestrator
```

---

## 3. Core AI Pipelines & Domain Services

### A. ARIA Agent (`backend/app/services/aria_agent.py`)
- Conducts structured interactive requirements elicitation sessions with non-technical clients.
- Uses Groq LLM API with fallback mock handling (`settings.groq_is_mocked`).
- Restores prior session turns via Redis memory (`session_memory.py`) for consistent conversation context.

### B. RDCD Decomposition Layer (`backend/app/services/rdcd_layer.py`)
- Extracts discrete, unambiguous `RequirementAtom` objects from unstructured client chat.
- Assigns priority, category, complexity score, and initial status (`active`).

### C. Vector Store & Embedding Engine (`backend/app/services/vector_store.py`)
- Project-scoped vector storage in ChromaDB (`project_<id>`).
- Supports similarity filtering (`where={"status": "active"}`) to isolate current valid atoms.
- Dynamic status metadata updates (`update_atom_status`) without re-embedding.

### D. Contradiction Detection & Developer Overrides (`backend/app/routers/contradictions.py`)
- Evaluates candidate requirement atoms against active project vector store.
- Configurable similarity sensitivity threshold (`chroma_similarity_threshold`) tunable from frontend slider.
- Source tracking (`source='chat'` vs `source='change_request'`).
- False positive flag support (`is_false_positive=True`) for AI conflict resolution metrics.

### E. Impact Analyser (`backend/app/services/impact_analyser.py`)
- Performs multi-hop dependency analysis when change requests are submitted.
- Computes impact scores and identifies affected downstream requirements.

---

## 4. Key Data Models

| Model | Table Name | Purpose | Key Relations |
| :--- | :--- | :--- | :--- |
| **User** | `users` | User credentials, organization, and roles (`client`, `developer`, `admin`). | Projects, Messages |
| **Project** | `projects` | Core project context, threshold settings, and developer assignment. | Sessions, Atoms, Contradictions |
| **ChatSession** | `chat_sessions` | Interactive elicitation workspace between Client & ARIA. | Project, Messages, Atoms |
| **RequirementAtom** | `requirement_atoms` | Atomic, verifiable requirement item. | Project, Session, Contradictions |
| **Contradiction** | `contradictions` | Conflict detected between two requirement atoms or change proposals. | Project, Atoms (1 & 2), ChangeRequest |
| **ChangeRequest** | `change_requests` | Formal change proposal submitted by client. | Project, Contradictions |
| **SRSVersion** | `srs_versions` | Generated document snapshot (PDF/Docx metadata). | Project, User |

---

## 5. Environment & Mock Mode Detection

Centralized properties in `backend/app/config.py` enable seamless local development and automated testing without external service dependencies:

- `settings.groq_is_mocked`: Active when `GROQ_API_KEY` is empty or starts with `test`/`mock`.
- `settings.chroma_is_mocked`: Active when `CHROMA_API_KEY` is mock/empty in cloud mode.
- `settings.s3_is_mocked`: Active when R2/S3 keys are omitted or dummy values.
- `settings.sendgrid_is_mocked`: Active when email verification API keys are unconfigured.

---

## 6. Repository Analysis Best Practices for AI Agents

1. **Schema Integrity**: Always cross-reference Pydantic schemas (`backend/app/schemas/`) with SQLAlchemy models (`backend/app/models/`) and Alembic migrations when adding new database fields.
2. **Scope Control**: Inspect `backend/app/dependencies.py` (`get_scoped_project`, `get_current_user`) to ensure cross-organization data isolation is maintained.
3. **Async Standard**: All FastAPI route handlers and database queries must use async SQLAlchemy (`select()`, `await db.execute()`, `await db.commit()`).
