import { describe, expect, it } from "vitest";

import { buildNodeActionGuidance, getVisibleNodeFields } from "./pathwayWorkspaceUtils";
import type { GraphNodeRecord } from "../lib/types";

function nodeFixture(data: Record<string, unknown> = {}): GraphNodeRecord {
  return {
    id: "node_test",
    type: "route_type",
    label: "AI speaking drill",
    summary: "Practice one short conversation and inspect where the answer stalls.",
    data,
    evidence_refs: [],
    assumption_refs: [],
  };
}

describe("pathwayWorkspaceUtils", () => {
  it("builds a practical fallback when action fields are missing", () => {
    const guidance = buildNodeActionGuidance(nodeFixture(), [], []);

    expect(guidance.title).toBe("오늘 검증할 최소 행동");
    expect(guidance.steps[0]).toContain("AI speaking drill");
    expect(guidance.steps).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Practice one short conversation"),
        expect.stringContaining("기록"),
      ]),
    );
  });

  it("keeps the full personalized curriculum instead of truncating after four steps", () => {
    const guidance = buildNodeActionGuidance(
      nodeFixture({
        user_step: "Do the first drill today.",
        how_to_do_it: "Open one resource, run three attempts, and keep the rough output.",
        success_check: "Three attempts are recorded.",
        record_after: "Write time, friction, and next adjustment.",
        switch_condition: "Switch if the same blocker repeats twice.",
        fit_reason: "Matches the user's low-budget solo preference.",
        personalization_basis: "Uses the user's available evening time.",
        resource_plan: "Use one saved source and one free practice tool.",
        session_cadence: "Two sessions this week.",
        progression_rule: "Advance after two successful sessions.",
        evidence_basis: "Manual note says repeated output matters.",
      }),
      [],
      [],
    );

    expect(guidance.title).toBe("개인화 커리큘럼");
    expect(guidance.steps).toHaveLength(11);
    expect(guidance.steps.at(-1)).toContain("근거 신호");
  });

  it("hides action and display metadata from raw visible fields", () => {
    const fields = getVisibleNodeFields(
      nodeFixture({
        pathway_display_role: "primary_goal",
        user_step: "Speak for five minutes",
        how_to_do_it: "Use a voice agent",
        record_after: "Write what stalled",
        useful_constraint: "free tools only",
      }),
    );

    expect(fields).toEqual([["useful_constraint", "free tools only"]]);
  });
});
