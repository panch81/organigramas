'use client';

import { useState, useCallback, useMemo } from 'react';
import type { OrgChartNode, ParseResult, WorkdayLevel } from '@/types/orgchart.types';

export interface OrgChartFilters {
  maxOrgLevel: number | null;       // null = sin límite
  personLevels: Set<WorkdayLevel>;  // vacío = todos
}

export function useOrgChart(parseResult: ParseResult | null) {

  // ── Estado de expansión ──────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (!parseResult?.root) return new Set();
    const ids = new Set<string>();
    const queue = [parseResult.root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.depth < 3) { ids.add(node.id); queue.push(...node.children); }
    }
    return ids;
  });

  // ── Estado de filtros ────────────────────────────────────────
  const [filters, setFilters] = useState<OrgChartFilters>({
    maxOrgLevel:  null,
    personLevels: new Set(),
  });

  // ── Niveles org máximos disponibles en el dataset ────────────
  const maxOrgDepth = useMemo(() => {
    return parseResult?.stats.maxDepth ?? 0;
  }, [parseResult]);

  // ── Niveles de persona disponibles en el dataset ─────────────
  const availablePersonLevels = useMemo((): WorkdayLevel[] => {
    if (!parseResult?.nodeMap) return [];
    const levels = new Set<WorkdayLevel>();
    for (const [, node] of parseResult.nodeMap.entries()) levels.add(node.level);
    // Orden lógico
    const ORDER: WorkdayLevel[] = ['0','1','2','3','4','5','6','7','8','DIRECTOR','CONTINGENT'];
    return ORDER.filter(l => levels.has(l));
  }, [parseResult]);

  // ── Acciones de expansión ────────────────────────────────────
  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!parseResult?.nodeMap) return;
    setExpandedIds(new Set(parseResult.nodeMap.keys()));
  }, [parseResult]);

  const collapseAll = useCallback(() => {
    if (!parseResult?.root) return;
    setExpandedIds(new Set([parseResult.root.id]));
  }, [parseResult]);

  // ── Filtro por Nivel Org ─────────────────────────────────────
  const setMaxOrgLevel = useCallback((level: number | null) => {
    setFilters(prev => ({ ...prev, maxOrgLevel: level }));
    // Expandir automáticamente hasta ese nivel
    if (level !== null && parseResult?.root) {
      const ids = new Set<string>();
      const queue = [parseResult.root];
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node.depth <= level) { ids.add(node.id); queue.push(...node.children); }
      }
      setExpandedIds(ids);
    } else if (level === null && parseResult?.nodeMap) {
      setExpandedIds(new Set(parseResult.nodeMap.keys()));
    }
  }, [parseResult]);

  // ── Filtro por Nivel de Persona ──────────────────────────────
  const togglePersonLevel = useCallback((level: WorkdayLevel) => {
    setFilters(prev => {
      const next = new Set(prev.personLevels);
      if (next.has(level)) next.delete(level); else next.add(level);
      return { ...prev, personLevels: next };
    });
  }, []);

  const clearPersonLevels = useCallback(() => {
    setFilters(prev => ({ ...prev, personLevels: new Set() }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({ maxOrgLevel: null, personLevels: new Set() });
    if (parseResult?.nodeMap) setExpandedIds(new Set(parseResult.nodeMap.keys()));
  }, [parseResult]);

  // ── Nodos visibles aplicando ambos filtros ───────────────────
  const visibleNodes = useMemo((): OrgChartNode[] => {
    if (!parseResult?.root) return [];

    const hasPersonFilter = filters.personLevels.size > 0;
    const hasOrgFilter    = filters.maxOrgLevel !== null;

    const result: OrgChartNode[] = [];

    function traverse(node: OrgChartNode) {
      // Filtro Nivel Org: no mostrar nodos más profundos que maxOrgLevel
      if (hasOrgFilter && node.depth > filters.maxOrgLevel!) return;

      // Filtro Nivel Persona: si hay filtro activo y el nodo no coincide, ocultarlo
      // PERO siempre mostramos nodos que tienen hijos visibles (para mantener la cadena)
      const passesPersonFilter = !hasPersonFilter || filters.personLevels.has(node.level);

      // Un nodo se muestra si pasa el filtro de persona, O si es ancestro de alguien que pasa
      // (calculado más abajo via el flag childrenVisible)
      if (passesPersonFilter) result.push(node);

      // Continuar hacia los hijos si el nodo está expandido
      if (expandedIds.has(node.id)) {
        for (const child of node.children) traverse(child);
      }
    }

    traverse(parseResult.root);
    return result;
  }, [parseResult, expandedIds, filters]);

  // ── Estadísticas de filtros aplicados ────────────────────────
  const filterStats = useMemo(() => ({
    showing:    visibleNodes.length,
    total:      parseResult?.stats.totalWorkers ?? 0,
    hasFilters: filters.personLevels.size > 0 || filters.maxOrgLevel !== null,
  }), [visibleNodes, parseResult, filters]);

  return {
    // Expansión
    expandedIds, toggleExpand, expandAll, collapseAll,
    // Filtros
    filters, maxOrgDepth, availablePersonLevels,
    setMaxOrgLevel, togglePersonLevel, clearPersonLevels, clearAllFilters,
    // Resultado
    visibleNodes, filterStats,
  };
}
