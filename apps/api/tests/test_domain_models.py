from datetime import date

import pytest
from pydantic import ValidationError

from lifemap_api.domain.models import GoalCreate, ProfileUpsert, SourceDocumentCreate


def test_profile_requires_display_name() -> None:
    with pytest.raises(ValidationError):
        ProfileUpsert(display_name="")


def test_goal_defaults_status_to_draft() -> None:
    goal = GoalCreate(
        title="Practice Japanese",
        success_criteria="Hold a basic travel conversation",
        deadline=date(2026, 12, 31),
    )

    assert goal.status == "draft"


def test_source_document_requires_content() -> None:
    with pytest.raises(ValidationError):
        SourceDocumentCreate(title="Empty", content_text="")
