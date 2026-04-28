import { describe, expect, it } from "vitest";

import { findRecoveredGeneratedMap } from "./usePathwayMutationController";
import type { GraphBundle, LifeMap } from "../lib/types";

const emptyBundle: GraphBundle = {
  schema_version: "1.0.0",
  bundle_id: "bundle_test",
  map: {
    title: "Test",
    goal_id: "goal_test",
    summary: "Test bundle",
  },
  ontology: {
    node_types: [],
    edge_types: [],
  },
  nodes: [],
  edges: [],
  evidence: [],
  assumptions: [],
  warnings: [],
};

function lifeMap(id: string, updatedAt: string): LifeMap {
  return {
    id,
    title: id,
    goal_id: "goal_test",
    graph_bundle: emptyBundle,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

describe("findRecoveredGeneratedMap", () => {
  it("prefers a map that was not present before generation started", () => {
    const recovered = findRecoveredGeneratedMap(
      [
        lifeMap("old", "2026-04-28T09:00:00.000Z"),
        lifeMap("new", "2026-04-28T09:10:00.000Z"),
      ],
      new Set(["old"]),
      Date.parse("2026-04-28T09:09:00.000Z"),
    );

    expect(recovered?.id).toBe("new");
  });

  it("falls back to a recent map when the pre-generation map list was unavailable", () => {
    const recovered = findRecoveredGeneratedMap(
      [
        lifeMap("stale", "2026-04-28T08:00:00.000Z"),
        lifeMap("recent", "2026-04-28T09:10:00.000Z"),
      ],
      new Set(),
      Date.parse("2026-04-28T09:09:00.000Z"),
    );

    expect(recovered?.id).toBe("recent");
  });

  it("does not recover a stale map when no new or recent map exists", () => {
    const recovered = findRecoveredGeneratedMap(
      [lifeMap("stale", "2026-04-28T08:00:00.000Z")],
      new Set(),
      Date.parse("2026-04-28T09:09:00.000Z"),
    );

    expect(recovered).toBeNull();
  });
});
