from fastapi import Depends
from sqlmodel import Session

from lifemap_api.config import get_settings
from lifemap_api.domain.ports import EmbeddingProvider, LLMProvider, SourceSearchIndex
from lifemap_api.infrastructure.db import get_session
from lifemap_api.infrastructure.embeddings import DeterministicEmbeddingProvider
from lifemap_api.infrastructure.llm_providers import build_llm_provider
from lifemap_api.infrastructure.repositories import (
    SqliteCheckInRepository,
    SqliteCurrentStateSnapshotRepository,
    SqliteGoalAnalysisRepository,
    SqliteGoalRepository,
    SqliteLifeMapRepository,
    SqliteProfileRepository,
    SqliteRevisionProposalRepository,
    SqliteRouteSelectionRepository,
    SqliteSourceChunkRepository,
    SqliteSourceRepository,
    SqliteStateUpdateRepository,
)
from lifemap_api.infrastructure.vector_store import (
    LanceDBSourceSearchIndex,
    RecoveringSourceSearchIndex,
)


def get_profile_repository(session: Session = Depends(get_session)) -> SqliteProfileRepository:
    return SqliteProfileRepository(session)


def get_goal_repository(session: Session = Depends(get_session)) -> SqliteGoalRepository:
    return SqliteGoalRepository(session)


def get_goal_analysis_repository(
    session: Session = Depends(get_session),
) -> SqliteGoalAnalysisRepository:
    return SqliteGoalAnalysisRepository(session)


def get_lifemap_repository(session: Session = Depends(get_session)) -> SqliteLifeMapRepository:
    return SqliteLifeMapRepository(session)


def get_source_repository(session: Session = Depends(get_session)) -> SqliteSourceRepository:
    return SqliteSourceRepository(session)


def get_source_chunk_repository(
    session: Session = Depends(get_session),
) -> SqliteSourceChunkRepository:
    return SqliteSourceChunkRepository(session)


def get_checkin_repository(session: Session = Depends(get_session)) -> SqliteCheckInRepository:
    return SqliteCheckInRepository(session)


def get_current_state_snapshot_repository(
    session: Session = Depends(get_session),
) -> SqliteCurrentStateSnapshotRepository:
    return SqliteCurrentStateSnapshotRepository(session)


def get_state_update_repository(
    session: Session = Depends(get_session),
) -> SqliteStateUpdateRepository:
    return SqliteStateUpdateRepository(session)


def get_route_selection_repository(
    session: Session = Depends(get_session),
) -> SqliteRouteSelectionRepository:
    return SqliteRouteSelectionRepository(session)


def get_revision_proposal_repository(
    session: Session = Depends(get_session),
) -> SqliteRevisionProposalRepository:
    return SqliteRevisionProposalRepository(session)


def get_llm_provider() -> LLMProvider:
    return build_llm_provider(get_settings())


def get_embedding_provider() -> EmbeddingProvider:
    return DeterministicEmbeddingProvider()


def get_source_search_index(
    source_repo: SqliteSourceRepository = Depends(get_source_repository),
    chunk_repo: SqliteSourceChunkRepository = Depends(get_source_chunk_repository),
    embedding_provider: EmbeddingProvider = Depends(get_embedding_provider),
) -> SourceSearchIndex:
    return RecoveringSourceSearchIndex(
        delegate=LanceDBSourceSearchIndex(get_settings().lancedb_uri),
        source_repo=source_repo,
        chunk_repo=chunk_repo,
        embedding_provider=embedding_provider,
    )
