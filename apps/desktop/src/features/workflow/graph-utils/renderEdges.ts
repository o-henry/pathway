import type { GraphEdge, GraphNode, NodeAnchorSide } from "../types";
import {
  alignAutoEdgePoints,
  buildRoundedEdgePath,
  edgeMidPoint,
  getAutoConnectionSides,
  getNodeAnchorPoint,
} from "./edges";
import type { LogicalPoint, NodeVisualSize } from "./shared";

export type CanvasEdgeEntry = {
  edge: GraphEdge;
  edgeKey: string;
  readOnly: boolean;
};

export type CanvasEdgeLine = {
  key: string;
  edgeKey: string;
  path: string;
  startPoint: LogicalPoint;
  endPoint: LogicalPoint;
  controlPoint: LogicalPoint;
  hasManualControl: boolean;
  readOnly: boolean;
};

type BuildCanvasEdgeLinesParams = {
  entries: CanvasEdgeEntry[];
  nodeMap: Map<string, GraphNode>;
  getNodeVisualSize: (nodeId: string) => NodeVisualSize;
  routeStyle?: "orthogonal" | "straight";
  separateIncomingTargetAnchors?: (node: GraphNode) => boolean;
  preferNearTargetElbow?: (node: GraphNode) => boolean;
};

const BUNDLED_LANE_ALIGNMENT_THRESHOLD = 72;

function laneAxisForSide(side: NodeAnchorSide): "x" | "y" {
  return side === "left" || side === "right" ? "x" : "y";
}

function sidesFaceAcrossLane(fromSide: NodeAnchorSide, toSide: NodeAnchorSide): boolean {
  return (
    (fromSide === "right" && toSide === "left") ||
    (fromSide === "left" && toSide === "right") ||
    (fromSide === "bottom" && toSide === "top") ||
    (fromSide === "top" && toSide === "bottom")
  );
}

