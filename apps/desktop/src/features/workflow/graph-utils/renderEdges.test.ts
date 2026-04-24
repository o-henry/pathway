import { describe, expect, it } from "vitest";
import type { GraphNode } from "../types";
import { buildCanvasEdgeLines } from "./renderEdges";
import { NODE_HEIGHT, NODE_WIDTH } from "./shared";

function makeTurnNode(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: "turn",
    position: { x, y },
    config: {},
  };
}

function pathPoints(path: string): Array<{ x: number; y: number }> {
  return [...path.matchAll(/[ML]\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

describe("buildCanvasEdgeLines", () => {
  it("uses a simple 3-segment orthogonal route for a single opposite horizontal edge", () => {
    const fromNode = makeTurnNode("from", 80, 260);
    const toNode = makeTurnNode("to", 440, 120);

    const lines = buildCanvasEdgeLines({
      entries: [
        {
          edge: {
            from: { nodeId: fromNode.id, port: "out", side: "right" },
            to: { nodeId: toNode.id, port: "in", side: "left" },
          },
          edgeKey: "from:out->to:in",
          readOnly: false,
        },
      ],
      nodeMap: new Map([
        [fromNode.id, fromNode],
        [toNode.id, toNode],
      ]),
      getNodeVisualSize: () => ({ width: NODE_WIDTH, height: NODE_HEIGHT }),
    });

    expect(lines).toHaveLength(1);
    const [line] = lines;
    const segmentCount = (line.path.match(/ L /g) ?? []).length;
    expect(segmentCount).toBe(3);
  });

  it("aligns close bundled split and merge lanes on one shared trunk", () => {
    const nodeSize = { width: 220, height: 56 };
    const environmentNode = makeTurnNode("environment", 80, 80);
    const practiceNode = makeTurnNode("practice", 80, 236);
    const checkpointNode = makeTurnNode("checkpoint", 404, 158);
    const constraintNode = makeTurnNode("constraint", 404, 236);

    const lines = buildCanvasEdgeLines({
      entries: [
        {
          edge: {
            from: { nodeId: environmentNode.id, port: "out" },
            to: { nodeId: checkpointNode.id, port: "in" },
          },
          edgeKey: "environment:checkpoint",
          readOnly: false,
        },
        {
          edge: {
            from: { nodeId: practiceNode.id, port: "out" },
            to: { nodeId: checkpointNode.id, port: "in" },
          },
          edgeKey: "practice:checkpoint",
          readOnly: false,
        },
        {
          edge: {
            from: { nodeId: practiceNode.id, port: "out" },
            to: { nodeId: constraintNode.id, port: "in" },
          },
          edgeKey: "practice:constraint",
          readOnly: false,
        },
      ],
      nodeMap: new Map([
        [environmentNode.id, environmentNode],
        [practiceNode.id, practiceNode],
        [checkpointNode.id, checkpointNode],
        [constraintNode.id, constraintNode],
      ]),
      getNodeVisualSize: () => nodeSize,
    });

    const environmentToCheckpoint = lines.find((line) => line.edgeKey === "environment:checkpoint");
    const practiceToCheckpoint = lines.find((line) => line.edgeKey === "practice:checkpoint");
    expect(environmentToCheckpoint).toBeTruthy();
    expect(practiceToCheckpoint).toBeTruthy();

    const environmentLaneX = pathPoints(environmentToCheckpoint?.path ?? "")[1]?.x;
    const practiceLaneX = pathPoints(practiceToCheckpoint?.path ?? "")[1]?.x;
    expect(environmentLaneX).toBe(352);
    expect(practiceLaneX).toBe(environmentLaneX);
  });
});
