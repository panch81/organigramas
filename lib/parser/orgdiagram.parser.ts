import type {
  OrgDiagramJson,
  OrgTreeNode,
  OrgPersonNode,
  OrgParseResult,
  OrgOrganizationInput,
  OrgWorkerInput,
} from '@/types/orgchart.types';

function normalizeId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  const EMPTY = new Set(['', 'null', 'undefined', '0', '-', 'none', 'n/a']);
  return EMPTY.has(str.toLowerCase()) ? null : str;
}

function normalizeWorkerType(value: unknown): 'Employee' | 'Contingent Worker' {
  const str = String(value ?? '').toLowerCase();
  return str.includes('contingent') || str.includes('contractor') ? 'Contingent Worker' : 'Employee';
}

export function parseOrgDiagram(data: OrgDiagramJson): OrgParseResult {
  const warnings: string[] = [];
  const orgMap = new Map<string, OrgTreeNode>();
  const personMap = new Map<string, OrgPersonNode>();

  // ── 1. Construir personMap ────────────────────────────────────────────────
  for (const w of data.workers ?? []) {
    const id = normalizeId(w.worker_id);
    if (!id) { warnings.push(`Worker sin worker_id: "${w.name}". Omitido.`); continue; }
    personMap.set(id, {
      workerId: id,
      name: w.name?.trim() ?? 'Sin nombre',
      businessTitle: w.business_title?.trim() ?? '',
      workerType: normalizeWorkerType(w.worker_type),
      level: String(w.level ?? '').trim() || '8',
      location: w.location?.trim(),
      photoUrl: w.photo_url?.trim(),
      orgId: '',       // se rellena abajo
      isManager: false,
    });
  }

  // ── 2. Construir orgMap ───────────────────────────────────────────────────
  for (const org of data.organizations ?? []) {
    const id = normalizeId(org.org_id);
    if (!id) { warnings.push(`Organización sin org_id: "${org.name}". Omitida.`); continue; }
    orgMap.set(id, {
      id,
      parentId: normalizeId(org.parent_org_id),
      name: org.name?.trim() ?? 'Sin nombre',
      type: org.type?.trim() ?? 'Organización',
      location: org.location?.trim(),
      costCenter: org.cost_center?.trim(),
      managerId: normalizeId(org.manager_id),
      manager: null,
      members: [],
      children: [],
      depth: 0,
      totalDescendants: 0,
      directReports: 0,
      path: [],
      isExpanded: true,
    });
  }

  // ── 3. Regla Workday: el manager de una org pertenece a la org PADRE ──────
  //   → asignamos persons a orgs sin contar el manager en su propia org
  //   Paso 3a: construir mapa orgId -> manager worker_id
  const orgManagerWorkerMap = new Map<string, string>(); // orgId -> workerId
  for (const [orgId, orgNode] of orgMap.entries()) {
    if (orgNode.managerId) orgManagerWorkerMap.set(orgId, orgNode.managerId);
  }

  // Paso 3b: asignar cada worker a una org.
  //   Si el worker es manager de una org X, pertenece al PADRE de X.
  //   Necesitamos saber qué org "gestiona" cada worker (puede gestionar varias en edge cases).
  //   Usamos el campo org_id del worker si existiese, o lo inferimos.

  // Primero detectamos qué workers son managers de qué orgs
  const workerManagedOrgs = new Map<string, string>(); // workerId -> orgId que gestiona
  for (const [orgId, orgNode] of orgMap.entries()) {
    if (orgNode.managerId) {
      if (workerManagedOrgs.has(orgNode.managerId)) {
        warnings.push(`Worker ${orgNode.managerId} es manager de múltiples orgs. Se usa la primera.`);
      } else {
        workerManagedOrgs.set(orgNode.managerId, orgId);
      }
    }
  }

  // Asignar workers a sus orgs
  for (const w of data.workers ?? []) {
    const workerId = normalizeId(w.worker_id);
    if (!workerId) continue;
    const person = personMap.get(workerId);
    if (!person) continue;

    // ¿Es manager de alguna org?
    const managedOrgId = workerManagedOrgs.get(workerId);

    // Determinar a qué org pertenece este worker
    // Primero miramos si el JSON trae un campo de org directa
    const directOrgId = normalizeId((w as OrgWorkerInput & { org_id?: string }).org_id);

    let targetOrgId: string | null = null;

    if (managedOrgId) {
      // Regla Workday: el manager de orgX pertenece a la org PADRE de orgX
      const managedOrg = orgMap.get(managedOrgId);
      targetOrgId = managedOrg?.parentId ?? managedOrgId; // si no hay padre, se queda en su org
      person.isManager = true;
    } else if (directOrgId && orgMap.has(directOrgId)) {
      targetOrgId = directOrgId;
    }

    if (targetOrgId && orgMap.has(targetOrgId)) {
      person.orgId = targetOrgId;
      const targetOrg = orgMap.get(targetOrgId)!;

      if (person.isManager) {
        // Es el manager de su org padre: lo marcamos en la org que gestiona también
        const managedOrg = orgMap.get(managedOrgId!)!;
        managedOrg.manager = person;
        targetOrg.members.push(person);
      } else {
        targetOrg.members.push(person);
      }
    }
  }

  // ── 4. Construir árbol ────────────────────────────────────────────────────
  const roots: OrgTreeNode[] = [];

  for (const [, orgNode] of orgMap.entries()) {
    if (!orgNode.parentId || !orgMap.has(orgNode.parentId)) {
      roots.push(orgNode);
    } else {
      const parent = orgMap.get(orgNode.parentId)!;
      parent.children.push(orgNode);
      parent.directReports++;
    }
  }

  if (roots.length > 1) {
    warnings.push(`${roots.length} organizaciones raíz detectadas.`);
  }

  // ── 5. Enriquecer metadatos ───────────────────────────────────────────────
  function enrich(node: OrgTreeNode, depth: number, path: string[]): number {
    node.depth = depth;
    node.path = [...path, node.id];
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    node.totalDescendants = node.children.length;
    for (const child of node.children) {
      node.totalDescendants += enrich(child, depth + 1, node.path);
    }
    return node.totalDescendants;
  }

  for (const root of roots) enrich(root, 0, []);

  let maxDepth = 0;
  for (const [, n] of orgMap.entries()) if (n.depth > maxDepth) maxDepth = n.depth;

  return {
    root: roots[0] ?? null,
    multipleRoots: roots,
    nodeMap: orgMap,
    personMap,
    stats: { totalOrgs: orgMap.size, totalWorkers: personMap.size, maxDepth },
    warnings,
  };
}
