'use client';

import { useState, useCallback } from 'react';
import { OrgChartCanvas } from '@/components/orgchart/OrgChartCanvas';
import { parseWorkdayToTree } from '@/lib/parser/orgchart.parser';
import type { ParseResult, WorkdayWorker } from '@/types/orgchart.types';

export default function Home() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [fileName, setFileName]       = useState<string>('organigrama');

  const processJson = useCallback((json: WorkdayWorker[], name: string) => {
    try {
      setParseResult(parseWorkdayToTree(json));
      setFileName(name.replace('.json', ''));
      setError(null);
    } catch {
      setError('Error al procesar el JSON.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as WorkdayWorker[];
        processJson(json, file.name);
      } catch {
        setError('El archivo no tiene un formato JSON válido.');
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  }, [processJson]);

  const handleLoadSample = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch('/sample-data.json');
      const json = await res.json() as WorkdayWorker[];
      processJson(json, 'sample-data');
    } catch {
      setError('No se pudo cargar el archivo de ejemplo.');
      setIsLoading(false);
    }
  }, [processJson]);

  if (!parseResult) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🏢</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Organigrama Interactivo</h1>
            <p className="text-gray-500 text-sm">Visualiza y exporta organigramas desde reportes Workday RaaS</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col gap-4">
            <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-blue-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group">
              <span className="text-3xl group-hover:scale-110 transition-transform">📂</span>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Subir JSON de Workday</p>
                <p className="text-xs text-gray-400 mt-1">Formato RaaS · Array de workers</p>
              </div>
              <input type="file" accept=".json" onChange={handleFile} className="hidden" />
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">o</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <button onClick={handleLoadSample}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 px-4 rounded-xl transition-colors">
              <span>▶</span> Cargar datos de ejemplo
            </button>
            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Procesando...
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">⚠️ {error}</div>
            )}
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Los datos se procesan localmente · No se envía nada a ningún servidor
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-screen h-screen flex flex-col bg-gray-50">
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏢</span>
          <span className="font-bold text-gray-800 text-sm">Organigrama</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-gray-400 truncate">{fileName}</span>
          {parseResult.warnings.length > 0 && (
            <span className="text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-full px-2 py-0.5">
              ⚠️ {parseResult.warnings.length} avisos
            </span>
          )}
        </div>
        <label className="cursor-pointer text-[11px] font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
          📂 Cargar otro
          <input type="file" accept=".json" onChange={handleFile} className="hidden" />
        </label>
      </header>
      <div className="flex-1 overflow-hidden">
        <OrgChartCanvas parseResult={parseResult} fileName={fileName} />
      </div>
    </main>
  );
}
