'use client';

import { useState } from 'react';

export interface ExportConfig {
  rootId: string;
  maxLevels: number; // 0 = todos
}

export interface ExportNodeOption {
  id: string;
  label: string;   // nombre para mostrar en el desplegable
  depth: number;
}

interface ExportModalProps {
  nodes: ExportNodeOption[];
  maxDepth: number;
  defaultRootId: string;
  onExport: (config: ExportConfig) => void;
  onClose: () => void;
  /** Filtros activos como texto descriptivo (opcional) */
  filterSummary?: string;
}

export function ExportModal({
  nodes,
  maxDepth,
  defaultRootId,
  onExport,
  onClose,
  filterSummary,
}: ExportModalProps) {
  const [rootId,    setRootId]    = useState(defaultRootId);
  const [maxLevels, setMaxLevels] = useState(0);

  // Levels available relative to selected root
  const rootNode   = nodes.find(n => n.id === rootId);
  const rootDepth  = rootNode?.depth ?? 0;
  const levelsDown = maxDepth - rootDepth;
  const levelOptions = Array.from({ length: levelsDown }, (_, i) => i + 1);

  const handleRootChange = (id: string) => {
    setRootId(id);
    setMaxLevels(0); // reset on root change
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 p-5 flex flex-col gap-4 animate-slide-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">Exportar SVG</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Configura el alcance del diagrama</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-lg leading-none transition-colors">✕</button>
        </div>

        {/* Active filters notice */}
        {filterSummary && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <p className="text-[10px] text-blue-600 leading-snug">
              <span className="font-semibold">Filtros activos:</span> {filterSummary}
            </p>
            <p className="text-[10px] text-blue-400 mt-0.5">El SVG respetará los filtros aplicados.</p>
          </div>
        )}

        {/* Root node selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nodo raíz</label>
          <select
            value={rootId}
            onChange={e => handleRootChange(e.target.value)}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-300 bg-white text-gray-700"
          >
            {nodes.map(n => (
              <option key={n.id} value={n.id}>
                {'  '.repeat(n.depth)}{n.depth > 0 ? '└ ' : ''}{n.label}
              </option>
            ))}
          </select>
        </div>

        {/* Levels selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Niveles hacia abajo</label>
          <select
            value={maxLevels}
            onChange={e => setMaxLevels(Number(e.target.value))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-300 bg-white text-gray-700"
          >
            <option value={0}>Todos los niveles</option>
            {levelOptions.map(l => (
              <option key={l} value={l}>{l} nivel{l !== 1 ? 'es' : ''}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 text-[11px] font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={() => onExport({ rootId, maxLevels })}
            className="flex-1 text-[11px] font-semibold px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-1.5">
            ⬇️ Exportar
          </button>
        </div>

      </div>
    </div>
  );
}
