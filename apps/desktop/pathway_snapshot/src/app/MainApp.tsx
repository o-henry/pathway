import { type ReactNode, useEffect, useMemo, useState } from 'react';

import AppNav from '../components/AppNav';
import {
  analyzeGoal,
  createGoal,
  createStateUpdate,
  fetchCurrentState,
  fetchGoalMaps,
  fetchGoals,
  fetchRouteSelection,
  fetchStateUpdates,
  generatePathway,
  getApiBaseUrl,
  getAssumptionsForNode,
  getEvidenceForNode,
  updateRouteSelection
} from '../lib/api';
import { exampleGraphBundle } from '../lib/exampleGraphBundle';
import type {
  CurrentStateSnapshot,
  GoalAnalysisRecord,
  GoalRecord,
  GraphBundle,
  GraphEdgeRecord,
  GraphNodeRecord,
  GraphNodeTypeDefinition,
  LifeMap,
  RouteSelectionRecord,
  StateUpdateRecord
} from '../lib/types';

type WorkspaceTab = 'tasks' | 'workflow' | 'knowledge' | 'visualize' | 'adaptation' | 'settings';

type LayoutNode = {
  node: GraphNodeRecord;
  x: number;
  y: number;
  depth: number;
};

function toneClass(type?: GraphNodeTypeDefinition): string {
  const tone = type?.default_style?.tone ?? 'slate';
  return `tone-${tone}`;
}

function formatFieldValue(value: unknown): string {
  if (value == null) {
    return 'No data';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function buildLayout(bundle: GraphBundle): { nodes: LayoutNode[]; edges: GraphEdgeRecord[]; width: number; height: number } {
  const progressionTypeIds = new Set(
    bundle.ontology.edge_types.filter((item) => item.role === 'progression').map((item) => item.id)
  );
  const progressionEdges = bundle.edges.filter((edge) => progressionTypeIds.has(edge.type));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  bundle.nodes.forEach((node) => {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  });

  progressionEdges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  });

  const roots = bundle.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
  const queue = roots.length > 0 ? roots.map((node) => node.id) : bundle.nodes.slice(0, 1).map((node) => node.id);
  const depth = new Map<string, number>();

  queue.forEach((id) => depth.set(id, 0));

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) ?? 0;
    for (const target of outgoing.get(current) ?? []) {
      const nextDepth = currentDepth + 1;
      if (!depth.has(target) || nextDepth > (depth.get(target) ?? 0)) {
        depth.set(target, nextDepth);
      }
      queue.push(target);
    }
  }

  const lanes = new Map<number, GraphNodeRecord[]>();
  bundle.nodes.forEach((node) => {
    const nodeDepth = depth.get(node.id) ?? 0;
    const group = lanes.get(nodeDepth) ?? [];
    group.push(node);
    lanes.set(nodeDepth, group);
  });

  const positioned: LayoutNode[] = [];
  const laneDepths = [...lanes.keys()].sort((a, b) => a - b);

  laneDepths.forEach((laneDepth) => {
    const lane = lanes.get(laneDepth) ?? [];
    lane.sort((a, b) => a.label.localeCompare(b.label));
    lane.forEach((node, index) => {
      positioned.push({
        node,
        depth: laneDepth,
        x: 72 + laneDepth * 320,
        y: 88 + index * 188
      });
    });
  });

  const width = Math.max(1280, (laneDepths.at(-1) ?? 0) * 320 + 460);
  const tallestLane = Math.max(...[...lanes.values()].map((lane) => lane.length), 1);
  const height = Math.max(820, tallestLane * 188 + 260);

  return { nodes: positioned, edges: bundle.edges, width, height };
}

function NavIcon({ tab, active = false }: { tab: WorkspaceTab; active?: boolean }) {
  if (tab === 'tasks') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/scroll.svg" />;
  }
  if (tab === 'workflow') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/node-svgrepo-com.svg" />;
  }
  if (tab === 'knowledge') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image nav-database-image" src="/data-service-svgrepo-com.svg" />;
  }
  if (tab === 'visualize') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/chart-svgrepo-com.svg" />;
  }
  if (tab === 'adaptation') {
    return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/star.svg" />;
  }
  return <img alt="" aria-hidden="true" className="nav-workflow-image" src="/setting.svg" />;
}

