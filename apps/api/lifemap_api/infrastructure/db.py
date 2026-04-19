from __future__ import annotations

from collections.abc import Generator
from functools import cache

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

    SQLModel.metadata.create_all(get_engine())


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session
