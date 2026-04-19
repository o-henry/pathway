from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Session, select

from lifemap_api.domain.models import (
    CheckIn,
    CheckInCreate,
    Goal,
    GoalCreate,
    GoalUpdate,
    LifeMap,
    LifeMapCreate,
    Profile,
    ProfileUpsert,
    SourceDocument,
    SourceDocumentCreate,
)
from lifemap_api.infrastructure.db_models import (
    CheckInRecord,
    GoalRecord,
    LifeMapRecord,
    ProfileRecord,
    SourceDocumentRecord,
)


def utc_now() -> datetime:
    return datetime.now(UTC)


def _profile_from_record(record: ProfileRecord) -> Profile:
    return Profile(
        id=record.id,
        display_name=record.display_name,
        age=record.age,
        weekly_free_hours=record.weekly_free_hours,
        monthly_budget_amount=record.monthly_budget_amount,
        monthly_budget_currency=record.monthly_budget_currency,
        energy_level=record.energy_level,
        preference_tags=record.preference_tags_json,
        constraints=record.constraints_json,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _goal_from_record(record: GoalRecord) -> Goal:
    return Goal(
        id=record.id,
        profile_id=record.profile_id,
        title=record.title,
        description=record.description,
        category=record.category,
        deadline=record.deadline,
        success_criteria=record.success_criteria,
        status=record.status,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _map_from_record(record: LifeMapRecord) -> LifeMap:
    return LifeMap(
        id=record.id,
        goal_id=record.goal_id,
        title=record.title,
        graph_bundle=record.graph_bundle_json,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _source_from_record(record: SourceDocumentRecord) -> SourceDocument:
    return SourceDocument(
        id=record.id,
        title=record.title,
        content_text=record.content_text,
        url=record.url,
        source_type=record.source_type,
        content_hash=record.content_hash,
        metadata=record.metadata_json,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _checkin_from_record(record: CheckInRecord) -> CheckIn:
    return CheckIn(
        id=record.id,
        goal_id=record.goal_id,
        map_id=record.map_id,
        checkin_date=record.checkin_date,
        actual_time_spent=record.actual_time_spent,
        actual_money_spent=record.actual_money_spent,
        mood=record.mood,
        progress_summary=record.progress_summary,
        blockers=record.blockers,
        next_adjustment=record.next_adjustment,
        created_at=record.created_at,
    )


class SqliteProfileRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_default(self) -> Profile | None:
        record = self.session.get(ProfileRecord, "default")
        return _profile_from_record(record) if record else None

    def upsert_default(self, payload: ProfileUpsert) -> Profile:
        now = utc_now()
        record = self.session.get(ProfileRecord, "default")
        if record is None:
            record = ProfileRecord(
                id="default",
                created_at=now,
                updated_at=now,
                **payload.model_dump(),
            )
            record.preference_tags_json = payload.preference_tags
            record.constraints_json = payload.constraints
            self.session.add(record)
        else:
            record.display_name = payload.display_name
            record.age = payload.age
            record.weekly_free_hours = payload.weekly_free_hours
            record.monthly_budget_amount = payload.monthly_budget_amount
            record.monthly_budget_currency = payload.monthly_budget_currency
            record.energy_level = payload.energy_level
            record.preference_tags_json = payload.preference_tags
            record.constraints_json = payload.constraints
            record.updated_at = now
        self.session.commit()
        self.session.refresh(record)
        return _profile_from_record(record)


class SqliteGoalRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[Goal]:
        records = self.session.exec(select(GoalRecord).order_by(GoalRecord.created_at.desc())).all()
        return [_goal_from_record(record) for record in records]

    def get(self, goal_id: str) -> Goal | None:
        record = self.session.get(GoalRecord, goal_id)
        return _goal_from_record(record) if record else None

    def create(self, payload: GoalCreate) -> Goal:
        now = utc_now()
        record = GoalRecord(
            id=f"goal_{uuid4().hex}",
            created_at=now,
            updated_at=now,
            **payload.model_dump(),
        )
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return _goal_from_record(record)

    def update(self, goal_id: str, payload: GoalUpdate) -> Goal | None:
        record = self.session.get(GoalRecord, goal_id)
        if record is None:
            return None
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(record, key, value)
        record.updated_at = utc_now()
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return _goal_from_record(record)

    def delete(self, goal_id: str) -> bool:
        record = self.session.get(GoalRecord, goal_id)
        if record is None:
            return False
        self.session.delete(record)
        self.session.commit()
        return True


class SqliteLifeMapRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, map_id: str) -> LifeMap | None:
        record = self.session.get(LifeMapRecord, map_id)
        return _map_from_record(record) if record else None

    def create(self, payload: LifeMapCreate) -> LifeMap:
        now = utc_now()
        record = LifeMapRecord(
            id=f"map_{uuid4().hex}",
            goal_id=payload.goal_id,
            title=payload.title,
            graph_bundle_json=payload.graph_bundle.model_dump(mode="json"),
            created_at=now,
            updated_at=now,
        )
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return _map_from_record(record)


class SqliteSourceRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self) -> list[SourceDocument]:
        records = self.session.exec(
            select(SourceDocumentRecord).order_by(SourceDocumentRecord.created_at.desc())
        ).all()
        return [_source_from_record(record) for record in records]

    def get(self, source_id: str) -> SourceDocument | None:
        record = self.session.get(SourceDocumentRecord, source_id)
        return _source_from_record(record) if record else None

    def create_manual(self, payload: SourceDocumentCreate) -> SourceDocument:
        now = utc_now()
        content_hash = hashlib.sha256(payload.content_text.encode("utf-8")).hexdigest()
        record = SourceDocumentRecord(
            id=f"src_{uuid4().hex}",
            title=payload.title,
            url=payload.url,
            source_type=payload.source_type,
            content_text=payload.content_text,
            content_hash=content_hash,
            metadata_json=payload.metadata,
            created_at=now,
            updated_at=now,
        )
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return _source_from_record(record)


class SqliteCheckInRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_goal(self, goal_id: str) -> list[CheckIn]:
        records = self.session.exec(
            select(CheckInRecord)
            .where(CheckInRecord.goal_id == goal_id)
            .order_by(CheckInRecord.checkin_date.desc(), CheckInRecord.created_at.desc())
        ).all()
        return [_checkin_from_record(record) for record in records]

    def create(self, goal_id: str, payload: CheckInCreate) -> CheckIn:
        record = CheckInRecord(
            id=f"checkin_{uuid4().hex}",
            goal_id=goal_id,
            map_id=payload.map_id,
            checkin_date=payload.checkin_date,
            actual_time_spent=payload.actual_time_spent,
            actual_money_spent=payload.actual_money_spent,
            mood=payload.mood,
            progress_summary=payload.progress_summary,
            blockers=payload.blockers,
            next_adjustment=payload.next_adjustment,
            created_at=utc_now(),
        )
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return _checkin_from_record(record)
