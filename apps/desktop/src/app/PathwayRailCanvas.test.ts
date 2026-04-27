import { describe, expect, it } from "vitest";

import { buildTerminalGoalDisplayBundle } from "./PathwayRailCanvas";
import type { GraphBundle } from "../lib/types";

function bundleFixture(): GraphBundle {
  return {
    schema_version: "1.0.0",
    bundle_id: "bundle_test",
    map: {
      title: "Speaking route",
      goal_id: "goal_test",
      summary: "A route map",
    },
    ontology: {
      node_types: [
        {
          id: "goal_type",
          label: "Goal",
          description: "Original generated goal node",
          semantic_role: "goal",
          fields: [],
        },
        {
          id: "route_type",
          label: "Route",
          description: "Route node",
          semantic_role: "route",
          fields: [],
        },
        {
          id: "evidence_type",
          label: "Evidence",
          description: "Evidence node",
          semantic_role: "evidence",
          fields: [],
        },
      ],
      edge_types: [
        {
          id: "progression",
          label: "Progression",
          role: "progression",
        },
      ],
    },
    nodes: [
      {
        id: "n_goal",
        type: "goal_type",
        label: "Original goal",
        summary: "The source goal should stay as the graph entry point.",
        data: {},
        evidence_refs: [],
        assumption_refs: [],
      },
      {
        id: "n_route",
        type: "route_type",
        label: "Route leaf",
        summary: "A route leaf can converge to the terminal goal.",
        data: {},
        evidence_refs: [],
        assumption_refs: [],
      },
      {
        id: "n_evidence",
        type: "evidence_type",
        label: "Evidence leaf",
        summary: "Evidence should not create a visual terminal-goal ladder edge.",
        data: {},
        evidence_refs: [],
        assumption_refs: [],
      },
    ],
    edges: [
      {
        id: "e_goal_route",
        type: "progression",
        source: "n_goal",
        target: "n_route",
      },
      {
        id: "e_goal_evidence",
        type: "progression",
        source: "n_goal",
        target: "n_evidence",
      },
    ],
    evidence: [],
    assumptions: [],
    warnings: [],
  };
}

describe("buildTerminalGoalDisplayBundle", () => {
  it("preserves the generated goal node and adds a separate terminal display goal", () => {
    const bundle = buildTerminalGoalDisplayBundle(bundleFixture(), "User goal");

    const originalGoal = bundle.nodes.find((node) => node.id === "n_goal");
    const terminalGoal = bundle.nodes.find(
      (node) => node.data.pathway_display_role === "terminal_goal",
    );

    expect(originalGoal?.data.pathway_display_role).toBeUndefined();
    expect(terminalGoal?.id).toBe("terminal_goal");
    expect(terminalGoal?.label).toBe("User goal");
    expect(bundle.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "e_goal_route", source: "n_goal", target: "n_route" }),
        expect.objectContaining({ source: "n_route", target: "terminal_goal" }),
      ]),
    );
    expect(bundle.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "n_evidence", target: "terminal_goal" }),
      ]),
    );
  });
});
