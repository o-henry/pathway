from datetime import date

from sqlmodel import Session

from lifemap_api.domain.models import (
    CheckInCreate,
    GoalCreate,
    GoalUpdate,
    LifeMapCreate,
    ProfileUpsert,
    SourceDocumentCreate,
)
from lifemap_api.infrastructure.db import build_engine
from lifemap_api.infrastructure.db_models import SQLModel
from lifemap_api.infrastructure.repositories import (
    SqliteCheckInRepository,
    SqliteGoalRepository,
    SqliteLifeMapRepository,
    SqliteProfileRepository,
    SqliteSourceRepository,
)

from .graph_bundle_fixture import clone_bundle


def test_sqlite_repositories_round_trip(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'repo-test.db'}"
    engine = build_engine(database_url)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        profile_repo = SqliteProfileRepository(session)
        goal_repo = SqliteGoalRepository(session)
        map_repo = SqliteLifeMapRepository(session)
        source_repo = SqliteSourceRepository(session)
        checkin_repo = SqliteCheckInRepository(session)

        profile = profile_repo.upsert_default(
            ProfileUpsert(
                display_name="Henry",
                weekly_free_hours=5,
                preference_tags=["solo", "curious"],
            )
        )
        goal = goal_repo.create(
            GoalCreate(
                profile_id=profile.id,
                title="Learn Japanese",
                description="Travel conversation focus",
                category="language",
                deadline=date(2026, 10, 1),
                success_criteria="Order food and ask directions confidently",
                status="active",
            )
        )
        updated_goal = goal_repo.update(goal.id, GoalUpdate(status="paused"))
        life_map = map_repo.create(
            LifeMapCreate(
                goal_id=goal.id,
                title="Starter route map",
                graph_bundle=clone_bundle(),
            )
        )
        source = source_repo.create_manual(
            SourceDocumentCreate(
                title="My note",
                content_text="Speaking practice needs to start early.",
            )
        )
        checkin = checkin_repo.create(
            goal.id,
            CheckInCreate(
                map_id=life_map.id,
                progress_summary="Completed hiragana review.",
                blockers="Grammar still feels slippery.",
            ),
        )

        assert profile.display_name == "Henry"
        assert updated_goal is not None
        assert updated_goal.status == "paused"
        assert map_repo.get(life_map.id) is not None
        assert map_repo.get(life_map.id).graph_bundle.bundle_id == "gb_test_001"
        assert source_repo.get(source.id) is not None
        assert checkin_repo.list_for_goal(goal.id)[0].id == checkin.id
