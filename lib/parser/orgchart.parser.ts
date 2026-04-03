import type {
  WorkdayWorker,
  OrgChartNode,
  ParseResult,
  ParseStats,
  ParseWarning,
  WorkdayLevel,
} from '@/types/orgchart.types';

function normalizeManagerId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  const EMPTY_VALUES = new Set(['', 'null', 'undefined', '0', '-', 'none', 'n/a']);
  return EMPTY_VALUES.has(str.toLowerCase()) ? null : str;
}

function normalizeWorkerType(value: unknown): 'Employee' | 'Contingent Worker' {
  const str = String(value ?? '').trim().toLowerCase();
  if (str.includes('contingent') || str.includes('contractor') || str.includes('temporary')) {
    return 'Contingent Worker';
  }
  return 'Employee';
}

function normalizeLevel(value: unknown, workerType: 'Employee' | 'Contingent Worker'): WorkdayLevel {
  if (workerType === 'Contingent Worker') return 'CONTINGENT';
  const str = String(value ?? '').trim().toUpperCase();
  const EMPLOYEE_LEVELS = new Set<WorkdayLevel>(['0', '1', '2', '3', '4', '5', '6', '7', '8', 'DIRECTOR']);
  if (EMPLOYEE_LEVELS.has(str as WorkdayLevel)) return str as WorkdayLevel;
  return '8';
}

function detectCycles(adjacencyMap: Map<string, string[]>): Set<string> {
  const colors = new Map<string, 'WHITE' | 'GRAY' | 'BLACK'>();
  const cycleNodes = new Set<string>();
  for (const nodeId of adjacencyMap.keys()) colors.set(nodeId, 'WHITE');

  function dfs(nodeId: string): boolean {
    colors.set(nodeId, 'GRAY');
    for (const childId of adjacencyMap.get(nodeId) ?? []) {
      const color = colors.get(childId);
      if (color === 'GRAY') { cycleNodes.add(nodeId); cycleNodes.add(childId); return true; }
      if (color === 'WHITE' && dfs(childId)) cycleNodes.add(nodeId);
    }
    colors.set(nodeId, 'BLACK');
    return false;
  }

  for (const [nodeId, color] of colors.entries()) if (color === 'WHITE') dfs(nodeId);
  return cycleNodes;
}

