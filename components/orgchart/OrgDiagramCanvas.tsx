'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  type Node, type Edge,
  BackgroundVariant, Panel,
  useReactFlow,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

import type { OrgParseResult, OrgTreeNode, OrgPersonNode } from '@/types/orgchart.types';
import { OrgDiagramNodeComponent_Memo } from './OrgDiagramNode';

const NODE_WIDTH  = 208;
const NODE_HEIGHT = 130;
const NODE_TYPES  = { orgDiagramNode: OrgDiagramNodeComponent_Memo };

// ── Dagre layout ─────────────────────────────────────────────────────────────

function applyDagreLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 24, marginx: 40, marginy: 40 });
  for (const node of nodes) g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of edges)  g.setEdge(edge.source, edge.target);
  dagre.layout(g);
  return {
    nodes: nodes.map(n => {
      const { x, y } = g.node(n.id);
      return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}

// ── Tree → Flow ───────────────────────────────────────────────────────────────

function buildFlowElements(
  orgParseResult: OrgParseResult,
  expandedIds: Set<string>,
  selectedOrgId: string | null,
  highlightedIds: Set<string>,
  onToggleExpand: (id: string) => void,
  onClickOrg: (id: string) => void,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const queue: OrgTreeNode[] = [...orgParseResult.multipleRoots];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const org = queue.shift()!;
    if (visited.has(org.id)) continue;
    visited.add(org.id);

    const isHighlighted = highlightedIds.size > 0 && highlightedIds.has(org.id);
    const isDimmed      = highlightedIds.size > 0 && !highlightedIds.has(org.id);

    nodes.push({
      id: org.id,
      type: 'orgDiagramNode',
      position: { x: 0, y: 0 },
      style: isDimmed ? { opacity: 0.3 } : undefined,
      data: {
        ...org,
        isExpanded: expandedIds.has(org.id),
        isSelected: org.id === selectedOrgId || isHighlighted,
        onToggleExpand,
        onClickOrg,
      } as unknown as Record<string, unknown>,
    });

    if (org.parentId && visited.has(org.parentId)) {
      edges.push({
        id: `e-${org.parentId}-${org.id}`,
        source: org.parentId,
        target: org.id,
        type: 'smoothstep',
        style: { stroke: isDimmed ? '#e2e8f0' : '#cbd5e1', strokeWidth: 1.5 },
      });
    }

    if (expandedIds.has(org.id)) queue.push(...org.children);
  }

  return applyDagreLayout(nodes, edges);
}

// ── SVG export ────────────────────────────────────────────────────────────────

function exportOrgDiagramToSvg(orgParseResult: OrgParseResult, fileName: string) {
  const PAD = 40, NW = NODE_WIDTH, NH = NODE_HEIGHT, RSEP = 80, NSEP = 24;

  // Compute positions via dagre on ALL nodes (ignoring expand state)
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: RSEP, nodesep: NSEP, marginx: PAD, marginy: PAD });

  for (const [id] of orgParseResult.nodeMap) g.setNode(id, { width: NW, height: NH });
  for (const [, node] of orgParseResult.nodeMap) {
    if (node.parentId && orgParseResult.nodeMap.has(node.parentId)) {
      g.setEdge(node.parentId, node.id);
    }
  }
  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const [id] of orgParseResult.nodeMap) {
    const { x, y } = g.node(id);
    positions.set(id, { x: x - NW / 2, y: y - NH / 2 });
  }

  const DEPTH_COLORS: Record<number, string> = {
    0: '#7c3aed', 1: '#2563eb', 2: '#0ea5e9', 3: '#14b8a6', 4: '#22c55e',
  };

  let svgNodes = '';
  let svgEdges = '';

  for (const [, node] of orgParseResult.nodeMap) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const color = DEPTH_COLORS[node.depth] ?? '#6b7280';
    const { x, y } = pos;
    const managerName = node.manager?.name ?? '';
    const managerTitle = node.manager?.businessTitle ?? '';

    svgNodes += `
      <g transform="translate(${x},${y})">
        <rect width="${NW}" height="${NH}" rx="10" ry="10" fill="white" stroke="${color}" stroke-width="2"/>
        <rect width="${NW}" height="36" rx="10" ry="10" fill="${color}18"/>
        <rect y="26" width="${NW}" height="10" fill="${color}18"/>
        <text x="10" y="16" font-size="11" font-weight="700" fill="#1e293b" font-family="system-ui">${node.name.substring(0, 26)}</text>
        <text x="10" y="29" font-size="9" fill="#64748b" font-family="system-ui">${node.type}</text>
        ${managerName ? `<text x="10" y="52" font-size="9" font-weight="600" fill="#334155" font-family="system-ui">👤 ${managerName.substring(0, 28)}</text>` : ''}
        ${managerTitle ? `<text x="10" y="63" font-size="8" fill="#94a3b8" font-family="system-ui">${managerTitle.substring(0, 32)}</text>` : ''}
        <text x="10" y="82" font-size="9" fill="#64748b" font-family="system-ui">👥 ${node.members.length} personas</text>
        ${node.directReports > 0 ? `<text x="${NW - 10}" y="82" font-size="9" fill="#94a3b8" font-family="system-ui" text-anchor="end">${node.directReports} sub-orgs</text>` : ''}
        <rect x="${NW - 24}" y="4" width="20" height="14" rx="4" fill="${color}"/>
        <text x="${NW - 14}" y="14" font-size="8" font-weight="700" fill="white" text-anchor="middle" font-family="system-ui">N${node.depth}</text>
      </g>`;
  }

  for (const [, node] of orgParseResult.nodeMap) {
    if (!node.parentId) continue;
    const from = positions.get(node.parentId);
    const to   = positions.get(node.id);
    if (!from || !to) continue;
    const x1 = from.x + NW / 2, y1 = from.y + NH;
    const x2 = to.x   + NW / 2, y2 = to.y;
    svgEdges += `<path d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>`;
  }

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [, pos] of positions) {
    minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + NW); maxY = Math.max(maxY, pos.y + NH);
  }
  const W = maxX - minX + PAD * 2;
  const H = maxY - minY + PAD * 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - PAD} ${minY - PAD} ${W} ${H}" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  ${svgEdges}
  ${svgNodes}
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${fileName}-organizaciones.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── People panel ──────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<string, string> = {
  '0': 'bg-violet-600', '1': 'bg-blue-600', '2': 'bg-sky-500',
  '3': 'bg-teal-500',   '4': 'bg-green-500', '5': 'bg-yellow-500',
  '6': 'bg-orange-500', '7': 'bg-red-400',   '8': 'bg-gray-400',
  'DIRECTOR': 'bg-purple-700', 'CONTINGENT': 'bg-amber-400',
};

