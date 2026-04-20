from fastapi import APIRouter, Depends, HTTPException, status

from lifemap_api.api.dependencies import (
    get_current_state_snapshot_repository,
    get_embedding_provider,
    get_goal_repository,
    get_lifemap_repository,
    get_llm_provider,
    get_profile_repository,
    get_revision_proposal_repository,
    get_route_selection_repository,
    get_state_update_repository,
    get_source_search_index,
)
from lifemap_api.application.errors import (
    AppConfigurationError,
    EntityNotFoundError,
    GenerationFailedError,
    ProviderInvocationError,
)
from lifemap_api.application.maps import get_map
from lifemap_api.application.revisions import create_revision_proposal
from lifemap_api.application.state import get_route_selection, upsert_route_selection
from lifemap_api.config import get_settings
from lifemap_api.domain.models import (
    LifeMap,
    RevisionProposal,
    RevisionProposalRequest,
    RouteSelection,
    RouteSelectionUpsert,
)
from lifemap_api.domain.ports import EmbeddingProvider, LLMProvider, SourceSearchIndex
from lifemap_api.infrastructure.repositories import (
    SqliteCurrentStateSnapshotRepository,
    SqliteGoalRepository,
    SqliteLifeMapRepository,
    SqliteProfileRepository,
    SqliteRevisionProposalRepository,
    SqliteRouteSelectionRepository,
    SqliteStateUpdateRepository,
)

router = APIRouter(prefix="/pathways", tags=["pathways"])


@router.get("/{pathway_id}", response_model=LifeMap)
def read_pathway(
    pathway_id: str,
    repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
) -> LifeMap:
    try:
        return get_map(repo, pathway_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{pathway_id}/route-selection", response_model=RouteSelection | None)
def read_pathway_route_selection(
    pathway_id: str,
    pathway_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    route_selection_repo: SqliteRouteSelectionRepository = Depends(get_route_selection_repository),
) -> RouteSelection | None:
    try:
        return get_route_selection(
            pathway_id=pathway_id,
            pathway_repo=pathway_repo,
            route_selection_repo=route_selection_repo,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{pathway_id}/route-selection", response_model=RouteSelection)
def put_pathway_route_selection(
    pathway_id: str,
    payload: RouteSelectionUpsert,
    pathway_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    route_selection_repo: SqliteRouteSelectionRepository = Depends(get_route_selection_repository),
) -> RouteSelection:
    try:
        return upsert_route_selection(
            pathway_id=pathway_id,
            payload=payload,
            pathway_repo=pathway_repo,
            route_selection_repo=route_selection_repo,
        )
    except (EntityNotFoundError, GenerationFailedError) as exc:
        status_code = (
            status.HTTP_404_NOT_FOUND
            if isinstance(exc, EntityNotFoundError)
            else status.HTTP_422_UNPROCESSABLE_CONTENT
        )
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.post(
    "/{pathway_id}/revision-previews",
    response_model=RevisionProposal,
    status_code=status.HTTP_201_CREATED,
)
def post_pathway_revision_preview(
    pathway_id: str,
    payload: RevisionProposalRequest,
    pathway_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    profile_repo: SqliteProfileRepository = Depends(get_profile_repository),
    state_update_repo: SqliteStateUpdateRepository = Depends(get_state_update_repository),
    current_state_repo: SqliteCurrentStateSnapshotRepository = Depends(
        get_current_state_snapshot_repository
    ),
    route_selection_repo: SqliteRouteSelectionRepository = Depends(get_route_selection_repository),
    proposal_repo: SqliteRevisionProposalRepository = Depends(get_revision_proposal_repository),
    llm_provider: LLMProvider = Depends(get_llm_provider),
    embedding_provider: EmbeddingProvider = Depends(get_embedding_provider),
    search_index: SourceSearchIndex = Depends(get_source_search_index),
) -> RevisionProposal:
    settings = get_settings()
    try:
        return create_revision_proposal(
            map_id=pathway_id,
            checkin_id=payload.checkin_id,
            map_repo=pathway_repo,
            goal_repo=goal_repo,
            profile_repo=profile_repo,
            state_update_repo=state_update_repo,
            current_state_repo=current_state_repo,
            route_selection_repo=route_selection_repo,
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
