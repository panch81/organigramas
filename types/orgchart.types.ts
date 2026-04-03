export type WorkdayLevel =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | 'DIRECTOR'
  | 'CONTINGENT';

export interface WorkdayWorker {
  worker_id: string;
  manager_id: string;
  name: string;
  business_title: string;
  business_line: string;
  division: string;
  company: string;
  worker_type: 'Employee' | 'Contingent Worker';
  level: WorkdayLevel;
  location?: string;
  photo_url?: string;
}

export interface OrgChartNode {
  id: string;
  managerId: string | null;
  name: string;
  businessTitle: string;
  businessLine: string;
  division: string;
  company: string;
  workerType: 'Employee' | 'Contingent Worker';
  level: WorkdayLevel;
  location?: string;
  photoUrl?: string;
  children: OrgChartNode[];
  depth: number;
  totalDescendants: number;
  directReports: number;
  path: string[];
  isExpanded: boolean;
  isVisible: boolean;
  subtreeSize: number;
}

export interface ParseResult {
  root: OrgChartNode | null;
  multipleRoots: OrgChartNode[];
  orphanNodes: WorkdayWorker[];
  nodeMap: Map<string, OrgChartNode>;
  stats: ParseStats;
  warnings: ParseWarning[];
}

export interface ParseStats {
  totalWorkers: number;
  totalEmployees: number;
  totalContingent: number;
  maxDepth: number;
  averageSpan: number;
}

export interface ParseWarning {
  type:
    | 'ORPHAN_NODE'
    | 'DUPLICATE_ID'
    | 'SELF_REFERENCE'
    | 'CIRCULAR_DEPENDENCY'
    | 'MULTIPLE_ROOTS';
  workerId: string;
  message: string;
}

export interface ExportOptions {
  format: 'A4' | 'A3';
  orientation: 'landscape' | 'portrait';
  scope: 'full' | 'visible' | 'branch';
  branchRootId?: string;
  resolution: 'standard' | 'high' | 'print';
  includeMetadata: boolean;
  marginMm: number;
}

// ─── ADDITIONS TO orgchart.types.ts ──────────────────────────────────────────
// Añade estas interfaces al final del fichero existente orgchart.types.ts

// ── Input JSON ────────────────────────────────────────────────────────────────

/** Una organización tal como viene en el JSON */
export interface OrgWorkerInput {
  worker_id: string;
  manager_id?: string | null;
  name: string;
  business_title?: string;
  business_line?: string;
  division?: string;
  company?: string;
  worker_type?: string;
  level?: string;
  location?: string;
  photo_url?: string;
}

export interface OrgOrganizationInput {
  org_id: string;
  parent_org_id?: string | null;
  name: string;
  /** worker_id del manager de esta org. Según regla Workday: pertenece a la org padre */
  manager_id?: string | null;
  type?: string;
  location?: string;
  cost_center?: string;
}

/** Formato del JSON completo para el modo Organizaciones */
export interface OrgDiagramJson {
  organizations: OrgOrganizationInput[];
  workers: OrgWorkerInput[];
}

// ── Nodos del árbol de organizaciones ─────────────────────────────────────────

export interface OrgTreeNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  location?: string;
  costCenter?: string;
  /** worker_id del manager. Según Workday pertenece a la org PADRE */
  managerId: string | null;
  manager?: OrgPersonNode | null;
  /** Personas que pertenecen a esta org (excluye el manager) */
  members: OrgPersonNode[];
  children: OrgTreeNode[];
  depth: number;
  totalDescendants: number;
  directReports: number;
  path: string[];
  isExpanded: boolean;
}

export interface OrgPersonNode {
  workerId: string;
  name: string;
  businessTitle: string;
  workerType: 'Employee' | 'Contingent Worker';
  level: string;
  location?: string;
  photoUrl?: string;
  /** org a la que pertenece */
  orgId: string;
  isManager: boolean;
}

export interface OrgParseResult {
  root: OrgTreeNode | null;
  multipleRoots: OrgTreeNode[];
  nodeMap: Map<string, OrgTreeNode>;
  personMap: Map<string, OrgPersonNode>;
  stats: {
    totalOrgs: number;
    totalWorkers: number;
    maxDepth: number;
  };
  warnings: string[];
}