function PersonCard({ person }: { person: OrgPersonNode }) {
  const initials  = person.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const badgeBg   = person.workerType === 'Contingent Worker' ? 'bg-amber-400' : (LEVEL_BADGE[person.level] ?? 'bg-gray-400');
  const badgeLabel = person.workerType === 'Contingent Worker' ? 'CONT' : `N${person.level}`;
  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg bg-white border transition-shadow hover:shadow-sm ${person.isManager ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100'}`}>
      <div className="w-8 h-8 rounded-full bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {person.photoUrl
          ? <img src={person.photoUrl} alt={person.name} className="w-8 h-8 object-cover" />
          : <span className="text-[10px] font-bold text-gray-500">{initials}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-semibold text-gray-800 truncate">{person.name}</p>
          {person.isManager && <span className="text-[8px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-bold flex-shrink-0">MGR</span>}
        </div>
        <p className="text-[10px] text-gray-400 truncate">{person.businessTitle}</p>
      </div>
      <span className={`${badgeBg} text-white text-[8px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0`}>{badgeLabel}</span>
    </div>
  );
}

function PeoplePanel({ org, onClose }: { org: OrgTreeNode; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const filtered  = org.members.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.businessTitle.toLowerCase().includes(search.toLowerCase())
  );
  const managers = filtered.filter(p => p.isManager);
  const members  = filtered.filter(p => !p.isManager);
  return (
    <div className="absolute top-0 right-0 h-full w-72 bg-white border-l border-gray-200 shadow-xl flex flex-col z-20 animate-slide-in">
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{org.type}</p>
          <p className="text-sm font-bold text-gray-800 leading-tight">{org.name}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{org.members.length} personas · Nivel {org.depth}</p>
        </div>
        <button onClick={onClose} className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
      </div>
      <div className="px-3 py-2 border-b border-gray-100">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar persona..."
          className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-300 placeholder-gray-300" />
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {org.members.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-8">Sin personas asignadas</p>
        ) : (
          <>
            {managers.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5">Manager</p>
                {managers.map(p => <PersonCard key={p.workerId} person={p} />)}
              </div>
            )}
            {members.length > 0 && (
              <div>
                {managers.length > 0 && <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 mt-2 px-0.5">Equipo</p>}
                <div className="flex flex-col gap-1.5">
                  {members.map(p => <PersonCard key={p.workerId} person={p} />)}
                </div>
              </div>
            )}
            {filtered.length === 0 && search && (
              <p className="text-[11px] text-gray-400 text-center py-4">Sin resultados</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Canvas ────────────────────────────────────────────────────────────────────

interface OrgDiagramCanvasProps {
  orgParseResult: OrgParseResult;
  fileName?: string;
}

function OrgDiagramCanvasInner({ orgParseResult, fileName = 'organigrama' }: OrgDiagramCanvasProps) {
  const { fitView } = useReactFlow();

  const [expandedIds,    setExpandedIds]    = useState<Set<string>>(() => { const s = new Set<string>(); for (const [id] of orgParseResult.nodeMap) s.add(id); return s; });
  const [selectedOrgId,  setSelectedOrgId]  = useState<string | null>(null);
  const [orgSearch,      setOrgSearch]      = useState('');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [nodes, setNodes, onNodesChange]    = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange]    = useEdgesState<Edge>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Org search logic ────────────────────────────────────────────────────
  const handleOrgSearch = useCallback((query: string) => {
    setOrgSearch(query);
    const q = query.trim().toLowerCase();
    if (!q) { setHighlightedIds(new Set()); return; }
    const matched = new Set<string>();
    for (const [id, node] of orgParseResult.nodeMap) {
      if (node.name.toLowerCase().includes(q)) matched.add(id);
    }
    setHighlightedIds(matched);
  }, [orgParseResult]);

  const clearSearch = useCallback(() => {
    setOrgSearch('');
    setHighlightedIds(new Set());
    searchRef.current?.focus();
  }, []);

  const onToggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const onClickOrg = useCallback((id: string) => {
    setSelectedOrgId(prev => prev === id ? null : id);
  }, []);

  const expandAll   = useCallback(() => { const s = new Set<string>(); for (const [id] of orgParseResult.nodeMap) s.add(id); setExpandedIds(s); }, [orgParseResult]);
  const collapseAll = useCallback(() => { setExpandedIds(new Set(orgParseResult.multipleRoots.map(r => r.id))); }, [orgParseResult]);

  useEffect(() => {
    const { nodes: fn, edges: fe } = buildFlowElements(orgParseResult, expandedIds, selectedOrgId, highlightedIds, onToggleExpand, onClickOrg);
    setNodes(fn);
    setEdges(fe);
  }, [orgParseResult, expandedIds, selectedOrgId, highlightedIds, onToggleExpand, onClickOrg]);

  // Navigate to first highlighted node
  useEffect(() => {
    if (highlightedIds.size === 0) return;
    const firstId = [...highlightedIds][0];
    const node = nodes.find(n => n.id === firstId);
    if (node) fitView({ nodes: [node], padding: 0.5, duration: 400 });
  }, [highlightedIds, nodes, fitView]);

  const selectedOrg = selectedOrgId ? orgParseResult.nodeMap.get(selectedOrgId) ?? null : null;

  return (
    <div className="w-full h-full relative">
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
        <MiniMap maskColor="rgb(240,240,240,0.6)" className="!border !border-gray-200 !rounded-lg" />

        <Panel position="top-left" className="flex flex-col gap-2">

          {/* ── Búsqueda de org ── */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-3 flex flex-col gap-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Buscar organización</p>
            <div className="relative">
              <input
                ref={searchRef}
                value={orgSearch}
                onChange={e => handleOrgSearch(e.target.value)}
                placeholder="Nombre de organización…"
                className="w-full text-[11px] border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-blue-300 placeholder-gray-300"
              />
              {orgSearch && (
                <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs">✕</button>
              )}
            </div>
            {highlightedIds.size > 0 && (
              <p className="text-[10px] text-blue-500">{highlightedIds.size} resultado{highlightedIds.size !== 1 ? 's' : ''}</p>
            )}
            {orgSearch && highlightedIds.size === 0 && (
              <p className="text-[10px] text-gray-400">Sin resultados</p>
            )}
          </div>

          {/* ── Controles ── */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-3 flex flex-col gap-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Vista</p>
            <div className="flex gap-1.5">
              <button onClick={expandAll}   className="flex-1 text-[10px] font-medium px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 transition-colors">Expandir todo</button>
              <button onClick={collapseAll} className="flex-1 text-[10px] font-medium px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 transition-colors">Colapsar todo</button>
            </div>
          </div>

          {/* ── Resumen ── */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Resumen</p>
            <div className="space-y-1">
              <StatRow label="Organizaciones" value={orgParseResult.stats.totalOrgs} />
              <StatRow label="Personas"       value={orgParseResult.stats.totalWorkers} color="text-blue-600" />
              <StatRow label="Niveles"        value={orgParseResult.stats.maxDepth + 1} />
            </div>
          </div>

          {/* ── Exportar SVG ── */}
          <button
            onClick={() => exportOrgDiagramToSvg(orgParseResult, fileName)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold px-3 py-2 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
          >
            ⬇️ Exportar SVG
          </button>

          {/* ── Hint ── */}
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-2.5">
            <p className="text-[10px] text-blue-500 leading-snug">💡 Click en un nodo para ver las personas</p>
          </div>

        </Panel>
      </ReactFlow>

      {selectedOrg && (
        <PeoplePanel org={selectedOrg} onClose={() => setSelectedOrgId(null)} />
      )}
    </div>
  );
}

export function OrgDiagramCanvas(props: OrgDiagramCanvasProps) {
  return (
    <ReactFlowProvider>
      <OrgDiagramCanvasInner {...props} />
    </ReactFlowProvider>
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

// Need to import ReactFlowProvider
import { ReactFlowProvider } from '@xyflow/react';
