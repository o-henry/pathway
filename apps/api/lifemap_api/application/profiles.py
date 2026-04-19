from lifemap_api.domain.models import Profile, ProfileUpsert
from lifemap_api.domain.ports import ProfileRepository


def get_default_profile(repo: ProfileRepository) -> Profile | None:
    return repo.get_default()


def upsert_default_profile(repo: ProfileRepository, payload: ProfileUpsert) -> Profile:
    return repo.upsert_default(payload)
