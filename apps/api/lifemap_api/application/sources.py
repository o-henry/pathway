from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.domain.models import SourceDocument, SourceDocumentCreate
from lifemap_api.domain.ports import SourceRepository


def list_sources(repo: SourceRepository) -> list[SourceDocument]:
    return repo.list()


def get_source(repo: SourceRepository, source_id: str) -> SourceDocument:
    source = repo.get(source_id)
    if source is None:
        raise EntityNotFoundError("SourceDocument", source_id)
    return source


def create_manual_source(repo: SourceRepository, payload: SourceDocumentCreate) -> SourceDocument:
    return repo.create_manual(payload)
