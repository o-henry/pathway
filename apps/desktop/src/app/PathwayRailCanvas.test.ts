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
  it("uses the generated goal node as the single display goal", () => {
    const bundle = buildTerminalGoalDisplayBundle(bundleFixture(), "User goal");

    const originalGoal = bundle.nodes.find((node) => node.id === "n_goal");
    const terminalGoal = bundle.nodes.find(
      (node) => node.data.pathway_display_role === "terminal_goal",
    );

    expect(originalGoal?.data.pathway_display_role).toBe("primary_goal");
    expect(originalGoal?.label).toBe("User goal");
    expect(terminalGoal).toBeUndefined();
    expect(bundle.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "e_goal_route", source: "n_goal", target: "n_route" }),
      ]),
    );
    expect(bundle.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "n_route", target: "terminal_goal" }),
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
  it("creates a single root display goal when a bundle has no goal node", () => {
    const bundle = buildTerminalGoalDisplayBundle(branchedRouteBundleFixture(), "Native conversation");
    const layout = buildPathwayLayout(bundle);
    const nodeById = new Map(layout.nodes.map((item) => [item.node.id, item]));

    const displayGoal = layout.nodes.find((item) => item.node.data.pathway_display_role === "primary_goal");
    const shortRoute = nodeById.get("n_short");
    const deepRoute = nodeById.get("n_deep");

    expect(displayGoal?.node.id).toBe("display_goal");
    expect(displayGoal?.depth).toBe(0);
    expect(shortRoute?.depth).toBeLessThan(deepRoute?.depth ?? 0);
    expect(shortRoute?.x).toBeGreaterThan(displayGoal?.x ?? 0);
  });

  it("keeps a generated goal as the only GOAL and lays branches to its right", () => {
    const bundle = buildTerminalGoalDisplayBundle({
      ...branchedRouteBundleFixture(),
      ontology: {
        ...branchedRouteBundleFixture().ontology,
        node_types: [
          {
            id: "goal_type",
            label: "Goal",
            description: "Goal",
            semantic_role: "goal",
            fields: [],
          },
          ...branchedRouteBundleFixture().ontology.node_types,
        ],
      },
      nodes: [
        {
          id: "n_goal",
          type: "goal_type",
          label: "Generated goal",
          summary: "Generated goal",
          data: {},
          evidence_refs: [],
          assumption_refs: [],
        },
        ...branchedRouteBundleFixture().nodes,
      ],
      edges: [
        {
          id: "e_goal_start",
          type: "progression",
          source: "n_goal",
          target: "n_start",
        },
        ...branchedRouteBundleFixture().edges,
      ],
    }, "Native conversation");
    const layout = buildPathwayLayout(bundle);
    const nodeById = new Map(layout.nodes.map((item) => [item.node.id, item]));
    const goal = nodeById.get("n_goal");
    const start = nodeById.get("n_start");
    const shortRoute = nodeById.get("n_short");
    const deepRoute = nodeById.get("n_deep");

    expect(bundle.nodes.filter((node) => node.data.pathway_display_role === "primary_goal")).toHaveLength(1);
    expect(bundle.nodes.filter((node) => node.data.pathway_display_role === "terminal_goal")).toHaveLength(0);
    expect(goal?.depth).toBe(0);
    expect(start?.depth).toBe(1);
    expect(shortRoute?.x).toBeGreaterThan(goal?.x ?? 0);
    expect(deepRoute?.x).toBeGreaterThan(shortRoute?.x ?? 0);
  });

  it("moves isolated context-only nodes to a right-side grid instead of the root lane", () => {
    const source = branchedRouteBundleFixture();
    const bundle = buildTerminalGoalDisplayBundle({
      ...source,
      ontology: {
        ...source.ontology,
        node_types: [
          ...source.ontology.node_types,
          {
            id: "risk_type",
            label: "Risk",
            description: "Risk context",
            semantic_role: "risk",
            fields: [],
          },
        ],
      },
      nodes: [
        ...source.nodes,
        {
          id: "n_context_orphan",
          type: "risk_type",
          label: "Context-only note",
          summary: "This node has no progression edges and should not stretch the main route lane.",
          data: {},
          evidence_refs: [],
          assumption_refs: [],
        },
      ],
    }, "Native conversation");
    const layout = buildPathwayLayout(bundle);
    const nodeById = new Map(layout.nodes.map((item) => [item.node.id, item]));
    const contextNode = nodeById.get("n_context_orphan");
    const maxMainRouteX = Math.max(
      ...layout.nodes
        .filter((item) => item.node.id !== "n_context_orphan")
        .map((item) => item.x + item.width),
    );

    expect(contextNode?.x).toBeGreaterThan(maxMainRouteX);
  });
});
