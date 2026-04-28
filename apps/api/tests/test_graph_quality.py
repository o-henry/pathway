from __future__ import annotations

from lifemap_api.application.generation_grounding import GroundingPacket, RetrievalQuery
from lifemap_api.application.graph_quality import (
    attach_missing_decision_evidence,
    enforce_pathway_actions,
    enforce_semantic_roles,
    missing_curriculum_action_keys,
    pathway_grounding_errors,
)
from lifemap_api.domain.graph_bundle import EvidenceItem, GraphBundle

from .graph_bundle_fixture import build_valid_graph_bundle


def _grounding_packet() -> GroundingPacket:
    return GroundingPacket(
        queries=(RetrievalQuery(label="test", text="route evidence"),),
        evidence_items=(
            EvidenceItem(
                id="ev_rag_001",
                source_id="src_001",
                title="Route evidence",
                quote_or_summary="A relevant evidence item for a strangely named route.",
                url=None,
                reliability="manual_note",
            ),
        ),
        warnings=(),
    )


def test_graph_quality_uses_semantic_role_before_marker_text() -> None:
    raw_bundle = build_valid_graph_bundle()
    raw_bundle["ontology"]["node_types"][1].update(
        {
            "id": "custom_semantic_type",
            "label": "Alpha Type",
            "description": "A domain-specific node type",
            "semantic_role": "route",
            "fields": [],
        }
    )
    raw_bundle["nodes"][1].update(
        {
            "type": "custom_semantic_type",
            "label": "Alpha",
            "summary": "A domain-specific plan item without marker words.",
            "data": {},
            "evidence_refs": [],
        }
    )
    bundle = GraphBundle.model_validate(raw_bundle)

    errors = pathway_grounding_errors(bundle, _grounding_packet())
    attached = attach_missing_decision_evidence(bundle, _grounding_packet())

    assert errors
    assert attached.nodes[1].evidence_refs == ["ev_rag_001"]


def test_graph_quality_does_not_marker_match_when_semantic_role_is_explicit() -> None:
    raw_bundle = build_valid_graph_bundle()
    raw_bundle["ontology"]["node_types"][0]["semantic_role"] = "goal"
    raw_bundle["nodes"][0].update(
        {
            "label": "Route-looking goal",
            "summary": "This goal mentions route and fallback words but is still a goal.",
        }
    )
    bundle = GraphBundle.model_validate(raw_bundle)

    errors = pathway_grounding_errors(bundle, _grounding_packet())

    assert "Route-looking goal" not in "; ".join(errors)


def test_generated_graph_quality_requires_semantic_roles() -> None:
    raw_bundle = build_valid_graph_bundle()
    raw_bundle["ontology"]["node_types"][1].pop("semantic_role")
    bundle = GraphBundle.model_validate(raw_bundle)

    try:
        enforce_semantic_roles(bundle)
    except ValueError as exc:
        assert "semantic_role" in str(exc)
        assert "route_choice" in str(exc)
    else:
        raise AssertionError("missing semantic_role should fail generated graph quality")


def test_pathway_actions_require_complete_personalized_curriculum_fields() -> None:
    raw_bundle = build_valid_graph_bundle()
    raw_bundle["nodes"][1].update(
        {
            "data": {
                "user_step": "Do one tiny action.",
                "how_to_do_it": "Use one source and do the action.",
                "fit_reason": "",
            },
            "evidence_refs": ["ev_001"],
        }
    )
    bundle = GraphBundle.model_validate(raw_bundle)

    try:
        enforce_pathway_actions(bundle)
    except ValueError as exc:
        message = str(exc)
        assert "complete personalized curriculum fields" in message
        assert "progression_rule" in message
    else:
        raise AssertionError("partial action data should not pass curriculum quality")

    assert missing_curriculum_action_keys(bundle.nodes[1]) == [
        "success_check",
        "record_after",
        "switch_condition",
        "fit_reason",
        "evidence_basis",
        "personalization_basis",
        "resource_plan",
        "session_cadence",
        "progression_rule",
    ]
