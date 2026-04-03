'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OrgChartNode as OrgChartNodeType } from '@/types/orgchart.types';

const LEVEL_STYLES: Record<string, { border: string; badge: string; badgeText: string; headerBg: string }> = {
  '0':          { border: 'border-violet-600',  badge: 'bg-violet-600',  badgeText: 'N0',   headerBg: 'bg-violet-50'  },
  '1':          { border: 'border-blue-600',    badge: 'bg-blue-600',    badgeText: 'N1',   headerBg: 'bg-blue-50'    },
  '2':          { border: 'border-sky-500',     badge: 'bg-sky-500',     badgeText: 'N2',   headerBg: 'bg-sky-50'     },
  '3':          { border: 'border-teal-500',    badge: 'bg-teal-500',    badgeText: 'N3',   headerBg: 'bg-teal-50'    },
  '4':          { border: 'border-green-500',   badge: 'bg-green-500',   badgeText: 'N4',   headerBg: 'bg-green-50'   },
  '5':          { border: 'border-yellow-500',  badge: 'bg-yellow-500',  badgeText: 'N5',   headerBg: 'bg-yellow-50'  },
  '6':          { border: 'border-orange-500',  badge: 'bg-orange-500',  badgeText: 'N6',   headerBg: 'bg-orange-50'  },
  '7':          { border: 'border-red-400',     badge: 'bg-red-400',     badgeText: 'N7',   headerBg: 'bg-red-50'     },
  '8':          { border: 'border-gray-400',    badge: 'bg-gray-400',    badgeText: 'N8',   headerBg: 'bg-gray-50'    },
  'DIRECTOR':   { border: 'border-purple-700',  badge: 'bg-purple-700',  badgeText: 'DIR',  headerBg: 'bg-purple-50'  },
  'CONTINGENT': { border: 'border-amber-400',   badge: 'bg-amber-400',   badgeText: 'CONT', headerBg: 'bg-amber-50'   },
};

const DEFAULT_STYLE = { border: 'border-gray-300', badge: 'bg-gray-300', badgeText: '?', headerBg: 'bg-gray-50' };

export type OrgChartNodeData = OrgChartNodeType & {
  onToggleExpand: (id: string) => void;
};

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />;
  }
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-white ring-2 ring-white shadow-sm flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-gray-600">{initials}</span>
    </div>
  );
}

function MetaRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[10px] flex-shrink-0">{icon}</span>
      <span className="text-[10px] text-gray-500 truncate">{label}</span>
    </div>
  );
}

function CollapseButton({ isExpanded, count, onClick }: { isExpanded: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5 shadow-sm text-[10px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors z-10"
    >
      <span>{isExpanded ? '▲' : '▼'}</span>
      <span>{count}</span>
    </button>
  );
}

function OrgChartNodeComponent({ data, selected }: NodeProps) {
  const node = data as unknown as OrgChartNodeData;
  const style = LEVEL_STYLES[node.level] ?? DEFAULT_STYLE;
  const hasChildren = node.directReports > 0;
  const isContingent = node.workerType === 'Contingent Worker';

  return (
    <div className={`relative bg-white rounded-xl border-2 shadow-md w-56 min-h-[88px] transition-all duration-200 ${style.border} ${selected ? 'ring-2 ring-offset-2 ring-blue-400 shadow-lg' : ''} ${isContingent ? 'border-dashed' : ''}`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2 !border-0" />

      <div className={`${style.headerBg} rounded-t-[10px] px-3 py-2 flex items-center gap-2`}>
        <Avatar name={node.name} photoUrl={node.photoUrl} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-800 truncate leading-tight">{node.name}</p>
          <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">{node.businessTitle}</p>
        </div>
        <span className={`${style.badge} text-white text-[9px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0 self-start`}>
          {style.badgeText}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1">
        {node.businessLine && <MetaRow icon="◈" label={node.businessLine} />}
        {node.division     && <MetaRow icon="⊞" label={node.division} />}
        {node.company      && <MetaRow icon="🏢" label={node.company} />}
        {node.location     && <MetaRow icon="📍" label={node.location} />}
      </div>

      {hasChildren && (
        <div className="border-t border-gray-100 px-3 py-1 flex justify-between items-center">
          <span className="text-[9px] text-gray-400">{node.totalDescendants} personas</span>
          <span className="text-[9px] text-gray-400">{node.directReports} directos</span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2 !border-0" />

      {hasChildren && (
        <CollapseButton isExpanded={node.isExpanded} count={node.directReports} onClick={() => node.onToggleExpand(node.id)} />
      )}
    </div>
  );
}

export const OrgChartNodeComponent_Memo = memo(OrgChartNodeComponent);
