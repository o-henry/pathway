from __future__ import annotations

import pytest
from pydantic import ValidationError

from lifemap_api.domain.graph_bundle import GraphBundle, validate_graph_bundle

from .graph_bundle_fixture import clone_bundle


def test_valid_graph_bundle_passes_validation() -> None:
    bundle = validate_graph_bundle(clone_bundle())

    assert isinstance(bundle, GraphBundle)
    assert bundle.bundle_id == "gb_test_001"


def test_invalid_node_type_is_rejected() -> None:
    bundle = clone_bundle()
    bundle["nodes"][0]["type"] = "unknown_type"

    with pytest.raises(ValidationError, match="unknown node type"):
        validate_graph_bundle(bundle)


def test_missing_edge_endpoint_is_rejected() -> None:
    bundle = clone_bundle()
    bundle["edges"][0]["target"] = "n_missing"

    with pytest.raises(ValidationError, match="missing target node"):
        validate_graph_bundle(bundle)


def test_missing_evidence_ref_is_rejected() -> None:
    bundle = clone_bundle()
    bundle["nodes"][1]["evidence_refs"] = ["ev_missing"]

    with pytest.raises(ValidationError, match="missing evidence ids"):
        validate_graph_bundle(bundle)


def test_cycle_in_progression_edges_is_rejected() -> None:
    bundle = clone_bundle()
    bundle["edges"].append(
        {
            "id": "e_cycle",
            "type": "progresses_to",
            "source": "n_route",
            "target": "n_goal",
            "label": "Cycle back",
        }
    )

    with pytest.raises(ValidationError, match="must form a DAG"):
        validate_graph_bundle(bundle)


def test_cycle_in_reference_edges_is_allowed() -> None:
    bundle = clone_bundle()
    bundle["edges"].append(
        {
            "id": "e_reference_cycle",
            "type": "references",
            "source": "n_route",
            "target": "n_goal",
            "label": "Cross reference",
        }
    )

    validated = validate_graph_bundle(bundle)

    assert len(validated.edges) == 2


def test_missing_required_dynamic_field_is_rejected() -> None:
    bundle = clone_bundle()
    bundle["nodes"][1]["data"] = {}

    with pytest.raises(ValidationError, match="missing required fields"):
        validate_graph_bundle(bundle)
