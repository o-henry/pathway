import { describe, expect, it } from "vitest";

import { buildPathwayLayout, buildTerminalGoalDisplayBundle } from "./PathwayRailCanvas";
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

function branchedRouteBundleFixture(): GraphBundle {
  return {
    schema_version: "1.0.0",
    bundle_id: "bundle_branch_layout",
    map: {
      title: "Speaking route",
      goal_id: "goal_test",
      summary: "A route map",
    },
    ontology: {
      node_types: [
        {
          id: "route_type",
          label: "Route",
          description: "Route node",
          semantic_role: "route",
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
        id: "n_start",
        type: "route_type",
        label: "Start",
        summary: "Start route.",
        data: {},
        evidence_refs: [],
        assumption_refs: [],
      },
      {
        id: "n_short",
        type: "route_type",
        label: "Short route leaf",
        summary: "This shallow leaf should not be forced into the last lane.",
        data: {},
        evidence_refs: [],
        assumption_refs: [],
      },
      {
        id: "n_branch",
        type: "route_type",
        label: "Deep branch",
        summary: "Deep branch.",
        data: {},
        evidence_refs: [],
        assumption_refs: [],
      },
      {
        id: "n_practice",
        type: "route_type",
        label: "Practice",
        summary: "Practice route.",
        data: {},
        evidence_refs: [],
        assumption_refs: [],
      },
      {
        id: "n_deep",
        type: "route_type",
        label: "Deep route leaf",
        summary: "Deep terminal route.",
        data: {},
        evidence_refs: [],
        assumption_refs: [],
      },
    ],
    edges: [
      {
        id: "e_start_short",
        type: "progression",
        source: "n_start",
        target: "n_short",
      },
      {
        id: "e_start_branch",
        type: "progression",
        source: "n_start",
        target: "n_branch",
      },
      {
        id: "e_branch_practice",
        type: "progression",
        source: "n_branch",
        target: "n_practice",
      },
      {
        id: "e_practice_deep",
        type: "progression",
        source: "n_practice",
        target: "n_deep",
      },
    ],
    evidence: [],
    assumptions: [],
    warnings: [],
  };
}

describe("buildPathwayLayout", () => {
  it("keeps shallow terminal routes in their natural lane before the display goal", () => {
    const bundle = buildTerminalGoalDisplayBundle(branchedRouteBundleFixture(), "Native conversation");
    const layout = buildPathwayLayout(bundle);
    const nodeById = new Map(layout.nodes.map((item) => [item.node.id, item]));

    const shortRoute = nodeById.get("n_short");
    const deepRoute = nodeById.get("n_deep");
    const terminalGoal = nodeById.get("terminal_goal");
    const maxRouteX = Math.max(
      ...layout.nodes
        .filter((item) => item.node.id !== "terminal_goal")
        .map((item) => item.x + item.width),
    );

    expect(shortRoute?.depth).toBeLessThan(deepRoute?.depth ?? 0);
    expect(terminalGoal?.x).toBeGreaterThan(maxRouteX);
  });
});
