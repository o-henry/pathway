import { useMemo } from 'react';

import {
  getAssumptionsForNode,
  getEvidenceForNode,
} from '../lib/api';
import type {
  GoalRecord,
  LifeMap,
  RevisionProposalRecord,
  RouteSelectionRecord,
  StateUpdateRecord,
} from '../lib/types';
import { buildTerminalGoalDisplayBundle } from './PathwayRailCanvas';
import {
  buildNodeActionGuidance,
  findSelectedNode,
  isMetadataOnlyEvidence,
  mergePreviewBundle,
  sortStateUpdatesNewestFirst,
  stateUpdateMatchesNode,
} from './pathwayWorkspaceUtils';

export function usePathwayWorkspaceDerivedState({
  activeGoal,
  activeMap,
  revisionPreview,
  routeSelection,
  selectedNodeId,
  stateUpdates,
}: {
  activeGoal: GoalRecord | null;
  activeMap: LifeMap | null;
  revisionPreview: RevisionProposalRecord | null;
  routeSelection: RouteSelectionRecord | null;
  selectedNodeId: string | null;
  stateUpdates: StateUpdateRecord[];
}) {
  const activeBundle = activeMap?.graph_bundle ?? null;
  const visibleBundle = activeBundle && revisionPreview
    ? mergePreviewBundle(activeBundle, revisionPreview)
    : activeBundle;
  const displayBundle = useMemo(
    () => (visibleBundle ? buildTerminalGoalDisplayBundle(visibleBundle, activeGoal?.title) : undefined),
    [activeGoal?.title, visibleBundle],
  );
  const displayBaseBundle = useMemo(
    () => (activeBundle ? buildTerminalGoalDisplayBundle(activeBundle, activeGoal?.title) : undefined),
    [activeBundle, activeGoal?.title],
  );
  const effectiveSelectedNodeId =
    selectedNodeId ?? (activeBundle ? routeSelection?.selected_node_id ?? null : null);
  const selectedNode = displayBundle ? findSelectedNode(displayBundle, effectiveSelectedNodeId) : null;
  const selectedEvidence = selectedNode && displayBundle ? getEvidenceForNode(displayBundle, selectedNode.id) : [];
  const selectedContentEvidence = selectedEvidence.filter((item) => !isMetadataOnlyEvidence(item));
  const selectedAssumptions = selectedNode && displayBundle ? getAssumptionsForNode(displayBundle, selectedNode.id) : [];
  const selectedNodeActionGuidance = selectedNode
    ? buildNodeActionGuidance(selectedNode, selectedEvidence, selectedAssumptions)
    : null;
  const selectedNodePreviewChange =
    selectedNode && revisionPreview
      ? revisionPreview.diff.node_changes.find((item) => item.node_id === selectedNode.id) ?? null
      : null;
  const persistedProgressUpdates = useMemo(
    () => sortStateUpdatesNewestFirst(stateUpdates),
    [stateUpdates],
  );
  const latestProgressUpdate = persistedProgressUpdates[0] ?? null;
  const activeProgressNodeIds = useMemo(() => {
    if (!displayBundle || !latestProgressUpdate) {
      return new Set<string>();
    }
    return new Set(
      displayBundle.nodes
        .filter((node) => stateUpdateMatchesNode(latestProgressUpdate, node))
        .map((node) => node.id),
    );
  }, [displayBundle, latestProgressUpdate]);
  const progressUpdateSummaries = useMemo(
    () =>
      persistedProgressUpdates.slice(0, 8).map((update) => {
        const matchedNodes = displayBundle?.nodes.filter((node) => stateUpdateMatchesNode(update, node)) ?? [];
        return {
          update,
          matchedNodes: matchedNodes.slice(0, 3),
        };
      }),
    [displayBundle, persistedProgressUpdates],
  );

  return {
    activeProgressNodeIds,
    displayBaseBundle,
    displayBundle,
    effectiveSelectedNodeId,
    progressUpdateSummaries,
    selectedAssumptions,
    selectedContentEvidence,
    selectedNode,
    selectedNodeActionGuidance,
    selectedNodePreviewChange,
  };
}
