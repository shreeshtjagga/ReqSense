# ReqSense AI Agent Guidelines

## Repository Overview & Standards
- This repository is a full-stack AI requirements management application with a **FastAPI backend** (`backend/app`) and a **React + Material UI frontend** (`frontend/src`).
- High-level architecture, module maps, data models, and service interfaces are documented in [ARCHITECTURE.md](file:///c:/Users/PC/OneDrive/Desktop/Req%20Sense/ARCHITECTURE.md).

## Backend Guidelines
1. **Async SQLAlchemy**: Always use async session queries (`select()`, `await db.execute()`) with SQLAlchemy 2.0.
2. **Schema & Model Consistency**: Keep Pydantic schemas in `backend/app/schemas/` synchronized with SQLAlchemy ORM models in `backend/app/models/` and Alembic migrations in `backend/alembic/versions/`.
3. **Mock Services**: Honor `settings.*_is_mocked` helpers in `backend/app/config.py` when extending external integrations (Groq, Chroma, S3/R2, SendGrid).

## Frontend Guidelines
1. **UI Framework**: Use Material UI (MUI v5) components and the custom theme in `frontend/src/theme.js`.
2. **API Communication**: Use configured Axios instance from `frontend/src/api/axios.js`.

## Code Cleanliness
- Maintain clean LF line endings (managed via `.gitattributes`).
- Do not commit secrets, environment `.env` files, or binary artifacts.