function buildOrthogonalPolylinePath(points: LogicalPoint[]): string {
  if (points.length === 0) {
    return "";
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
}

function compressCollinear(points: LogicalPoint[]): LogicalPoint[] {
  if (points.length <= 2) {
    return points;
  }
  const next: LogicalPoint[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (next.length < 2) {
      next.push(point);
      continue;
    }
    const prev = next[next.length - 1];
    const head = next[next.length - 2];
    const collinearX = Math.abs(head.x - prev.x) <= 0.1 && Math.abs(prev.x - point.x) <= 0.1;
    const collinearY = Math.abs(head.y - prev.y) <= 0.1 && Math.abs(prev.y - point.y) <= 0.1;
    if (collinearX || collinearY) {
      next[next.length - 1] = point;
    } else {
      next.push(point);
    }
  }
  return next;
}

function buildStraightPath(start: LogicalPoint, end: LogicalPoint): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

function offsetAnchorPoint(point: LogicalPoint, side: NodeAnchorSide, offset: number): LogicalPoint {
  if (side === "left" || side === "right") {
    return { x: point.x, y: Math.round(point.y + offset) };
  }
  return { x: Math.round(point.x + offset), y: point.y };
}

export function buildCanvasEdgeLines(params: BuildCanvasEdgeLinesParams): CanvasEdgeLine[] {
  const {
    entries,
    nodeMap,
    getNodeVisualSize,
    routeStyle = "orthogonal",
    separateIncomingTargetAnchors,
    preferNearTargetElbow,
  } = params;

  const groupedFrom = new Map<string, CanvasEdgeEntry[]>();
  const groupedTo = new Map<string, CanvasEdgeEntry[]>();
  for (const entry of entries) {
    const fromId = entry.edge.from.nodeId;
    const toId = entry.edge.to.nodeId;
    const fromRows = groupedFrom.get(fromId) ?? [];
    const toRows = groupedTo.get(toId) ?? [];
    fromRows.push(entry);
    toRows.push(entry);
    groupedFrom.set(fromId, fromRows);
    groupedTo.set(toId, toRows);
  }

  const bundledFromSideByNodeId = new Map<string, NodeAnchorSide>();
  groupedFrom.forEach((groupedEntries, fromId) => {
    if (groupedEntries.length < 2) {
      return;
    }
    const fromNode = nodeMap.get(fromId);
    if (!fromNode) {
      return;
    }
    const fromSize = getNodeVisualSize(fromNode.id);
    const fromCenterX = fromNode.position.x + fromSize.width / 2;
    const fromCenterY = fromNode.position.y + fromSize.height / 2;
    let sumDx = 0;
    let sumDy = 0;
    let targetCount = 0;
    for (const entry of groupedEntries) {
      const toNode = nodeMap.get(entry.edge.to.nodeId);
      if (!toNode) {
        continue;
      }
      const toSize = getNodeVisualSize(toNode.id);
      const toCenterX = toNode.position.x + toSize.width / 2;
      const toCenterY = toNode.position.y + toSize.height / 2;
      sumDx += toCenterX - fromCenterX;
      sumDy += toCenterY - fromCenterY;
      targetCount += 1;
    }
    if (targetCount === 0) {
      return;
    }
    const avgDx = sumDx / targetCount;
    const avgDy = sumDy / targetCount;
    const side: NodeAnchorSide =
      Math.abs(avgDx) >= Math.abs(avgDy) ? (avgDx >= 0 ? "right" : "left") : avgDy >= 0 ? "bottom" : "top";
    bundledFromSideByNodeId.set(fromId, side);
  });

  const bundledToSideByNodeId = new Map<string, NodeAnchorSide>();
  groupedTo.forEach((groupedEntries, toId) => {
    if (groupedEntries.length < 2) {
      return;
    }
    const toNode = nodeMap.get(toId);
    if (!toNode) {
      return;
    }
    if (separateIncomingTargetAnchors?.(toNode)) {
      return;
    }
    const toSize = getNodeVisualSize(toNode.id);
    const toCenterX = toNode.position.x + toSize.width / 2;
    const toCenterY = toNode.position.y + toSize.height / 2;
    let sumDx = 0;
    let sumDy = 0;
    let sourceCount = 0;
    for (const entry of groupedEntries) {
      const fromNode = nodeMap.get(entry.edge.from.nodeId);
      if (!fromNode) {
        continue;
      }
      const fromSize = getNodeVisualSize(fromNode.id);
      const fromCenterX = fromNode.position.x + fromSize.width / 2;
      const fromCenterY = fromNode.position.y + fromSize.height / 2;
      sumDx += toCenterX - fromCenterX;
      sumDy += toCenterY - fromCenterY;
      sourceCount += 1;
    }
    if (sourceCount === 0) {
      return;
    }
    const avgDx = sumDx / sourceCount;
    const avgDy = sumDy / sourceCount;
    const side: NodeAnchorSide =
      Math.abs(avgDx) >= Math.abs(avgDy) ? (avgDx >= 0 ? "left" : "right") : avgDy >= 0 ? "top" : "bottom";
    bundledToSideByNodeId.set(toId, side);
  });

  const snapPoint = (point: LogicalPoint): LogicalPoint => ({
    x: Math.round(point.x),
    y: Math.round(point.y),
  });

  const bundledFromAnchorByNodeId = new Map<string, LogicalPoint>();
  bundledFromSideByNodeId.forEach((side, nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return;
    }
    const size = getNodeVisualSize(node.id);
    bundledFromAnchorByNodeId.set(nodeId, snapPoint(getNodeAnchorPoint(node, side, size)));
  });

  const bundledFromLaneByNodeId = new Map<string, number>();
  bundledFromSideByNodeId.forEach((side, nodeId) => {
    const anchor = bundledFromAnchorByNodeId.get(nodeId);
    if (!anchor) {
      return;
    }
    bundledFromLaneByNodeId.set(
      nodeId,
      side === "right" || side === "bottom" ? anchor[side === "right" ? "x" : "y"] + 34 : anchor[side === "left" ? "x" : "y"] - 34,
    );
  });

  const bundledToAnchorByNodeId = new Map<string, LogicalPoint>();
  bundledToSideByNodeId.forEach((side, nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return;
    }
    const size = getNodeVisualSize(node.id);
    bundledToAnchorByNodeId.set(nodeId, snapPoint(getNodeAnchorPoint(node, side, size)));
  });

  const bundledToLaneByNodeId = new Map<string, number>();
  bundledToSideByNodeId.forEach((side, nodeId) => {
    const anchor = bundledToAnchorByNodeId.get(nodeId);
    if (!anchor) {
      return;
    }
    bundledToLaneByNodeId.set(
      nodeId,
      side === "right" || side === "bottom" ? anchor[side === "right" ? "x" : "y"] + 34 : anchor[side === "left" ? "x" : "y"] - 34,
    );
  });

  for (const entry of entries) {
    const fromId = entry.edge.from.nodeId;
    const toId = entry.edge.to.nodeId;
    const fromSide = bundledFromSideByNodeId.get(fromId);
    const toSide = bundledToSideByNodeId.get(toId);
    if (!fromSide || !toSide || !sidesFaceAcrossLane(fromSide, toSide)) {
      continue;
    }
    if (laneAxisForSide(fromSide) !== laneAxisForSide(toSide)) {
      continue;
    }

    const fromLane = bundledFromLaneByNodeId.get(fromId);
    const toLane = bundledToLaneByNodeId.get(toId);
    if (fromLane == null || toLane == null) {
      continue;
    }
    if (Math.abs(fromLane - toLane) > BUNDLED_LANE_ALIGNMENT_THRESHOLD) {
      continue;
    }

    const sharedLane = Math.round((fromLane + toLane) / 2);
    bundledFromLaneByNodeId.set(fromId, sharedLane);
    bundledToLaneByNodeId.set(toId, sharedLane);
  }

  return entries
    .map((entry, index) => {
      const edge = entry.edge;
      const fromNode = nodeMap.get(edge.from.nodeId);
      const toNode = nodeMap.get(edge.to.nodeId);
      if (!fromNode || !toNode) {
        return null;
      }

      const fromSize = getNodeVisualSize(fromNode.id);
      const toSize = getNodeVisualSize(toNode.id);
      const auto = getAutoConnectionSides(fromNode, toNode, fromSize, toSize);
      const hasManualControl = false;
      const hasExplicitSides = Boolean(edge.from.side || edge.to.side);
      const bundledFromSide = bundledFromSideByNodeId.get(fromNode.id);
      const bundledToSide = bundledToSideByNodeId.get(toNode.id);
      const resolvedFromSide = edge.from.side ?? bundledFromSide ?? auto.fromSide;
      const resolvedToSide = edge.to.side ?? bundledToSide ?? auto.toSide;
      let fromPoint = bundledFromSide
        ? (bundledFromAnchorByNodeId.get(fromNode.id) ??
          snapPoint(getNodeAnchorPoint(fromNode, resolvedFromSide, fromSize)))
        : snapPoint(getNodeAnchorPoint(fromNode, resolvedFromSide, fromSize));
      let toPoint = bundledToSide
        ? (bundledToAnchorByNodeId.get(toNode.id) ?? snapPoint(getNodeAnchorPoint(toNode, resolvedToSide, toSize)))
        : snapPoint(getNodeAnchorPoint(toNode, resolvedToSide, toSize));

      if (!bundledToSide && separateIncomingTargetAnchors?.(toNode)) {
        const incomingRows = groupedTo.get(toNode.id) ?? [];
        if (incomingRows.length > 1) {
          const orderedRows = [...incomingRows].sort((left, right) => {
            const leftNode = nodeMap.get(left.edge.from.nodeId);
            const rightNode = nodeMap.get(right.edge.from.nodeId);
            const leftSize = leftNode ? getNodeVisualSize(leftNode.id) : { width: 0, height: 0 };
            const rightSize = rightNode ? getNodeVisualSize(rightNode.id) : { width: 0, height: 0 };
            const leftCenter =
              resolvedToSide === "left" || resolvedToSide === "right"
                ? (leftNode?.position.y ?? 0) + leftSize.height / 2
                : (leftNode?.position.x ?? 0) + leftSize.width / 2;
            const rightCenter =
              resolvedToSide === "left" || resolvedToSide === "right"
                ? (rightNode?.position.y ?? 0) + rightSize.height / 2
                : (rightNode?.position.x ?? 0) + rightSize.width / 2;
            return leftCenter - rightCenter;
          });
          const rowIndex = orderedRows.findIndex((row) => row === entry);
          if (rowIndex >= 0) {
            const axisLength = resolvedToSide === "left" || resolvedToSide === "right" ? toSize.height : toSize.width;
            const maxSpread = Math.max(0, axisLength - 16);
            const step = incomingRows.length > 1 ? Math.min(32, maxSpread / (incomingRows.length - 1)) : 0;
            const offset = (rowIndex - (incomingRows.length - 1) / 2) * step;
            toPoint = offsetAnchorPoint(toPoint, resolvedToSide, offset);
          }
        }
      }

      const routeFromSide = bundledFromSide ?? resolvedFromSide;
      const routeToSide = bundledToSide ?? resolvedToSide;
      const fromHorizontal = routeFromSide === "left" || routeFromSide === "right";
      const toHorizontal = routeToSide === "left" || routeToSide === "right";
      const fromVertical = !fromHorizontal;
      const toVertical = !toHorizontal;

      if (!hasManualControl && !hasExplicitSides && !bundledFromSide && !bundledToSide) {
        const aligned = alignAutoEdgePoints(
          fromNode,
          toNode,
          fromPoint,
          toPoint,
          resolvedFromSide,
          resolvedToSide,
          fromSize,
          toSize,
        );
        fromPoint = snapPoint(aligned.fromPoint);
        toPoint = snapPoint(aligned.toPoint);
      }

      const edgeKey = entry.edgeKey;
      const defaultControl = edgeMidPoint(fromPoint, toPoint);
      const control = defaultControl;
      const hasBundledRouting = !hasManualControl && Boolean(bundledFromSide || bundledToSide);

      let path: string;
      if (routeStyle === "straight") {
        path = buildStraightPath(fromPoint, toPoint);
      } else if (hasBundledRouting && toHorizontal) {
        const fromCenterX = fromNode.position.x + fromSize.width / 2;
        const virtualFromSide: NodeAnchorSide = toPoint.x >= fromCenterX ? "right" : "left";
        const virtualFromPoint = fromHorizontal
          ? fromPoint
          : snapPoint(getNodeAnchorPoint(fromNode, virtualFromSide, fromSize));
        fromPoint = virtualFromPoint;
        const verticalGap = Math.abs(toPoint.y - virtualFromPoint.y);
        const horizontalGapRaw = Math.abs(toPoint.x - virtualFromPoint.x);
        const sharedLaneX =
          bundledFromLaneByNodeId.get(fromNode.id) ??
          bundledToLaneByNodeId.get(toNode.id) ??
          null;
        if (verticalGap <= 18) {
          const laneX = sharedLaneX ?? Math.round((virtualFromPoint.x + toPoint.x) / 2);
          path = buildOrthogonalPolylinePath(
            compressCollinear([
              virtualFromPoint,
              { x: laneX, y: virtualFromPoint.y },
              { x: laneX, y: toPoint.y },
              toPoint,
            ]),
          );
        } else if (horizontalGapRaw <= 120) {
          const laneX = sharedLaneX ?? Math.round((virtualFromPoint.x + toPoint.x) / 2);
          path = buildOrthogonalPolylinePath(
            compressCollinear([
              virtualFromPoint,
              { x: laneX, y: virtualFromPoint.y },
              { x: laneX, y: toPoint.y },
              toPoint,
            ]),
          );
        } else {
          const gap = Math.max(24, Math.round(horizontalGapRaw * 0.38));
          const laneX = sharedLaneX ?? (bundledFromSide
            ? (routeFromSide === "right" ? virtualFromPoint.x + gap : virtualFromPoint.x - gap)
            : bundledToSide
              ? (routeToSide === "left" ? toPoint.x - gap : toPoint.x + gap)
              : Math.round((virtualFromPoint.x + toPoint.x) / 2));
          const points = compressCollinear([
            virtualFromPoint,
            { x: laneX, y: virtualFromPoint.y },
            { x: laneX, y: toPoint.y },
            toPoint,
          ]);
          path = buildOrthogonalPolylinePath(points);
        }
      } else if (hasBundledRouting && toVertical) {
        const fromCenterY = fromNode.position.y + fromSize.height / 2;
        const virtualFromSide: NodeAnchorSide = toPoint.y >= fromCenterY ? "bottom" : "top";
        const virtualFromPoint = fromVertical
          ? fromPoint
          : snapPoint(getNodeAnchorPoint(fromNode, virtualFromSide, fromSize));
        fromPoint = virtualFromPoint;
        const horizontalGap = Math.abs(toPoint.x - virtualFromPoint.x);
        const verticalGapRaw = Math.abs(toPoint.y - virtualFromPoint.y);
        const sharedLaneY =
          bundledFromLaneByNodeId.get(fromNode.id) ??
          bundledToLaneByNodeId.get(toNode.id) ??
          null;
        if (horizontalGap <= 18) {
          const laneY = sharedLaneY ?? Math.round((virtualFromPoint.y + toPoint.y) / 2);
          path = buildOrthogonalPolylinePath(
            compressCollinear([
              virtualFromPoint,
              { x: virtualFromPoint.x, y: laneY },
              { x: toPoint.x, y: laneY },
              toPoint,
            ]),
          );
        } else if (verticalGapRaw <= 120) {
          const laneY = sharedLaneY ?? Math.round((virtualFromPoint.y + toPoint.y) / 2);
          path = buildOrthogonalPolylinePath(
            compressCollinear([
              virtualFromPoint,
              { x: virtualFromPoint.x, y: laneY },
              { x: toPoint.x, y: laneY },
              toPoint,
            ]),
          );
        } else {
          const gap = Math.max(24, Math.round(verticalGapRaw * 0.38));
          const laneY = sharedLaneY ?? (bundledFromSide
            ? (routeFromSide === "bottom" ? virtualFromPoint.y + gap : virtualFromPoint.y - gap)
            : bundledToSide
              ? (routeToSide === "top" ? toPoint.y - gap : toPoint.y + gap)
              : Math.round((virtualFromPoint.y + toPoint.y) / 2));
          const points = compressCollinear([
            virtualFromPoint,
            { x: virtualFromPoint.x, y: laneY },
            { x: toPoint.x, y: laneY },
            toPoint,
          ]);
          path = buildOrthogonalPolylinePath(points);
        }
      } else {
        const isOppositeHorizontal =
          (routeFromSide === "left" && routeToSide === "right") ||
          (routeFromSide === "right" && routeToSide === "left");
        const isOppositeVertical =
          (routeFromSide === "top" && routeToSide === "bottom") ||
          (routeFromSide === "bottom" && routeToSide === "top");
        const shouldUseSimpleSingleRoute =
          !hasManualControl &&
          !hasBundledRouting &&
          (isOppositeHorizontal || isOppositeVertical);

        if (shouldUseSimpleSingleRoute) {
          const preferTargetElbow = preferNearTargetElbow?.(toNode) ?? false;
          const points = isOppositeHorizontal
            ? compressCollinear([
                fromPoint,
                {
                  x: preferTargetElbow ? Math.max(fromPoint.x + 28, toPoint.x - 36) : Math.round((fromPoint.x + toPoint.x) / 2),
                  y: fromPoint.y,
                },
                {
                  x: preferTargetElbow ? Math.max(fromPoint.x + 28, toPoint.x - 36) : Math.round((fromPoint.x + toPoint.x) / 2),
                  y: toPoint.y,
                },
                toPoint,
              ])
            : compressCollinear([
                fromPoint,
                { x: fromPoint.x, y: Math.round((fromPoint.y + toPoint.y) / 2) },
                { x: toPoint.x, y: Math.round((fromPoint.y + toPoint.y) / 2) },
                toPoint,
              ]);
          path = buildOrthogonalPolylinePath(points);
        } else {
          path = buildRoundedEdgePath(
            fromPoint.x,
            fromPoint.y,
            toPoint.x,
            toPoint.y,
            true,
            resolvedFromSide,
            resolvedToSide,
            0,
          );
        }
      }

      return {
        key: `${edgeKey}-${index}`,
        edgeKey,
        startPoint: fromPoint,
        endPoint: toPoint,
        controlPoint: control,
        hasManualControl,
        readOnly: entry.readOnly,
        path,
      } satisfies CanvasEdgeLine;
    })
    .filter(Boolean) as CanvasEdgeLine[];
}
