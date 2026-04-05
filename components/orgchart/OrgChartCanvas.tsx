'use client';

import { useEffect, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  type Node, type Edge,
  BackgroundVariant, Panel,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

import type { ParseResult, WorkdayLevel, OrgChartNode } from '@/types/orgchart.types';
import { OrgChartNodeComponent_Memo, type OrgChartNodeData } from './OrgChartNode';
import { useOrgChart } from '@/lib/hooks/useOrgChart';
import { exportOrgChartToSvg } from '@/lib/export/svg.exporter';
import { ExportModal, type ExportConfig, type ExportNodeOption } from './ExportModal';

const NODE_WIDTH  = 224;
const NODE_HEIGHT = 150;
const NODE_TYPES  = { orgChartNode: OrgChartNodeComponent_Memo };

const MINIMAP_COLORS: Record<string, string> = {
  '0': '#7c3aed', '1': '#2563eb', '2': '#0ea5e9', '3': '#14b8a6',
  '4': '#22c55e', '5': '#eab308', '6': '#f97316', '7': '#f87171',
  '8': '#9ca3af', 'DIRECTOR': '#7e22ce', 'CONTINGENT': '#fbbf24',
};

const LEVEL_LABELS: Record<WorkdayLevel, string> = {
  '0': 'N0', '1': 'N1', '2': 'N2', '3': 'N3', '4': 'N4',
  '5': 'N5', '6': 'N6', '7': 'N7', '8': 'N8',
  'DIRECTOR': 'DIR', 'CONTINGENT': 'CONT',
};

const LEVEL_COLORS: Record<WorkdayLevel, string> = {
  '0': 'bg-violet-600', '1': 'bg-blue-600', '2': 'bg-sky-500',
  '3': 'bg-teal-500',   '4': 'bg-green-500', '5': 'bg-yellow-500',
  '6': 'bg-orange-500', '7': 'bg-red-400',   '8': 'bg-gray-400',
  'DIRECTOR': 'bg-purple-700', 'CONTINGENT': 'bg-amber-400',
};

function applyDagreLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 24, marginx: 40, marginy: 40 });
  for (const node of nodes) g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of edges) g.setEdge(edge.source, edge.target);
  dagre.layout(g);
  return {
    nodes: nodes.map(n => {
      const { x, y } = g.node(n.id);
      return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}

function treeToFlowElements(
  visibleNodes: ReturnType<typeof useOrgChart>['visibleNodes'],
  expandedIds: Set<string>,
  onToggleExpand: (id: string) => void,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const visibleIds = new Set(visibleNodes.map(n => n.id));

  for (const orgNode of visibleNodes) {
    nodes.push({
      id: orgNode.id, type: 'orgChartNode', position: { x: 0, y: 0 },
      data: { ...orgNode, isExpanded: expandedIds.has(orgNode.id), onToggleExpand } as unknown as Record<string, unknown>,
    });
    if (orgNode.managerId && visibleIds.has(orgNode.managerId)) {
      edges.push({
        id: `e-${orgNode.managerId}-${orgNode.id}`,
        source: orgNode.managerId, target: orgNode.id,
        type: 'smoothstep', style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
      });
    }
  }
  return applyDagreLayout(nodes, edges);
}

// ── Build export node options from visibleNodes ───────────────────────────────
// Only nodes currently visible (respecting filters) can be selected as root

function buildExportOptions(visibleNodes: OrgChartNode[]): ExportNodeOption[] {
  return visibleNodes.map(n => ({ id: n.id, label: n.name, depth: n.depth }));
}

// ── SVG export with config ────────────────────────────────────────────────────

function exportPersonasSvg(
  parseResult: ParseResult,
  visibleNodes: OrgChartNode[],
  config: ExportConfig,
  fileName: string,
) {
  const { rootId, maxLevels } = config;

  // Find root in visible nodes
  const rootNode = parseResult.nodeMap.get(rootId);
  if (!rootNode) return;

  // Filter visible nodes to subtree of rootId within maxLevels
  const rootDepth = rootNode.depth;
  const subtreeIds = new Set<string>();
  const queue: OrgChartNode[] = [rootNode];
  while (queue.length > 0) {
    const n = queue.shift()!;
    const relDepth = n.depth - rootDepth;
    if (maxLevels > 0 && relDepth >= maxLevels) continue;
    subtreeIds.add(n.id);
    queue.push(...n.children);
  }

  // Intersect with visibleNodes (respect active filters)
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const filteredNodes = visibleNodes.filter(n => subtreeIds.has(n.id) && visibleIds.has(n.id));

  // Delegate to existing exporter with the filtered subset
  if (filteredNodes.length > 0) {
    // We pass rootNode as root and filteredNodes as the visible set
    exportOrgChartToSvg(rootNode, filteredNodes, fileName);
  }
}

interface OrgChartCanvasProps {
  parseResult: ParseResult;
  fileName?: string;
}

export function OrgChartCanvas({ parseResult, fileName = 'organigrama' }: OrgChartCanvasProps) {
  const {
    expandedIds, toggleExpand, expandAll, collapseAll,
    filters, maxOrgDepth, availablePersonLevels,
    setMaxOrgLevel, togglePersonLevel, clearAllFilters,
    visibleNodes, filterStats,
  } = useOrgChart(parseResult);

  const [panelOpen,   setPanelOpen]   = useState(true);
  const [showExport,  setShowExport]  = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const { nodes: ln, edges: le } = treeToFlowElements(visibleNodes, expandedIds, toggleExpand);
    setNodes(ln);
    setEdges(le);
  }, [visibleNodes, expandedIds, toggleExpand]);

  const orgLevelButtons = Array.from({ length: maxOrgDepth }, (_, i) => i + 1);

  // Export options: only visible nodes as potential roots
  const exportNodeOptions = buildExportOptions(visibleNodes);
  const defaultRootId = parseResult.root?.id ?? visibleNodes[0]?.id ?? '';

  // Build filter summary for modal
  const filterParts: string[] = [];
  if (filters.maxOrgLevel !== null) filterParts.push(`Nivel Org ≤ ${filters.maxOrgLevel}`);
  if (filters.personLevels.size > 0) filterParts.push(`Niveles: ${[...filters.personLevels].join(', ')}`);
  const filterSummary = filterParts.join(' · ') || undefined;

  const handleExport = (config: ExportConfig) => {
    setShowExport(false);
    exportPersonasSvg(parseResult, visibleNodes, config, fileName);
  };

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05} maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={node => MINIMAP_COLORS[(node.data as unknown as OrgChartNodeData).level] ?? '#9ca3af'}
          maskColor="rgb(240,240,240,0.6)"
          className="!border !border-gray-200 !rounded-lg"
        />

        <Panel position="top-left" className="flex flex-col gap-2">

          <button onClick={() => setPanelOpen(o => !o)}
            className="self-start bg-white rounded-xl shadow-md border border-gray-100 px-3 py-2 text-[11px] font-semibold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-2">
            {panelOpen ? '◀ Ocultar panel' : '▶ Panel'}
            {filterStats.hasFilters && !panelOpen && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />}
          </button>

          {panelOpen && (
            <div className="flex flex-col gap-2 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">

              {/* Nivel Org */}
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nivel Org</p>
                  {filters.maxOrgLevel !== null && (
                    <button onClick={() => setMaxOrgLevel(null)} className="text-[10px] text-blue-500 hover:text-blue-700">Limpiar</button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={expandAll}   className="flex-1 text-[10px] font-medium px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 transition-colors">Expandir todo</button>
                  <button onClick={collapseAll} className="flex-1 text-[10px] font-medium px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 transition-colors">Colapsar todo</button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {orgLevelButtons.map(level => (
                    <button key={level}
                      onClick={() => setMaxOrgLevel(filters.maxOrgLevel === level ? null : level)}
                      className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${filters.maxOrgLevel === level ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                      Nivel Org {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nivel de Persona */}
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-3 flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nivel de Persona</p>
                <p className="text-[10px] text-gray-400 -mt-1">Selecciona uno o varios para filtrar</p>
                <div className="flex flex-wrap gap-1.5">
                  {availablePersonLevels.map(level => {
                    const active = filters.personLevels.has(level);
                    return (
                      <button key={level} onClick={() => togglePersonLevel(level)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border-2 transition-all ${active ? `${LEVEL_COLORS[level]} text-white border-transparent` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                        {LEVEL_LABELS[level]}
                      </button>
                    );
                  })}
                </div>
                {filters.personLevels.size > 0 && (
                  <button onClick={clearAllFilters} className="text-[10px] text-gray-400 hover:text-red-500 text-left transition-colors">
                    ✕ Limpiar niveles seleccionados
                  </button>
                )}
              </div>

              {/* Resumen */}
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Resumen</p>
                  {filterStats.hasFilters && (
                    <button onClick={clearAllFilters} className="text-[10px] text-red-400 hover:text-red-600 font-medium transition-colors">✕ Limpiar filtros</button>
                  )}
                </div>
                <div className="space-y-1">
                  <StatRow label="Mostrando"   value={`${filterStats.showing} / ${filterStats.total}`} color={filterStats.hasFilters ? 'text-blue-600' : 'text-gray-700'} />
                  <StatRow label="Employees"   value={parseResult.stats.totalEmployees}  color="text-blue-600" />
                  <StatRow label="Contingent"  value={parseResult.stats.totalContingent} color="text-amber-600" />
                  <StatRow label="Niveles Org" value={parseResult.stats.maxDepth} />
                  <StatRow label="Span medio"  value={parseResult.stats.averageSpan} />
                </div>
              </div>

              {/* Exportar SVG */}
              <button
                onClick={() => setShowExport(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold px-3 py-2 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                ⬇️ Exportar SVG
              </button>

            </div>
          )}
        </Panel>
      </ReactFlow>

      {showExport && (
        <ExportModal
          nodes={exportNodeOptions}
          maxDepth={parseResult.stats.maxDepth}
          defaultRootId={defaultRootId}
          onExport={handleExport}
          onClose={() => setShowExport(false)}
          filterSummary={filterSummary}
        />
      )}
    </div>
  );
}

function StatRow({ label, value, color = 'text-gray-700' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className={`text-[11px] font-bold ${color}`}>{value}</span>
    </div>
  );
}
