from fastapi import Depends
from sqlmodel import Session

from lifemap_api.config import get_settings
from lifemap_api.domain.ports import LLMProvider
from lifemap_api.infrastructure.db import get_session
from lifemap_api.infrastructure.llm_providers import build_llm_provider
from lifemap_api.infrastructure.repositories import (
    SqliteCheckInRepository,
    SqliteGoalRepository,
    SqliteLifeMapRepository,
    SqliteProfileRepository,
    SqliteSourceRepository,
)


def get_profile_repository(session: Session = Depends(get_session)) -> SqliteProfileRepository:
    return SqliteProfileRepository(session)


def get_goal_repository(session: Session = Depends(get_session)) -> SqliteGoalRepository:
    return SqliteGoalRepository(session)


def get_lifemap_repository(session: Session = Depends(get_session)) -> SqliteLifeMapRepository:
    return SqliteLifeMapRepository(session)


def get_source_repository(session: Session = Depends(get_session)) -> SqliteSourceRepository:
    return SqliteSourceRepository(session)


def get_checkin_repository(session: Session = Depends(get_session)) -> SqliteCheckInRepository:
    return SqliteCheckInRepository(session)


def get_llm_provider() -> LLMProvider:
    return build_llm_provider(get_settings())