function GraphBoard(props: {
  bundle: GraphBundle;
  selectedNodeId: string | null;
  selectedRouteId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const { bundle, selectedNodeId, selectedRouteId, onSelectNode } = props;
  const layout = useMemo(() => buildLayout(bundle), [bundle]);
  const positionById = useMemo(
    () => new Map(layout.nodes.map((entry) => [entry.node.id, entry])),
    [layout.nodes]
  );

  return (
    <section className="pathway-graph-surface">
      <div className="pathway-graph-scroll">
        <div className="pathway-graph-stage" style={{ width: layout.width, height: layout.height }}>
          <svg className="pathway-edge-layer" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`}>
            {layout.edges.map((edge) => {
              const source = positionById.get(edge.source);
              const target = positionById.get(edge.target);
              if (!source || !target) {
                return null;
              }
              const sourceX = source.x + 248;
              const sourceY = source.y + 68;
              const targetX = target.x;
              const targetY = target.y + 68;
              const midX = sourceX + (targetX - sourceX) * 0.5;
              const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
              const edgeType = bundle.ontology.edge_types.find((item) => item.id === edge.type);
              const dashed = edgeType?.role !== 'progression';

              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    className={`pathway-edge-path ${selectedRouteId && (edge.source === selectedRouteId || edge.target === selectedRouteId) ? 'is-active' : ''}`}
                    strokeDasharray={dashed ? '8 8' : undefined}
                  />
                  <text x={midX} y={targetY - 12} className="pathway-edge-label">
                    {edge.label ?? edgeType?.label ?? ''}
                  </text>
                </g>
              );
            })}
          </svg>

          {layout.nodes.map(({ node, x, y }) => {
            const type = bundle.ontology.node_types.find((item) => item.id === node.type);
            const previewEntries = Object.entries(node.data).slice(0, 2);
            return (
              <article
                key={node.id}
                className={`pathway-node ${toneClass(type)} ${selectedNodeId === node.id ? 'selected' : ''} ${selectedRouteId === node.id ? 'is-route-selected' : ''}`}
                style={{ left: x, top: y }}
                onClick={() => onSelectNode(node.id)}
              >
                <div className="pathway-node-head">
                  <div>
                    <div className="pathway-node-kicker">{type?.label ?? 'Node'}</div>
                    <strong>{node.label}</strong>
                  </div>
                  <span className="pathway-node-badge">{node.evidence_refs.length} ev</span>
                </div>
                <p className="pathway-node-summary">{node.summary}</p>
                <div className="pathway-node-meta-row">
                  <span className="pathway-status-pill">{node.assumption_refs.length} assumptions</span>
                  {node.status ? <span className="pathway-status-pill pathway-status-pill-warning">{node.status.replaceAll('_', ' ')}</span> : null}
                </div>
                <div className="pathway-node-fields">
                  {previewEntries.map(([key, value]) => (
                    <div key={key} className="pathway-node-field">
                      <span>{key.replaceAll('_', ' ')}</span>
                      <strong>{formatFieldValue(value)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EmptyState({
  title,
  copy,
  action
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <section className="pathway-empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
      {action}
    </section>
  );
}

export default function MainApp() {
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('workflow');
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [activeGoal, setActiveGoal] = useState<GoalRecord | null>(null);
  const [goalAnalysis, setGoalAnalysis] = useState<GoalAnalysisRecord | null>(null);
  const [maps, setMaps] = useState<LifeMap[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [activeMap, setActiveMap] = useState<LifeMap | null>(null);
  const [currentState, setCurrentState] = useState<CurrentStateSnapshot | null>(null);
  const [stateUpdates, setStateUpdates] = useState<StateUpdateRecord[]>([]);
  const [routeSelection, setRouteSelection] = useState<RouteSelectionRecord | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('Pathway local workspace is ready. Create a goal, inspect resources, and expand the map.');
  const [isBusy, setIsBusy] = useState(false);

  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    category: 'general',
    successCriteria: ''
  });
  const [stateForm, setStateForm] = useState({
    progress_summary: '',
    blockers: '',
    next_adjustment: '',
    actual_time_spent: '',
    actual_money_spent: '',
    mood: ''
  });

  const activeBundle = activeMap?.graph_bundle ?? exampleGraphBundle;
  const selectedNode = selectedNodeId
    ? activeBundle.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const selectedEvidence = selectedNode ? getEvidenceForNode(activeBundle, selectedNode.id) : [];
  const selectedAssumptions = selectedNode ? getAssumptionsForNode(activeBundle, selectedNode.id) : [];

  async function refreshGoals(preserveSelection = true) {
    const nextGoals = await fetchGoals();
    setGoals(nextGoals);
    if (nextGoals.length === 0) {
      setActiveGoalId(null);
      setActiveGoal(null);
      return;
    }

    const preferredGoalId =
      preserveSelection && activeGoalId && nextGoals.some((goal) => goal.id === activeGoalId)
        ? activeGoalId
        : nextGoals[0]?.id;
    setActiveGoalId(preferredGoalId ?? null);
  }

  async function refreshGoalWorkspace(goalId: string, preferredMapId?: string | null) {
    const goal = goals.find((item) => item.id === goalId) ?? (await fetchGoals()).find((item) => item.id === goalId) ?? null;
    setActiveGoal(goal);

    const [nextMaps, nextUpdates, nextCurrentState] = await Promise.all([
      fetchGoalMaps(goalId),
      fetchStateUpdates(goalId),
      fetchCurrentState(goalId)
    ]);

    setMaps(nextMaps);
    setStateUpdates(nextUpdates);
    setCurrentState(nextCurrentState);

    const chosenMap =
      (preferredMapId ? nextMaps.find((item) => item.id === preferredMapId) : null) ??
      nextMaps[0] ??
      null;
    setActiveMap(chosenMap);
    setActiveMapId(chosenMap?.id ?? null);
    setSelectedNodeId(chosenMap?.graph_bundle.nodes[0]?.id ?? null);

    if (chosenMap) {
      const nextRouteSelection = await fetchRouteSelection(chosenMap.id);
      setRouteSelection(nextRouteSelection);
    } else {
      setRouteSelection(null);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshGoals(false);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load goals');
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeGoalId) {
      return;
    }
    void (async () => {
      try {
        setErrorMessage('');
        await refreshGoalWorkspace(activeGoalId, activeMapId);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load goal workspace');
      }
    })();
  }, [activeGoalId]);

  async function handleCreateGoal() {
    if (!goalForm.title.trim() || !goalForm.successCriteria.trim()) {
      setErrorMessage('Title and success criteria are required.');
      return;
    }

    try {
      setIsBusy(true);
      setErrorMessage('');
      const created = await createGoal({
        title: goalForm.title.trim(),
        description: goalForm.description.trim(),
        category: goalForm.category.trim() || 'general',
        success_criteria: goalForm.successCriteria.trim()
      });
      setGoalForm({ title: '', description: '', category: 'general', successCriteria: '' });
      setStatusMessage('Goal created. The RAIL workspace is now pointed at a new Pathway objective.');
      await refreshGoals(false);
      setActiveGoalId(created.id);
      setWorkspaceTab('tasks');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Goal creation failed');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAnalyzeGoal() {
    if (!activeGoalId) {
      return;
    }
    try {
      setIsBusy(true);
      setErrorMessage('');
      const analysis = await analyzeGoal(activeGoalId);
      setGoalAnalysis(analysis);
      setStatusMessage('Goal analysis refreshed. Resource dimensions and research prompts were updated.');
      setWorkspaceTab('knowledge');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Goal analysis failed');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGeneratePathway() {
    if (!activeGoalId) {
      return;
    }
    try {
      setIsBusy(true);
      setErrorMessage('');
      const nextMap = await generatePathway(activeGoalId);
      setStatusMessage('A fresh pathway graph was generated and loaded into the workflow view.');
      await refreshGoalWorkspace(activeGoalId, nextMap.id);
      setWorkspaceTab('workflow');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Pathway generation failed');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    if (!activeMap) {
      return;
    }
    try {
      const selection = await updateRouteSelection(activeMap.id, {
        selected_node_id: nodeId,
        rationale: 'Selected from the RAIL-based desktop graph.'
      });
      setRouteSelection(selection);
      setStatusMessage('Route selection updated from the graph workspace.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Route selection update failed');
    }
  }

  async function handleCreateStateUpdate() {
    if (!activeGoalId) {
      return;
    }
    if (!stateForm.progress_summary.trim()) {
      setErrorMessage('Progress summary is required to log a state update.');
      return;
    }

    try {
      setIsBusy(true);
      setErrorMessage('');
      await createStateUpdate(activeGoalId, {
        update_date: new Date().toISOString().slice(0, 10),
        actual_time_spent: stateForm.actual_time_spent ? Number(stateForm.actual_time_spent) : null,
        actual_money_spent: stateForm.actual_money_spent ? Number(stateForm.actual_money_spent) : null,
        mood: stateForm.mood.trim() || null,
        progress_summary: stateForm.progress_summary.trim(),
        blockers: stateForm.blockers.trim(),
        next_adjustment: stateForm.next_adjustment.trim(),
        resource_deltas: {},
        learned_items: [],
        source_refs: [],
        pathway_id: activeMap?.id ?? null
      });
      setStateForm({
        progress_summary: '',
        blockers: '',
        next_adjustment: '',
        actual_time_spent: '',
        actual_money_spent: '',
        mood: ''
      });
      setStatusMessage('Reality log captured. The latest state has been synchronized into the workspace.');
      await refreshGoalWorkspace(activeGoalId, activeMap?.id ?? null);
      setWorkspaceTab('adaptation');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'State update failed');
    } finally {
      setIsBusy(false);
    }
  }

  function renderWorkflowTab() {
    return (
      <section className="pathway-workspace-shell workspace-tab-panel">
        <div className="pathway-board-column panel-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Workflow graph</span>
              <strong>{activeGoal?.title ?? activeBundle.map.title}</strong>
            </div>
            <div className="pathway-head-actions">
              <button className="mini-action-button" onClick={handleAnalyzeGoal} type="button" disabled={!activeGoalId || isBusy}>
                Analyze
              </button>
              <button className="mini-action-button" onClick={handleGeneratePathway} type="button" disabled={!activeGoalId || isBusy}>
                Regenerate
              </button>
            </div>
          </div>
          <p className="pathway-panel-copy">
            {activeGoal?.description || activeBundle.map.summary}
          </p>
          <GraphBoard
            bundle={activeBundle}
            selectedNodeId={selectedNodeId}
            selectedRouteId={routeSelection?.selected_node_id ?? null}
            onSelectNode={handleSelectNode}
          />
        </div>

        <aside className="pathway-sidebar-column">
          <section className="panel-card pathway-side-card">
            <div className="pathway-panel-head">
              <div>
                <span className="pathway-panel-kicker">Selected route</span>
                <strong>{routeSelection?.selected_node_id ?? 'No route locked yet'}</strong>
              </div>
            </div>
            <p className="pathway-panel-copy">
              {routeSelection?.rationale || 'Click any node in the graph to set the active route and inspect supporting evidence.'}
            </p>
          </section>

          <section className="panel-card pathway-side-card">
            <div className="pathway-panel-head">
              <div>
                <span className="pathway-panel-kicker">Node inspector</span>
                <strong>{selectedNode?.label ?? 'Choose a node'}</strong>
              </div>
            </div>
            {selectedNode ? (
              <>
                <p className="pathway-panel-copy">{selectedNode.summary}</p>
                <ul className="pathway-fact-list">
                  {Object.entries(selectedNode.data).map(([key, value]) => (
                    <li key={key}>
                      <span>{key.replaceAll('_', ' ')}</span>
                      <strong>{formatFieldValue(value)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="pathway-panel-copy">Select a node to inspect route fit, assumptions, and evidence.</p>
            )}
          </section>
        </aside>
      </section>
    );
  }

  function renderTasksTab() {
    return (
      <section className="pathway-grid-layout workspace-tab-panel">
        <section className="panel-card pathway-form-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Goal intake</span>
              <strong>Define the goal Pathway should model</strong>
            </div>
          </div>
          <textarea
            className="pathway-textarea pathway-textarea-large"
            value={goalForm.title}
            onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Describe the goal in natural language. The system will infer the resource dimensions that actually matter."
          />
          <textarea
            className="pathway-textarea"
            value={goalForm.description}
            onChange={(event) => setGoalForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Context, current constraints, or any non-obvious background."
          />
          <div className="pathway-input-row">
            <input
              className="pathway-input"
              value={goalForm.category}
              onChange={(event) => setGoalForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="Category"
            />
            <input
              className="pathway-input"
              value={goalForm.successCriteria}
              onChange={(event) => setGoalForm((current) => ({ ...current, successCriteria: event.target.value }))}
              placeholder="Success criteria"
            />
          </div>
          <div className="pathway-actions-row">
            <button className="mini-action-button pathway-primary-button" onClick={handleCreateGoal} type="button" disabled={isBusy}>
              Create goal
            </button>
            <button className="mini-action-button" onClick={handleAnalyzeGoal} type="button" disabled={!activeGoalId || isBusy}>
              Analyze resources
            </button>
            <button className="mini-action-button" onClick={handleGeneratePathway} type="button" disabled={!activeGoalId || isBusy}>
              Generate graph
            </button>
          </div>
        </section>

        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Goal library</span>
              <strong>Recent Pathway goals</strong>
            </div>
          </div>
          {goals.length === 0 ? (
            <EmptyState title="No goals yet" copy="Create the first goal to start a local decision graph." />
          ) : (
            <ul className="pathway-goal-list">
              {goals.map((goal) => (
                <li key={goal.id}>
                  <button
                    className={`pathway-list-button ${activeGoalId === goal.id ? 'is-active' : ''}`}
                    onClick={() => setActiveGoalId(goal.id)}
                    type="button"
                  >
                    <strong>{goal.title}</strong>
                    <span>{goal.category}</span>
                    <span>{goal.success_criteria}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    );
  }

  function renderKnowledgeTab() {
    return (
      <section className="pathway-grid-layout workspace-tab-panel">
        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Resource dimensions</span>
              <strong>{goalAnalysis ? 'What matters for this goal' : 'Run goal analysis first'}</strong>
            </div>
          </div>
          {goalAnalysis ? (
            <ul className="pathway-detail-list">
              {goalAnalysis.resource_dimensions.map((dimension) => (
                <li key={dimension.id}>
                  <strong>{dimension.label}</strong>
                  <span>{dimension.question}</span>
                  <p>{dimension.relevance_reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No resource model yet"
              copy="Analyze the active goal to infer relevant dimensions, follow-up questions, and research prompts."
              action={
                <button className="mini-action-button pathway-primary-button" onClick={handleAnalyzeGoal} type="button" disabled={!activeGoalId || isBusy}>
                  Analyze goal
                </button>
              }
            />
          )}
        </section>

        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Evidence and assumptions</span>
              <strong>{selectedNode?.label ?? 'Select a workflow node'}</strong>
            </div>
          </div>
          {selectedNode ? (
            <div className="pathway-knowledge-stack">
              <section>
                <h3>Evidence</h3>
                {selectedEvidence.length === 0 ? (
                  <p className="pathway-panel-copy">No evidence linked to this node yet.</p>
                ) : (
                  <ul className="pathway-detail-list">
                    {selectedEvidence.map((item) => (
                      <li key={item.id}>
                        <strong>{item.title}</strong>
                        <span>{item.quote_or_summary}</span>
                        <p>{item.reliability}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3>Assumptions</h3>
                {selectedAssumptions.length === 0 ? (
                  <p className="pathway-panel-copy">No assumptions linked to this node.</p>
                ) : (
                  <ul className="pathway-detail-list">
                    {selectedAssumptions.map((item) => (
                      <li key={item.id}>
                        <strong>{item.text}</strong>
                        <p>{item.risk_if_false}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <EmptyState title="No node selected" copy="Choose a node in the workflow tab to inspect grounded evidence and explicit assumptions." />
          )}
        </section>
      </section>
    );
  }

  function renderVisualizeTab() {
    return (
      <section className="pathway-grid-layout workspace-tab-panel">
        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Saved graph bundles</span>
              <strong>Map versions for this goal</strong>
            </div>
          </div>
          {maps.length === 0 ? (
            <EmptyState title="No saved maps yet" copy="Generate the first workflow graph to start comparing route bundles." />
          ) : (
            <ul className="pathway-goal-list">
              {maps.map((map) => (
                <li key={map.id}>
                  <button
                    className={`pathway-list-button ${activeMapId === map.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveMap(map);
                      setActiveMapId(map.id);
                      setSelectedNodeId(map.graph_bundle.nodes[0]?.id ?? null);
                      void fetchRouteSelection(map.id).then(setRouteSelection).catch(() => undefined);
                    }}
                    type="button"
                  >
                    <strong>{map.title}</strong>
                    <span>{new Date(map.created_at).toLocaleString()}</span>
                    <span>{map.graph_bundle.nodes.length} nodes / {map.graph_bundle.edges.length} edges</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Bundle notes</span>
              <strong>Warnings and ontology</strong>
            </div>
          </div>
          <div className="pathway-knowledge-stack">
            <section>
              <h3>Warnings</h3>
              {activeBundle.warnings.length === 0 ? (
                <p className="pathway-panel-copy">No warnings attached to this bundle.</p>
              ) : (
                <ul className="pathway-detail-list">
                  {activeBundle.warnings.map((warning) => (
                    <li key={warning}>
                      <strong>{warning}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3>Node ontology</h3>
              <ul className="pathway-detail-list">
                {activeBundle.ontology.node_types.map((type) => (
                  <li key={type.id}>
                    <strong>{type.label}</strong>
                    <span>{type.id}</span>
                    <p>{type.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </section>
    );
  }

  function renderAdaptationTab() {
    return (
      <section className="pathway-grid-layout workspace-tab-panel">
        <section className="panel-card pathway-form-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Reality updates</span>
              <strong>Record what actually happened</strong>
            </div>
          </div>
          <textarea
            className="pathway-textarea pathway-textarea-large"
            value={stateForm.progress_summary}
            onChange={(event) => setStateForm((current) => ({ ...current, progress_summary: event.target.value }))}
            placeholder="What changed in reality since the last update?"
          />
          <input
            className="pathway-input"
            value={stateForm.blockers}
            onChange={(event) => setStateForm((current) => ({ ...current, blockers: event.target.value }))}
            placeholder="Current blockers"
          />
          <input
            className="pathway-input"
            value={stateForm.next_adjustment}
            onChange={(event) => setStateForm((current) => ({ ...current, next_adjustment: event.target.value }))}
            placeholder="Next adjustment"
          />
          <div className="pathway-input-row">
            <input
              className="pathway-input"
              value={stateForm.actual_time_spent}
              onChange={(event) => setStateForm((current) => ({ ...current, actual_time_spent: event.target.value }))}
              placeholder="Hours spent"
            />
            <input
              className="pathway-input"
              value={stateForm.actual_money_spent}
              onChange={(event) => setStateForm((current) => ({ ...current, actual_money_spent: event.target.value }))}
              placeholder="Money spent"
            />
            <input
              className="pathway-input"
              value={stateForm.mood}
              onChange={(event) => setStateForm((current) => ({ ...current, mood: event.target.value }))}
              placeholder="Mood"
            />
          </div>
          <button className="mini-action-button pathway-primary-button" onClick={handleCreateStateUpdate} type="button" disabled={!activeGoalId || isBusy}>
            Record update
          </button>
        </section>

        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">State timeline</span>
              <strong>Most recent adaptation log</strong>
            </div>
          </div>
          <p className="pathway-panel-copy">
            {currentState?.state_summary ?? 'No summarized current state yet. Start recording reality updates to evolve the graph.'}
          </p>
          {stateUpdates.length === 0 ? (
            <EmptyState title="No updates yet" copy="The graph will become more useful as real-world constraints and progress accumulate." />
          ) : (
            <ul className="pathway-detail-list">
              {stateUpdates.map((update) => (
                <li key={update.id}>
                  <strong>{update.update_date}</strong>
                  <span>{update.progress_summary}</span>
                  <p>{update.blockers || 'No blockers noted.'}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    );
  }

  function renderSettingsTab() {
    return (
      <section className="pathway-grid-layout workspace-tab-panel">
        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Local runtime</span>
              <strong>Pathway desktop wiring</strong>
            </div>
          </div>
          <ul className="pathway-fact-list">
            <li>
              <span>API endpoint</span>
              <strong>{getApiBaseUrl()}</strong>
            </li>
            <li>
              <span>Loaded goals</span>
              <strong>{goals.length}</strong>
            </li>
            <li>
              <span>Loaded maps</span>
              <strong>{maps.length}</strong>
            </li>
            <li>
              <span>Current bundle</span>
              <strong>{activeBundle.bundle_id}</strong>
            </li>
          </ul>
        </section>

        <section className="panel-card pathway-list-card">
          <div className="pathway-panel-head">
            <div>
              <span className="pathway-panel-kicker">Product stance</span>
              <strong>Decision graph, not prediction</strong>
            </div>
          </div>
          <ul className="pathway-detail-list">
            <li>
              <strong>Evidence-backed map</strong>
              <p>Every graph bundle is framed as routes, constraints, assumptions, and evidence rather than a promised future.</p>
            </li>
            <li>
              <strong>Dynamic ontology</strong>
              <p>Node and edge types are generated per graph bundle and rendered with fallbacks instead of a fixed global enum.</p>
            </li>
            <li>
              <strong>Local-first runtime</strong>
              <p>This desktop shell reuses the RAIL app chrome while switching the workspace semantics to Pathway planning and revision.</p>
            </li>
          </ul>
        </section>
      </section>
    );
  }

  return (
    <main className="app-shell">
      <div aria-hidden="true" className="window-drag-region" data-tauri-drag-region />
      <AppNav
        activeTab={workspaceTab}
        onSelectTab={(tab) => setWorkspaceTab(tab as WorkspaceTab)}
        renderIcon={(tab, active) => <NavIcon active={active} tab={tab as WorkspaceTab} />}
      />
      <section className={`workspace ${errorMessage ? 'workspace-has-error' : ''}`.trim()}>
        <header className="workspace-header">
          <div className="header-actions">
            <span className="chip">API {getApiBaseUrl()}</span>
            <span className="chip">{activeBundle.nodes.length} nodes</span>
            <span className="chip">{activeBundle.evidence.length} evidence</span>
            <span className="chip">{stateUpdates.length} updates</span>
            <span className="chip pathway-status-chip">{statusMessage}</span>
            <span className="primary-action">{routeSelection ? `Route ${routeSelection.selected_node_id}` : 'Route unlocked'}</span>
          </div>
        </header>

        {errorMessage ? (
          <div className="error">
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {workspaceTab === 'workflow' && renderWorkflowTab()}
        {workspaceTab === 'tasks' && renderTasksTab()}
        {workspaceTab === 'knowledge' && renderKnowledgeTab()}
        {workspaceTab === 'visualize' && renderVisualizeTab()}
        {workspaceTab === 'adaptation' && renderAdaptationTab()}
        {workspaceTab === 'settings' && renderSettingsTab()}
      </section>
    </main>
  );
}
