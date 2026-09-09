"""
Alembic environment — async SQLAlchemy migration runner.

Reads DATABASE_URL from the app's Settings so there's a single source
of truth for the connection string (no duplicate in alembic.ini).

Supports both SQLite (local dev) and PostgreSQL (production).
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Import Base and all models so autogenerate can see every table
from app.database import Base
import app.models  # noqa: F401 — side-effect import registers all mappers

from app.config import get_settings

config = context.config
settings = get_settings()

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# SQLite needs render_as_batch=True to support ALTER TABLE operations
_configure_kwargs = {
    "target_metadata": target_metadata,
    "compare_type": True,
    "render_as_batch": settings.is_sqlite,
}


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL script)."""
    context.configure(
        url=settings.DATABASE_URL,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **_configure_kwargs,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, **_configure_kwargs)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live async DB connection."""
    # Build connect_args appropriate to the DB driver
    connect_args: dict = {}
    if settings.is_sqlite:
        connect_args["check_same_thread"] = False
    else:
        connect_args = {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        }

    connectable = create_async_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
