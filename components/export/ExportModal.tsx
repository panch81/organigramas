'use client';

import { useState } from 'react';
import type { ExportOptions, OrgChartNode } from '@/types/orgchart.types';
import { exportOrgChartToPdf } from '@/lib/export/pdf.exporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  visibleNodes: OrgChartNode[];
  expandedIds: Set<string>;
}

const DEFAULT_OPTIONS: ExportOptions = {
  format:          'A4',
  orientation:     'landscape',
  scope:           'visible',
  resolution:      'high',
  includeMetadata: true,
  marginMm:        10,
};

export function ExportModal({ isOpen, onClose, fileName = 'organigrama', visibleNodes, expandedIds }: ExportModalProps) {
  const [options, setOptions]         = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      await exportOrgChartToPdf('', options, fileName);
      onClose();
    } catch (err) {
      setError('Error al generar el PDF. Inténtalo de nuevo.');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Exportar a PDF</h2>
              <p className="text-xs text-gray-400">{visibleNodes.length} nodos visibles</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">

          <OptionGroup label="Formato de página">
            <div className="flex gap-2">
              {(['A4', 'A3'] as const).map(fmt => (
                <OptionButton key={fmt} active={options.format === fmt} onClick={() => setOptions(o => ({ ...o, format: fmt }))}>
                  <span className="font-bold">{fmt}</span>
                  <span className="text-[10px] opacity-70">{fmt === 'A4' ? '297×210mm' : '420×297mm'}</span>
                </OptionButton>
              ))}
            </div>
          </OptionGroup>

          <OptionGroup label={`Margen: ${options.marginMm}mm`}>
            <input type="range" min={5} max={25} step={1} value={options.marginMm}
              onChange={e => setOptions(o => ({ ...o, marginMm: Number(e.target.value) }))}
              className="w-full accent-blue-600" />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>5mm</span><span>25mm</span>
            </div>
          </OptionGroup>

          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setOptions(o => ({ ...o, includeMetadata: !o.includeMetadata }))}
              className={`w-9 h-5 rounded-full transition-colors ${options.includeMetadata ? 'bg-blue-600' : 'bg-gray-200'} relative`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${options.includeMetadata ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-gray-600">Incluir metadatos en el PDF</span>
          </label>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            💡 El PDF se genera con gráficos vectoriales. El texto nunca se pixela.
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">⚠️ {error}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleExport} disabled={isExporting}
            className="flex-1 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl py-2.5 transition-colors flex items-center justify-center gap-2">
            {isExporting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando...</>
            ) : <>📥 Descargar PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

function OptionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex flex-col items-center py-2 px-3 rounded-xl border-2 transition-all text-xs ${
        active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      }`}>
      {children}
    </button>
  );
}
