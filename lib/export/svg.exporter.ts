import type { OrgChartNode, WorkdayLevel } from '@/types/orgchart.types';

const LEVEL_COLORS: Record<WorkdayLevel, { border: string; header: string; badge: string }> = {
  '0':          { border: '#7c3aed', header: '#f5f3ff', badge: '#7c3aed' },
  '1':          { border: '#2563eb', header: '#eff6ff', badge: '#2563eb' },
  '2':          { border: '#0ea5e9', header: '#f0f9ff', badge: '#0ea5e9' },
  '3':          { border: '#14b8a6', header: '#f0fdfa', badge: '#14b8a6' },
  '4':          { border: '#22c55e', header: '#f0fdf4', badge: '#22c55e' },
  '5':          { border: '#eab308', header: '#fefce8', badge: '#eab308' },
  '6':          { border: '#f97316', header: '#fff7ed', badge: '#f97316' },
  '7':          { border: '#f87171', header: '#fef2f2', badge: '#f87171' },
  '8':          { border: '#9ca3af', header: '#f9fafb', badge: '#9ca3af' },
  'DIRECTOR':   { border: '#7e22ce', header: '#faf5ff', badge: '#7e22ce' },
  'CONTINGENT': { border: '#f59e0b', header: '#fffbeb', badge: '#f59e0b' },
};

const LEVEL_LABELS: Record<WorkdayLevel, string> = {
  '0': 'N0', '1': 'N1', '2': 'N2', '3': 'N3', '4': 'N4',
  '5': 'N5', '6': 'N6', '7': 'N7', '8': 'N8',
  'DIRECTOR': 'DIR', 'CONTINGENT': 'CONT',
};

const NODE_W  = 224;
const NODE_H  = 130;
const RANK_SEP = 80;
const NODE_SEP = 24;

interface LayoutNode {
  node: OrgChartNode;
  x: number;
  y: number;
}

