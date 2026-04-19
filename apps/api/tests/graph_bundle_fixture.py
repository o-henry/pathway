from __future__ import annotations

from copy import deepcopy


def build_valid_graph_bundle() -> dict:
    return {
        "schema_version": "1.0.0",
        "bundle_id": "gb_test_001",
        "map": {
            "title": "Japanese Route Test Map",
            "goal_id": "goal_test_001",
            "summary": "Validation fixture for dynamic graph bundles.",
        },
        "ontology": {
            "node_types": [
                {
                    "id": "goal",
                    "label": "Goal",
                    "description": "Top-level goal node",
                    "default_style": {
                        "tone": "lavender",
                        "shape": "rounded_card",
                        "accent": "sketch_border",
                    },
                    "fields": [
                        {
                            "key": "success_criteria",
                            "label": "Success Criteria",
                            "value_type": "markdown",
                            "required": True,
                        }
                    ],
                },
                {
                    "id": "route_choice",
                    "label": "Route Choice",
                    "description": "Strategic route choice node",
                    "default_style": {
                        "tone": "peach",
                        "shape": "rounded_card",
                        "accent": "sketch_border",
                    },
                    "fields": [
                        {
                            "key": "fit_reason",
                            "label": "Why it fits",
                            "value_type": "markdown",
                            "required": True,
                        }
                    ],
                },
            ],
            "edge_types": [
                {
                    "id": "progresses_to",
                    "label": "Progresses To",
                    "role": "progression",
                    "default_style": {"line": "curved", "accent": "sketch_arrow"},
                },
                {
                    "id": "references",
                    "label": "References",
                    "role": "reference",
                    "default_style": {"line": "dotted", "accent": "none"},
                },
            ],
        },
        "nodes": [
            {
                "id": "n_goal",
                "type": "goal",
                "label": "Travel conversation",
                "summary": "Reach basic travel conversation in Japanese.",
                "data": {"success_criteria": "Order food and ask directions."},
                "scores": {"uncertainty": 0.4},
                "evidence_refs": [],
                "assumption_refs": ["as_time"],
                "position": {"x": 0, "y": 0},
                "style_overrides": {},
            },
            {
                "id": "n_route",
                "type": "route_choice",
                "label": "Low-cost self study",
                "summary": "Start with self-study and add speaking later.",
                "data": {"fit_reason": "Fits a low monthly budget."},
                "scores": {"risk": 0.6, "uncertainty": 0.45},
                "evidence_refs": ["ev_001"],
                "assumption_refs": ["as_time"],
                "position": {"x": 240, "y": 140},
                "style_overrides": {},
            },
        ],
        "edges": [
            {
                "id": "e_progress",
                "type": "progresses_to",
                "source": "n_goal",
                "target": "n_route",
                "label": "Start route",
            }
        ],
        "evidence": [
            {
                "id": "ev_001",
                "source_id": "src_001",
                "title": "Saved note",
                "quote_or_summary": "Early speaking practice reduces drop-off risk.",
                "url": None,
                "reliability": "user_saved_note",
            }
        ],
        "assumptions": [
            {
                "id": "as_time",
                "text": "The user can sustain 4 hours a week.",
                "risk_if_false": "The route pace must slow down.",
            }
        ],
        "warnings": ["This graph is a scenario map, not a prediction."],
    }


def clone_bundle() -> dict:
    return deepcopy(build_valid_graph_bundle())
