// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/kernel/ExtensionPointRegistry.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { ExtensionPointDefinition } from '../domain/schema/plugin/extensionPoint';
import type { PluginDiagnostic } from '../domain/schema/plugin/diagnostics';
import { error } from '../domain/schema/plugin/diagnostics';

export interface ExtensionPointRegistry {
  register(point: ExtensionPointDefinition): PluginDiagnostic[];
  get(id: string): ExtensionPointDefinition | undefined;
  has(id: string): boolean;
  list(): ExtensionPointDefinition[];
  snapshot(): Map<string, ExtensionPointDefinition>;
  removeByPlugin(pluginId: string): number;
  clear(): void;
}

export const createExtensionPointRegistry = (): ExtensionPointRegistry => {
  const points = new Map<string, ExtensionPointDefinition>();

  return {
    register(point) {
      const existing = points.get(point.id);
      if (existing && existing.ownerPluginId !== point.ownerPluginId) {
        return [
          error({
            code: 'extensionPoint.duplicate',
            message: `O ponto de extensão "${point.id}" já pertence ao plugin "${existing.ownerPluginId}" e não pode ser redeclarado por "${point.ownerPluginId}".`,
            pluginId: point.ownerPluginId,
            path: 'extensionPoints',
          }),
        ];
      }
      points.set(point.id, point);
      return [];
    },

    get: (id) => points.get(id),
    has: (id) => points.has(id),
    list: () => Array.from(points.values()).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    snapshot: () => new Map(points),

    removeByPlugin(pluginId) {
      let removed = 0;
      for (const [id, point] of points) {
        if (point.ownerPluginId === pluginId) {
          points.delete(id);
          removed += 1;
        }
      }
      return removed;
    },

    clear: () => points.clear(),
  };
};
