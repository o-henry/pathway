from fastapi import APIRouter, Depends, HTTPException, status

from lifemap_api.api.dependencies import (
    get_checkin_repository,
    get_embedding_provider,
    get_goal_repository,
    get_lifemap_repository,
    get_llm_provider,
    get_profile_repository,
    get_revision_proposal_repository,
    get_source_search_index,
)
from lifemap_api.application.errors import (
    AppConfigurationError,
    EntityNotFoundError,
    GenerationFailedError,
    ProviderInvocationError,
)
from lifemap_api.application.revisions import (
    accept_revision_proposal,
    create_revision_proposal,
    get_revision_proposal,
    reject_revision_proposal,
)
from lifemap_api.config import get_settings
from lifemap_api.domain.models import (
    LifeMap,
    RevisionProposal,
    RevisionProposalDecision,
    RevisionProposalRequest,
)
from lifemap_api.domain.ports import EmbeddingProvider, LLMProvider, SourceSearchIndex
from lifemap_api.infrastructure.repositories import (
    SqliteCheckInRepository,
    SqliteGoalRepository,
    SqliteLifeMapRepository,
    SqliteProfileRepository,
    SqliteRevisionProposalRepository,
)

router = APIRouter(tags=["revisions"])


@router.post(
    "/maps/{map_id}/revision-proposals",
    response_model=RevisionProposal,
    status_code=status.HTTP_201_CREATED,
)
def post_revision_proposal(
    map_id: str,
    payload: RevisionProposalRequest,
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    profile_repo: SqliteProfileRepository = Depends(get_profile_repository),
    checkin_repo: SqliteCheckInRepository = Depends(get_checkin_repository),
    proposal_repo: SqliteRevisionProposalRepository = Depends(get_revision_proposal_repository),
    llm_provider: LLMProvider = Depends(get_llm_provider),
    embedding_provider: EmbeddingProvider = Depends(get_embedding_provider),
    search_index: SourceSearchIndex = Depends(get_source_search_index),
) -> RevisionProposal:
    settings = get_settings()
    try:
        return create_revision_proposal(
            map_id=map_id,
            checkin_id=payload.checkin_id,
            map_repo=map_repo,
            goal_repo=goal_repo,
            profile_repo=profile_repo,
            checkin_repo=checkin_repo,
            proposal_repo=proposal_repo,
            llm_provider=llm_provider,
            embedding_provider=embedding_provider,
            search_index=search_index,
            query_limit=settings.generation_query_limit,
            hits_per_query=settings.generation_hits_per_query,
            evidence_limit=settings.generation_evidence_limit,
            max_repair_attempts=settings.llm_max_repair_attempts,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AppConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ProviderInvocationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except GenerationFailedError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get("/revision-proposals/{proposal_id}", response_model=RevisionProposal)
def read_revision_proposal(
    proposal_id: str,
    proposal_repo: SqliteRevisionProposalRepository = Depends(get_revision_proposal_repository),
) -> RevisionProposal:
    try:
        return get_revision_proposal(proposal_repo, proposal_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/revision-proposals/{proposal_id}/accept", response_model=LifeMap)
def post_accept_revision_proposal(
    proposal_id: str,
    _: RevisionProposalDecision,
    proposal_repo: SqliteRevisionProposalRepository = Depends(get_revision_proposal_repository),
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
) -> LifeMap:
    try:
        return accept_revision_proposal(
            proposal_id=proposal_id,
            proposal_repo=proposal_repo,
            map_repo=map_repo,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GenerationFailedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/revision-proposals/{proposal_id}/reject", response_model=RevisionProposal)
def post_reject_revision_proposal(
    proposal_id: str,
    _: RevisionProposalDecision,
    proposal_repo: SqliteRevisionProposalRepository = Depends(get_revision_proposal_repository),
) -> RevisionProposal:
    try:
        return reject_revision_proposal(
            proposal_id=proposal_id,
            proposal_repo=proposal_repo,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GenerationFailedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
