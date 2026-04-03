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
