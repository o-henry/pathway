from fastapi import APIRouter, Depends, HTTPException, status

from lifemap_api.api.dependencies import get_profile_repository
from lifemap_api.application.profiles import get_default_profile, upsert_default_profile
from lifemap_api.domain.models import Profile, ProfileUpsert
from lifemap_api.infrastructure.repositories import SqliteProfileRepository

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/default", response_model=Profile)
def read_default_profile(
    repo: SqliteProfileRepository = Depends(get_profile_repository),
) -> Profile:
    profile = get_default_profile(repo)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Default profile not found",
        )
    return profile


@router.put("/default", response_model=Profile)
def put_default_profile(
    payload: ProfileUpsert,
    repo: SqliteProfileRepository = Depends(get_profile_repository),
) -> Profile:
    return upsert_default_profile(repo, payload)
