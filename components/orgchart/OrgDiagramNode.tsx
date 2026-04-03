'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OrgTreeNode, OrgPersonNode } from '@/types/orgchart.types';

const DEPTH_STYLES: Record<number, { border: string; badge: string; headerBg: string; icon: string }> = {
  0: { border: 'border-violet-600',  badge: 'bg-violet-600',  headerBg: 'bg-violet-50',  icon: '🏛️' },
  1: { border: 'border-blue-600',    badge: 'bg-blue-600',    headerBg: 'bg-blue-50',    icon: '🏢' },
  2: { border: 'border-sky-500',     badge: 'bg-sky-500',     headerBg: 'bg-sky-50',     icon: '🏬' },
  3: { border: 'border-teal-500',    badge: 'bg-teal-500',    headerBg: 'bg-teal-50',    icon: '📁' },
  4: { border: 'border-green-500',   badge: 'bg-green-500',   headerBg: 'bg-green-50',   icon: '📂' },
};
const DEFAULT_DEPTH_STYLE = { border: 'border-gray-400', badge: 'bg-gray-400', headerBg: 'bg-gray-50', icon: '📋' };

export type OrgDiagramNodeData = OrgTreeNode & {
  onToggleExpand: (id: string) => void;
  onClickOrg: (id: string) => void;
  isSelected: boolean;
};

function ManagerAvatar({ manager }: { manager: OrgPersonNode }) {
  const initials = manager.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  return (
    <div className="flex items-center gap-1.5 mt-1 px-1">
      <div className="w-5 h-5 rounded-full bg-white ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0">
        {manager.photoUrl
          ? <img src={manager.photoUrl} alt={manager.name} className="w-5 h-5 rounded-full object-cover" />
          : <span className="text-[8px] font-bold text-gray-500">{initials}</span>}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold text-gray-700 truncate leading-tight">{manager.name}</p>
        <p className="text-[8px] text-gray-400 truncate leading-none">{manager.businessTitle}</p>
      </div>
    </div>
  );
}

function OrgDiagramNodeComponent({ data, selected }: NodeProps) {
  const node = data as unknown as OrgDiagramNodeData;
  const style = DEPTH_STYLES[node.depth] ?? DEFAULT_DEPTH_STYLE;
  const hasChildren = node.children.length > 0;
  const totalPeople = node.members.length;

  return (
    <div
      className={`
        relative bg-white rounded-xl border-2 shadow-md w-52 transition-all duration-200 cursor-pointer
        ${style.border}
        ${selected || node.isSelected ? 'ring-2 ring-offset-2 ring-blue-400 shadow-lg' : ''}
        hover:shadow-lg hover:scale-[1.02]
      `}
      onClick={() => node.onClickOrg(node.id)}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2 !border-0" />

      {/* Header */}
      <div className={`${style.headerBg} rounded-t-[10px] px-3 py-2`}>
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0 mt-0.5">{style.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-gray-800 leading-tight line-clamp-2">{node.name}</p>
            <p className="text-[9px] text-gray-500 mt-0.5">{node.type}</p>
          </div>
          <span className={`${style.badge} text-white text-[8px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0`}>
            N{node.depth}
          </span>
        </div>

        {/* Manager */}
        {node.manager && <ManagerAvatar manager={node.manager} />}
      </div>

      {/* Stats */}
      <div className="px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-gray-400">👥</span>
          <span className="text-[9px] text-gray-500 font-medium">{totalPeople} personas</span>
        </div>
        {node.costCenter && (
          <span className="text-[8px] text-gray-400 truncate max-w-[80px]">{node.costCenter}</span>
        )}
      </div>

      {/* Sub-orgs */}
      {hasChildren && (
        <div className="border-t border-gray-100 px-3 py-1 flex justify-between items-center">
          <span className="text-[9px] text-gray-400">{node.directReports} sub-orgs</span>
          <span className="text-[9px] text-gray-400">{node.totalDescendants} total</span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2 !border-0" />

      {/* Expand/collapse button */}
      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); node.onToggleExpand(node.id); }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5 shadow-sm text-[10px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors z-10"
        >
          <span>{node.isExpanded ? '▲' : '▼'}</span>
          <span>{node.directReports}</span>
        </button>
      )}
    </div>
  );
}

export const OrgDiagramNodeComponent_Memo = memo(OrgDiagramNodeComponent);
