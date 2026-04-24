from __future__ import annotations

from collections.abc import Generator
from functools import cache

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from lifemap_api.config import get_settings


@cache
def build_engine(database_url: str):
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args)


def get_engine():
    settings = get_settings()
    return build_engine(settings.sqlite_url)


def init_db() -> None:
    from lifemap_api.infrastructure import db_models  # noqa: F401

    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    _migrate_sqlite_goal_analysis_columns(engine)


def _migrate_sqlite_goal_analysis_columns(engine) -> None:
    if not str(engine.url).startswith("sqlite"):
        return

    with engine.begin() as connection:
        rows = connection.execute(text("PRAGMA table_info(goal_analyses)")).mappings().all()
        existing_columns = {str(row["name"]) for row in rows}
        if "followup_questions_json" not in existing_columns:
            connection.execute(
                text(
                    "ALTER TABLE goal_analyses "
                    "ADD COLUMN followup_questions_json JSON NOT NULL DEFAULT '[]'"
                )
            )
        if "research_plan_json" not in existing_columns:
            connection.execute(
                text("ALTER TABLE goal_analyses ADD COLUMN research_plan_json JSON")
            )


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session
