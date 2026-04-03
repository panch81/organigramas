'use client';

import { useState, useCallback } from 'react';
import { OrgChartCanvas }    from '@/components/orgchart/OrgChartCanvas';
import { OrgDiagramCanvas }  from '@/components/orgchart/OrgDiagramCanvas';
import { parseWorkdayToTree } from '@/lib/parser/orgchart.parser';
import { parseOrgDiagram }    from '@/lib/parser/orgdiagram.parser';
import type { ParseResult, WorkdayWorker, OrgParseResult, OrgDiagramJson } from '@/types/orgchart.types';

type DiagramMode = 'personas' | 'organizaciones';

function isOrgDiagramJson(data: unknown): data is OrgDiagramJson {
  return (
    typeof data === 'object' && data !== null &&
    'organizations' in data && 'workers' in data &&
    Array.isArray((data as OrgDiagramJson).organizations)
  );
}

function ModeToggle({ mode, onChange, hasPersonas, hasOrgs }: {
  mode: DiagramMode; onChange: (m: DiagramMode) => void;
  hasPersonas: boolean; hasOrgs: boolean;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      <button onClick={() => onChange('personas')} disabled={!hasPersonas}
        className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all ${mode === 'personas' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
        👤 Personas
      </button>
      <button onClick={() => onChange('organizaciones')} disabled={!hasOrgs}
        className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all ${mode === 'organizaciones' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
        🏢 Organizaciones
      </button>
    </div>
  );
}

export default function Home() {
  const [mode,           setMode]           = useState<DiagramMode>('personas');
  const [parseResult,    setParseResult]    = useState<ParseResult | null>(null);
  const [orgParseResult, setOrgParseResult] = useState<OrgParseResult | null>(null);
  const [isLoading,      setIsLoading]      = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [fileName,       setFileName]       = useState<string>('organigrama');

  const parseSingle = useCallback((raw: unknown): 'personas' | 'organizaciones' | null => {
    if (isOrgDiagramJson(raw)) {
      setOrgParseResult(parseOrgDiagram(raw));
      return 'organizaciones';
    } else if (Array.isArray(raw)) {
      setParseResult(parseWorkdayToTree(raw as WorkdayWorker[]));
      return 'personas';
    }
    return null;
  }, []);

  const handleFiles = useCallback((files: FileList) => {
    if (files.length === 0) return;
    setIsLoading(true);
    setError(null);

    const reads = Array.from(files).map(file =>
      new Promise<{ raw: unknown; name: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try { resolve({ raw: JSON.parse(ev.target?.result as string), name: file.name }); }
          catch { reject(new Error(`"${file.name}" no es JSON válido.`)); }
        };
        reader.readAsText(file);
      })
    );

    Promise.all(reads)
      .then((results) => {
        let lastMode: DiagramMode = 'personas';
        const names: string[] = [];
        for (const { raw, name } of results) {
          const detected = parseSingle(raw);
          if (!detected) { setError(`"${name}": formato no reconocido.`); setIsLoading(false); return; }
          lastMode = detected;
          names.push(name.replace('.json', ''));
        }
        setFileName(names.join(' + '));
        setMode(lastMode);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [parseSingle]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const handleLoadSample = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch('/sample-data.json');
      const json = await res.json();
      parseSingle(json);
      setFileName('sample-data');
      setMode('personas');
    } catch {
      setError('No se pudo cargar el archivo de ejemplo.');
    } finally {
      setIsLoading(false);
    }
  }, [parseSingle]);

  const hasAnyData  = parseResult !== null || orgParseResult !== null;
  const hasPersonas = parseResult !== null;
  const hasOrgs     = orgParseResult !== null;

  if (!hasAnyData) {
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
                <p className="text-xs text-gray-400 mt-1">Selecciona 1 o 2 ficheros a la vez</p>
                <p className="text-[10px] text-gray-300 mt-0.5">Array de workers · {'{organizations, workers}'}</p>
              </div>
              <input type="file" accept=".json" multiple onChange={handleFileInput} className="hidden" />
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
          <div className="mt-4 bg-white/70 rounded-xl border border-gray-100 p-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Formatos soportados</p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-[10px] mt-0.5">👤</span>
                <p className="text-[10px] text-gray-500"><span className="font-semibold">Personas</span> — Array de workers con worker_id, manager_id…</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] mt-0.5">🏢</span>
                <p className="text-[10px] text-gray-500"><span className="font-semibold">Organizaciones</span> — {'{ organizations: [...], workers: [...] }'}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] mt-0.5">✨</span>
                <p className="text-[10px] text-gray-500"><span className="font-semibold">Ambos</span> — Selecciona los 2 ficheros para activar el toggle</p>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Los datos se procesan localmente · No se envía nada a ningún servidor
          </p>
        </div>
      </main>
    );
  }

  const warnings =
    mode === 'personas'
      ? (parseResult?.warnings ?? [])
      : (orgParseResult?.warnings.map(m => ({ message: m })) ?? []);

  return (
    <main className="w-screen h-screen flex flex-col bg-gray-50">
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xl">🏢</span>
          <span className="font-bold text-gray-800 text-sm">Organigrama</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400 truncate max-w-[200px]">{fileName}</span>
          {warnings.length > 0 && (
            <span className="text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-full px-2 py-0.5 flex-shrink-0">
              ⚠️ {warnings.length} avisos
            </span>
          )}
        </div>
        <div className="flex-1" />
        <ModeToggle mode={mode} onChange={setMode} hasPersonas={hasPersonas} hasOrgs={hasOrgs} />
        <label className="cursor-pointer text-[11px] font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors flex-shrink-0">
          📂 Cargar
          <input type="file" accept=".json" multiple onChange={handleFileInput} className="hidden" />
        </label>
      </header>
      <div className="flex-1 overflow-hidden">
        {mode === 'personas' && parseResult && (
          <OrgChartCanvas parseResult={parseResult} fileName={fileName} />
        )}
        {mode === 'organizaciones' && orgParseResult && (
          <OrgDiagramCanvas orgParseResult={orgParseResult} />
        )}
      </div>
    </main>
  );
}