// Layout simple top-down sin dagre (no disponible en el contexto SVG)
function computeLayout(root: OrgChartNode, visibleIds: Set<string>): LayoutNode[] {
  const result: LayoutNode[] = [];

  function getSubtreeWidth(node: OrgChartNode): number {
    const visibleChildren = node.children.filter(c => visibleIds.has(c.id));
    if (visibleChildren.length === 0) return NODE_W;
    const childrenWidth = visibleChildren.reduce((sum, c) => sum + getSubtreeWidth(c) + NODE_SEP, -NODE_SEP);
    return Math.max(NODE_W, childrenWidth);
  }

  function place(node: OrgChartNode, x: number, y: number) {
    result.push({ node, x, y });
    const visibleChildren = node.children.filter(c => visibleIds.has(c.id));
    if (visibleChildren.length === 0) return;

    const totalWidth = visibleChildren.reduce((sum, c) => sum + getSubtreeWidth(c) + NODE_SEP, -NODE_SEP);
    let cx = x + NODE_W / 2 - totalWidth / 2;

    for (const child of visibleChildren) {
      const cw = getSubtreeWidth(child);
      place(child, cx, y + NODE_H + RANK_SEP);
      cx += cw + NODE_SEP;
    }
  }

  place(root, 0, 0);
  return result;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderNode(ln: LayoutNode): string {
  const { node, x, y } = ln;
  const c = LEVEL_COLORS[node.level];
  const label = LEVEL_LABELS[node.level];
  const isDashed = node.workerType === 'Contingent Worker';
  const strokeDash = isDashed ? 'stroke-dasharray="6,3"' : '';

  const initials = node.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return `
  <g transform="translate(${x}, ${y})">
    <!-- Sombra -->
    <rect x="2" y="2" width="${NODE_W}" height="${NODE_H}" rx="12" fill="#00000015"/>
    <!-- Fondo tarjeta -->
    <rect width="${NODE_W}" height="${NODE_H}" rx="12" fill="white" stroke="${c.border}" stroke-width="2" ${strokeDash}/>
    <!-- Header -->
    <rect width="${NODE_W}" height="52" rx="12" fill="${c.header}"/>
    <rect y="40" width="${NODE_W}" height="12" fill="${c.header}"/>
    <!-- Avatar -->
    <circle cx="30" cy="26" r="16" fill="white" stroke="${c.border}" stroke-width="1.5"/>
    <text x="30" y="31" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="${c.border}">${escapeXml(initials)}</text>
    <!-- Nombre -->
    <text x="54" y="20" font-family="Arial" font-size="11" font-weight="bold" fill="#1f2937">
      <tspan>${escapeXml(node.name.length > 22 ? node.name.slice(0, 22) + '…' : node.name)}</tspan>
    </text>
    <!-- Título -->
    <text x="54" y="34" font-family="Arial" font-size="9" fill="#6b7280">
      <tspan>${escapeXml(node.businessTitle.length > 28 ? node.businessTitle.slice(0, 28) + '…' : node.businessTitle)}</tspan>
    </text>
    <!-- Badge nivel -->
    <rect x="${NODE_W - 36}" y="6" width="28" height="16" rx="4" fill="${c.badge}"/>
    <text x="${NODE_W - 22}" y="18" text-anchor="middle" font-family="Arial" font-size="9" font-weight="bold" fill="white">${escapeXml(label)}</text>
    <!-- Metadatos -->
    <text x="12" y="68" font-family="Arial" font-size="9" fill="#6b7280">◈ ${escapeXml(node.businessLine.length > 30 ? node.businessLine.slice(0, 30) + '…' : node.businessLine)}</text>
    <text x="12" y="82" font-family="Arial" font-size="9" fill="#6b7280">⊞ ${escapeXml(node.division.length > 30 ? node.division.slice(0, 30) + '…' : node.division)}</text>
    <text x="12" y="96" font-family="Arial" font-size="9" fill="#6b7280">🏢 ${escapeXml(node.company.length > 30 ? node.company.slice(0, 30) + '…' : node.company)}</text>
    ${node.location ? `<text x="12" y="110" font-family="Arial" font-size="9" fill="#6b7280">📍 ${escapeXml(node.location)}</text>` : ''}
    ${node.directReports > 0 ? `
    <line x1="0" y1="${NODE_H - 18}" x2="${NODE_W}" y2="${NODE_H - 18}" stroke="#f3f4f6" stroke-width="1"/>
    <text x="10" y="${NODE_H - 6}" font-family="Arial" font-size="8" fill="#9ca3af">${node.totalDescendants} personas</text>
    <text x="${NODE_W - 10}" y="${NODE_H - 6}" text-anchor="end" font-family="Arial" font-size="8" fill="#9ca3af">${node.directReports} directos</text>
    ` : ''}
  </g>`;
}

function renderEdge(parent: LayoutNode, child: LayoutNode): string {
  const x1 = parent.x + NODE_W / 2;
  const y1 = parent.y + NODE_H;
  const x2 = child.x  + NODE_W / 2;
  const y2 = child.y;
  const my = (y1 + y2) / 2;

  return `<path d="M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}" 
    fill="none" stroke="#cbd5e1" stroke-width="1.5"/>`;
}

export function exportOrgChartToSvg(
  root: OrgChartNode,
  visibleNodes: OrgChartNode[],
  fileName = 'organigrama'
): void {
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const layoutNodes = computeLayout(root, visibleIds);
  const layoutMap = new Map(layoutNodes.map(ln => [ln.node.id, ln]));

  // Calcular viewBox
  const PADDING = 40;
  const xs = layoutNodes.map(ln => ln.x);
  const ys = layoutNodes.map(ln => ln.y);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  const maxX = Math.max(...xs) + NODE_W + PADDING;
  const maxY = Math.max(...ys) + NODE_H + PADDING;
  const svgW = maxX - minX;
  const svgH = maxY - minY;

  // Aristas
  const edges = layoutNodes
    .filter(ln => ln.node.managerId && layoutMap.has(ln.node.managerId))
    .map(ln => renderEdge(layoutMap.get(ln.node.managerId!)!, ln))
    .join('\n');

  // Nodos
  const nodes = layoutNodes.map(renderNode).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="${minX} ${minY} ${svgW} ${svgH}"
     width="${svgW}" height="${svgH}">
  <defs>
    <style>text { font-family: Arial, sans-serif; }</style>
  </defs>
  <rect x="${minX}" y="${minY}" width="${svgW}" height="${svgH}" fill="#f8fafc"/>
  <!-- Aristas -->
  ${edges}
  <!-- Nodos -->
  ${nodes}
</svg>`;

  // Descarga
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${fileName}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
