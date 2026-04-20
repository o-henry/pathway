from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Session, select

from lifemap_api.domain.models import (
    CheckIn,
    CheckInCreate,
    CurrentStateSnapshot,
    CurrentStateSnapshotUpsert,
    Goal,
    GoalAnalysis,
    GoalCreate,
    GoalUpdate,
    LifeMap,
    LifeMapCreate,
    Profile,
    ProfileUpsert,
    RevisionProposal,
    RevisionProposalCreate,
    ResourceDimension,
    RouteSelection,
    RouteSelectionUpsert,
    StateUpdate,
    StateUpdateCreate,
    SourceChunk,
    SourceChunkCreate,
    SourceDocument,
    SourceDocumentCreate,
)
from lifemap_api.infrastructure.db_models import (
    CheckInRecord,
    CurrentStateSnapshotRecord,
    GoalRecord,
    GoalAnalysisRecord,
    LifeMapRecord,
    ProfileRecord,
    RevisionProposalRecord,
    RouteSelectionRecord,
    StateUpdateRecord,
    SourceChunkRecord,
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


def _goal_analysis_from_record(record: GoalAnalysisRecord) -> GoalAnalysis:
    return GoalAnalysis(
        goal_id=record.goal_id,
        analysis_summary=record.analysis_summary,
        resource_dimensions=[
            ResourceDimension.model_validate(item) for item in record.resource_dimensions_json
        ],
        research_questions=record.research_questions_json,
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


def _state_update_from_record(record: StateUpdateRecord) -> StateUpdate:
    return StateUpdate(
        id=record.id,
        goal_id=record.goal_id,
        pathway_id=record.pathway_id,
        update_date=record.update_date,
        actual_time_spent=record.actual_time_spent,
        actual_money_spent=record.actual_money_spent,
        mood=record.mood,
        progress_summary=record.progress_summary,
        blockers=record.blockers,
        next_adjustment=record.next_adjustment,
        resource_deltas=record.resource_deltas_json,
        learned_items=record.learned_items_json,
        source_refs=record.source_refs_json,
        created_at=record.created_at,
    )


def _legacy_state_update_from_checkin(record: CheckInRecord) -> StateUpdate:
    return StateUpdate(
        id=record.id,
        goal_id=record.goal_id,
        pathway_id=record.map_id,
        legacy_checkin_id=record.id,
        update_date=record.checkin_date,
        actual_time_spent=record.actual_time_spent,
        actual_money_spent=record.actual_money_spent,
        mood=record.mood,
        progress_summary=record.progress_summary,
        blockers=record.blockers,
        next_adjustment=record.next_adjustment,
        resource_deltas={},
        learned_items=[],
        source_refs=[],
        created_at=record.created_at,
    )


def _current_state_from_record(record: CurrentStateSnapshotRecord) -> CurrentStateSnapshot:
    return CurrentStateSnapshot(
        id=record.id,
        goal_id=record.goal_id,
        interview_answers=record.interview_answers_json,
        resource_values=record.resource_values_json,
        active_constraints=record.active_constraints_json,
        state_summary=record.state_summary,
        derived_from_update_ids=record.derived_from_update_ids_json,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _route_selection_from_record(record: RouteSelectionRecord) -> RouteSelection:
    return RouteSelection(
        id=record.id,
        goal_id=record.goal_id,
        pathway_id=record.pathway_id,
        selected_node_id=record.selected_node_id,
        rationale=record.rationale,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _revision_proposal_from_record(record: RevisionProposalRecord) -> RevisionProposal:
    return RevisionProposal(
        id=record.id,
        goal_id=record.goal_id,
        source_map_id=record.source_map_id,
        checkin_id=record.checkin_id,
        status=record.status,
        rationale=record.rationale,
        diff=record.diff_json,
        proposed_graph_bundle=record.proposed_graph_bundle_json,
        accepted_map_id=record.accepted_map_id,
        created_at=record.created_at,
        resolved_at=record.resolved_at,
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


class SqliteGoalAnalysisRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, goal_id: str) -> GoalAnalysis | None:
        record = self.session.get(GoalAnalysisRecord, goal_id)
        return _goal_analysis_from_record(record) if record else None

    def upsert(self, analysis: GoalAnalysis) -> GoalAnalysis:
        now = utc_now()
        record = self.session.get(GoalAnalysisRecord, analysis.goal_id)
        if record is None:
            record = GoalAnalysisRecord(
                goal_id=analysis.goal_id,
                analysis_summary=analysis.analysis_summary,
                resource_dimensions_json=[
                    item.model_dump(mode="json") for item in analysis.resource_dimensions
                ],
                research_questions_json=analysis.research_questions,
                created_at=now,
                updated_at=now,
            )
            self.session.add(record)
        else:
            record.analysis_summary = analysis.analysis_summary
            record.resource_dimensions_json = [
                item.model_dump(mode="json") for item in analysis.resource_dimensions
            ]
            record.research_questions_json = analysis.research_questions
            record.updated_at = now
        self.session.commit()
        self.session.refresh(record)
        return _goal_analysis_from_record(record)


class SqliteLifeMapRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, map_id: str) -> LifeMap | None:
        record = self.session.get(LifeMapRecord, map_id)
        return _map_from_record(record) if record else None

    def list_for_goal(self, goal_id: str) -> list[LifeMap]:
        statement = (
            select(LifeMapRecord)
            .where(LifeMapRecord.goal_id == goal_id)
            .order_by(LifeMapRecord.created_at.desc())
        )
        records = self.session.exec(statement).all()
        return [_map_from_record(record) for record in records]

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

    def find_by_content_hash(self, content_hash: str) -> SourceDocument | None:
        statement = select(SourceDocumentRecord).where(
            SourceDocumentRecord.content_hash == content_hash
        )
        record = self.session.exec(statement).first()
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


class SqliteSourceChunkRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_source(self, source_id: str) -> list[SourceChunk]:
        statement = (
            select(SourceChunkRecord)
            .where(SourceChunkRecord.source_id == source_id)
            .order_by(SourceChunkRecord.chunk_index.asc())
        )
        records = self.session.exec(statement).all()
        return [
            SourceChunk(
                id=record.id,
                source_id=record.source_id,
                chunk_index=record.chunk_index,
                text=record.text,
                token_estimate=record.token_estimate,
                metadata=record.metadata_json,
                embedding_status=record.embedding_status,
                created_at=record.created_at,
            )
            for record in records
        ]

    def replace_for_source(
        self, source_id: str, payloads: list[SourceChunkCreate]
    ) -> list[SourceChunk]:
        existing_records = self.session.exec(
            select(SourceChunkRecord).where(SourceChunkRecord.source_id == source_id)
        ).all()
        for record in existing_records:
            self.session.delete(record)
        self.session.flush()

        created_records: list[SourceChunkRecord] = []
        for payload in payloads:
            record = SourceChunkRecord(
                id=f"chunk_{uuid4().hex}",
                source_id=source_id,
                chunk_index=payload.chunk_index,
                text=payload.text,
                token_estimate=payload.token_estimate,
                metadata_json=payload.metadata,
                embedding_status=payload.embedding_status,
                created_at=utc_now(),
            )
            self.session.add(record)
            created_records.append(record)

        self.session.commit()

        return [
            SourceChunk(
                id=record.id,
                source_id=record.source_id,
                chunk_index=record.chunk_index,
                text=record.text,
                token_estimate=record.token_estimate,
                metadata=record.metadata_json,
                embedding_status=record.embedding_status,
                created_at=record.created_at,
            )
            for record in created_records
        ]


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


class SqliteCurrentStateSnapshotRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_for_goal(self, goal_id: str) -> CurrentStateSnapshot | None:
        statement = select(CurrentStateSnapshotRecord).where(
            CurrentStateSnapshotRecord.goal_id == goal_id
        )
        record = self.session.exec(statement).first()
        return _current_state_from_record(record) if record else None

    def upsert_for_goal(
        self, goal_id: str, payload: CurrentStateSnapshotUpsert
    ) -> CurrentStateSnapshot:
        now = utc_now()
        statement = select(CurrentStateSnapshotRecord).where(
            CurrentStateSnapshotRecord.goal_id == goal_id
        )
        record = self.session.exec(statement).first()
        if record is None:
            record = CurrentStateSnapshotRecord(
                id=f"state_{uuid4().hex}",
                goal_id=goal_id,
                interview_answers_json=payload.interview_answers,
                resource_values_json=payload.resource_values,
                active_constraints_json=payload.active_constraints,
                state_summary=payload.state_summary,
                derived_from_update_ids_json=payload.derived_from_update_ids,
                created_at=now,
                updated_at=now,
            )
            self.session.add(record)
        else:
            record.interview_answers_json = payload.interview_answers
            record.resource_values_json = payload.resource_values
            record.active_constraints_json = payload.active_constraints
            record.state_summary = payload.state_summary
            record.derived_from_update_ids_json = payload.derived_from_update_ids
            record.updated_at = now
        self.session.commit()
        self.session.refresh(record)
        return _current_state_from_record(record)


class SqliteStateUpdateRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_goal(self, goal_id: str) -> list[StateUpdate]:
        current_records = self.session.exec(
            select(StateUpdateRecord)
            .where(StateUpdateRecord.goal_id == goal_id)
            .order_by(StateUpdateRecord.update_date.desc(), StateUpdateRecord.created_at.desc())
        ).all()
        legacy_records = self.session.exec(
            select(CheckInRecord)
            .where(CheckInRecord.goal_id == goal_id)
            .order_by(CheckInRecord.checkin_date.desc(), CheckInRecord.created_at.desc())
        ).all()
        merged = [_state_update_from_record(record) for record in current_records]
        merged.extend(_legacy_state_update_from_checkin(record) for record in legacy_records)
        merged.sort(key=lambda item: (item.update_date, item.created_at), reverse=True)
        return merged

    def create(self, goal_id: str, payload: StateUpdateCreate) -> StateUpdate:
        record = StateUpdateRecord(
            id=f"stateupd_{uuid4().hex}",
            goal_id=goal_id,
            pathway_id=payload.pathway_id,
            update_date=payload.update_date,
            actual_time_spent=payload.actual_time_spent,
            actual_money_spent=payload.actual_money_spent,
            mood=payload.mood,
            progress_summary=payload.progress_summary,
            blockers=payload.blockers,
            next_adjustment=payload.next_adjustment,
            resource_deltas_json=payload.resource_deltas,
            learned_items_json=payload.learned_items,
            source_refs_json=payload.source_refs,
            created_at=utc_now(),
        )
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return _state_update_from_record(record)


class SqliteRouteSelectionRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_for_pathway(self, pathway_id: str) -> RouteSelection | None:
        statement = select(RouteSelectionRecord).where(
            RouteSelectionRecord.pathway_id == pathway_id
        )
        record = self.session.exec(statement).first()
        return _route_selection_from_record(record) if record else None

    def upsert_for_pathway(
        self,
        *,
        goal_id: str,
        pathway_id: str,
        payload: RouteSelectionUpsert,
    ) -> RouteSelection:
        now = utc_now()
        statement = select(RouteSelectionRecord).where(
            RouteSelectionRecord.pathway_id == pathway_id
        )
        record = self.session.exec(statement).first()
        if record is None:
            record = RouteSelectionRecord(
                id=f"routesel_{uuid4().hex}",
                goal_id=goal_id,
                pathway_id=pathway_id,
                selected_node_id=payload.selected_node_id,
                rationale=payload.rationale,
                created_at=now,
                updated_at=now,
            )
            self.session.add(record)
        else:
            record.selected_node_id = payload.selected_node_id
            record.rationale = payload.rationale
            record.updated_at = now
        self.session.commit()
        self.session.refresh(record)
        return _route_selection_from_record(record)


class SqliteRevisionProposalRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, proposal_id: str) -> RevisionProposal | None:
        record = self.session.get(RevisionProposalRecord, proposal_id)
        return _revision_proposal_from_record(record) if record else None

    def create(self, payload: RevisionProposalCreate) -> RevisionProposal:
        record = RevisionProposalRecord(
            id=f"revprop_{uuid4().hex}",
            goal_id=payload.goal_id,
            source_map_id=payload.source_map_id,
            checkin_id=payload.checkin_id,
            status="pending",
            rationale=payload.rationale,
            diff_json=payload.diff.model_dump(mode="json"),
            proposed_graph_bundle_json=payload.proposed_graph_bundle.model_dump(mode="json"),
            created_at=utc_now(),
        )
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return _revision_proposal_from_record(record)

    def update_status(
        self,
        proposal_id: str,
        *,
        status: str,
        accepted_map_id: str | None = None,
    ) -> RevisionProposal | None:
        record = self.session.get(RevisionProposalRecord, proposal_id)
        if record is None:
            return None
        record.status = status
        record.accepted_map_id = accepted_map_id
        record.resolved_at = utc_now()
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return _revision_proposal_from_record(record)
