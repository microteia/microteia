// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/kernel/ContributionRegistry.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { QualifiedContribution } from '../domain/schema/plugin/contribution';
import { contributionKey, sortContributions } from '../domain/schema/plugin/contribution';

export interface ContributionRegistry {
  register(contribution: QualifiedContribution): void;
  query(point: string): QualifiedContribution[];
  queryOne(point: string): QualifiedContribution | undefined;
  find(pluginId: string, contributionId: string): QualifiedContribution | undefined;
  byPlugin(pluginId: string): QualifiedContribution[];
  points(): string[];
  all(): QualifiedContribution[];
  size(): number;
  removeByPlugin(pluginId: string): number;
  clear(): void;
}

/**
 * Índice de contribuições por ponto de extensão. A consulta é memoizada porque com centenas de
 * plugins instalados um `query('ui.nav')` acontece a cada render da barra lateral — ordenar a
 * lista toda vez seria o gargalo mais óbvio da plataforma. O cache cai inteiro a cada mutação:
 * carga e descarga são raras, leitura é quente.
 */
export const createContributionRegistry = (): ContributionRegistry => {
  const byPoint = new Map<string, QualifiedContribution[]>();
  const byKey = new Map<string, QualifiedContribution>();
  const sortedCache = new Map<string, QualifiedContribution[]>();

  const invalidate = () => sortedCache.clear();

  const registry: ContributionRegistry = {
    register(contribution) {
      const bucket = byPoint.get(contribution.point);
      if (bucket) bucket.push(contribution);
      else byPoint.set(contribution.point, [contribution]);
      byKey.set(contributionKey(contribution.pluginId, contribution.id), contribution);
      invalidate();
    },

    query(point) {
      const cached = sortedCache.get(point);
      if (cached) return cached;
      const sorted = sortContributions(byPoint.get(point) ?? []);
      sortedCache.set(point, sorted);
      return sorted;
    },

    queryOne: (point) => registry.query(point)[0],

    find: (pluginId, contributionId) => byKey.get(contributionKey(pluginId, contributionId)),

    byPlugin: (pluginId) =>
      sortContributions(
        Array.from(byPoint.values()).flat().filter((contribution) => contribution.pluginId === pluginId),
      ),

    points: () => Array.from(byPoint.keys()).sort(),

    all: () => sortContributions(Array.from(byPoint.values()).flat()),

    size: () => byKey.size,

    removeByPlugin(pluginId) {
      let removed = 0;
      for (const [point, bucket] of byPoint) {
        const kept = bucket.filter((contribution) => contribution.pluginId !== pluginId);
        removed += bucket.length - kept.length;
        if (kept.length === 0) byPoint.delete(point);
        else byPoint.set(point, kept);
      }
      for (const [key, contribution] of byKey) {
        if (contribution.pluginId === pluginId) byKey.delete(key);
      }
      if (removed > 0) invalidate();
      return removed;
    },

    clear() {
      byPoint.clear();
      byKey.clear();
      invalidate();
    },
  };

  return registry;
};