export function parseWorkdayToTree(workers: WorkdayWorker[]): ParseResult {
  const warnings: ParseWarning[] = [];
  const nodeMap = new Map<string, OrgChartNode>();
  const seenIds = new Set<string>();
  const orphanNodes: WorkdayWorker[] = [];
  const validWorkers: WorkdayWorker[] = [];

  for (const worker of workers) {
    const id = String(worker.worker_id ?? '').trim();
    if (!id) {
      warnings.push({ type: 'ORPHAN_NODE', workerId: 'UNKNOWN', message: `Worker sin worker_id: "${worker.name}". Se omitirá.` });
      continue;
    }
    if (seenIds.has(id)) {
      warnings.push({ type: 'DUPLICATE_ID', workerId: id, message: `ID duplicado: "${id}" (${worker.name}).` });
      continue;
    }
    const managerId = normalizeManagerId(worker.manager_id);
    if (managerId === id) {
      warnings.push({ type: 'SELF_REFERENCE', workerId: id, message: `"${worker.name}" se referencia a sí mismo. Se tratará como raíz.` });
      validWorkers.push({ ...worker, manager_id: '' });
    } else {
      validWorkers.push(worker);
    }
    seenIds.add(id);
  }

  for (const worker of validWorkers) {
    const id = String(worker.worker_id).trim();
    const managerId = normalizeManagerId(worker.manager_id);
    const workerType = normalizeWorkerType(worker.worker_type);
    nodeMap.set(id, {
      id, managerId,
      name:          worker.name?.trim()           ?? 'Sin nombre',
      businessTitle: worker.business_title?.trim() ?? 'Sin título',
      businessLine:  worker.business_line?.trim()  ?? 'Sin business line',
      division:      worker.division?.trim()       ?? 'Sin división',
      company:       worker.company?.trim()        ?? 'Sin empresa',
      workerType,
      level:         normalizeLevel(worker.level, workerType),
      location:      worker.location?.trim(),
      photoUrl:      worker.photo_url?.trim(),
      children: [], depth: 0, totalDescendants: 0,
      directReports: 0, path: [], isExpanded: true, isVisible: true, subtreeSize: 1,
    });
  }

  const adjacencyMap = new Map<string, string[]>();
  for (const [id, node] of nodeMap.entries()) {
    if (node.managerId && nodeMap.has(node.managerId)) {
      if (!adjacencyMap.has(node.managerId)) adjacencyMap.set(node.managerId, []);
      adjacencyMap.get(node.managerId)!.push(id);
    }
  }

  for (const cycleId of detectCycles(adjacencyMap)) {
    const node = nodeMap.get(cycleId);
    warnings.push({ type: 'CIRCULAR_DEPENDENCY', workerId: cycleId, message: `Ciclo en "${node?.name}" (${cycleId}). Se trata como raíz.` });
    const cycleNode = nodeMap.get(cycleId);
    if (cycleNode) cycleNode.managerId = null;
  }

  const roots: OrgChartNode[] = [];
  for (const [, node] of nodeMap.entries()) {
    if (!node.managerId) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(node.managerId);
      if (parent) {
        parent.children.push(node);
        parent.directReports++;
      } else {
        const orig = validWorkers.find(w => w.worker_id === node.id);
        if (orig) orphanNodes.push(orig);
        warnings.push({ type: 'ORPHAN_NODE', workerId: node.id, message: `"${node.name}" referencia manager inexistente. Se añade como raíz.` });
        node.managerId = null;
        roots.push(node);
      }
    }
  }

  if (roots.length > 1) {
    warnings.push({ type: 'MULTIPLE_ROOTS', workerId: roots.map(r => r.id).join(', '), message: `${roots.length} raíces detectadas.` });
  }

  function enrichNodeMetadata(node: OrgChartNode, depth: number, path: string[]): number {
    node.depth = depth;
    node.path = [...path, node.id];
    node.subtreeSize = 1;
    node.children.sort((a, b) => {
      if (a.workerType !== b.workerType) return a.workerType === 'Employee' ? -1 : 1;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
    for (const child of node.children) {
      const size = enrichNodeMetadata(child, depth + 1, node.path);
      node.totalDescendants += size;
      node.subtreeSize += size;
    }
    return node.totalDescendants;
  }

  for (const root of roots) enrichNodeMetadata(root, 0, []);

  let maxDepth = 0, totalManagerSpan = 0, managerCount = 0, totalEmployees = 0, totalContingent = 0;
  for (const [, node] of nodeMap.entries()) {
    if (node.depth > maxDepth) maxDepth = node.depth;
    if (node.children.length > 0) { totalManagerSpan += node.children.length; managerCount++; }
    if (node.workerType === 'Employee') totalEmployees++; else totalContingent++;
  }

  const stats: ParseStats = {
    totalWorkers: nodeMap.size, totalEmployees, totalContingent, maxDepth,
    averageSpan: managerCount > 0 ? Math.round((totalManagerSpan / managerCount) * 10) / 10 : 0,
  };

  return { root: roots[0] ?? null, multipleRoots: roots, orphanNodes, nodeMap, stats, warnings };
}

export function extractSubtree(nodeMap: Map<string, OrgChartNode>, branchRootId: string): OrgChartNode | null {
  return nodeMap.get(branchRootId) ?? null;
}

export function flattenTree(root: OrgChartNode): OrgChartNode[] {
  const result: OrgChartNode[] = [];
  const queue: OrgChartNode[] = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    queue.push(...current.children);
  }
  return result;
}

export function searchNodes(root: OrgChartNode, query: string): Set<string> {
  const matchedIds = new Set<string>();
  const q = query.toLowerCase().trim();
  if (!q) return matchedIds;
  function dfs(node: OrgChartNode): boolean {
    const isMatch = [node.name, node.businessTitle, node.businessLine, node.division, node.company]
      .some(f => f?.toLowerCase().includes(q));
    let childMatched = false;
    for (const child of node.children) if (dfs(child)) childMatched = true;
    if (isMatch || childMatched) { matchedIds.add(node.id); return true; }
    return false;
  }
  dfs(root);
  return matchedIds;
}

export function getNodePath(nodeMap: Map<string, OrgChartNode>, nodeId: string): OrgChartNode[] {
  const node = nodeMap.get(nodeId);
  if (!node) return [];
  return node.path.map(id => nodeMap.get(id)).filter((n): n is OrgChartNode => n !== undefined);
}
