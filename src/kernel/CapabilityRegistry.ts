import type {
  CapabilityProvision,
  CapabilityRequirement,
  ResolvedProvider,
} from '../domain/schema/plugin/capability';
import { selectProvider } from '../domain/schema/plugin/capability';

export interface CapabilityRegistry {
  registerProvider(pluginId: string, provision: CapabilityProvision): void;
  providersOf(capabilityId: string): ResolvedProvider[];
  resolve(requirement: CapabilityRequirement, boundPluginId?: string): ResolvedProvider | null;
  capabilities(): string[];
  list(): ResolvedProvider[];
  removeByPlugin(pluginId: string): number;
  clear(): void;
}

const byPluginId = (a: ResolvedProvider, b: ResolvedProvider): number =>
  a.pluginId < b.pluginId ? -1 : a.pluginId > b.pluginId ? 1 : 0;

/**
 * Vários plugins podem fornecer a mesma Capability (WhatsApp, e-mail, IA, pagamentos). Quem
 * consome declara `{ capability, range }` e nunca conhece o provedor — a escolha é do
 * `selectProvider`, com a vinculação explícita do escritório vencendo a prioridade.
 */
export const createCapabilityRegistry = (): CapabilityRegistry => {
  const providers = new Map<string, ResolvedProvider[]>();

  return {
    registerProvider(pluginId, provision) {
      const bucket = providers.get(provision.capability);
      const entry: ResolvedProvider = { pluginId, provision };
      if (bucket) bucket.push(entry);
      else providers.set(provision.capability, [entry]);
    },

    providersOf: (capabilityId) => [...(providers.get(capabilityId) ?? [])].sort(byPluginId),

    resolve: (requirement, boundPluginId) =>
      selectProvider(providers.get(requirement.capability) ?? [], requirement, boundPluginId),

    capabilities: () => Array.from(providers.keys()).sort(),

    list: () => Array.from(providers.values()).flat().sort(byPluginId),

    removeByPlugin(pluginId) {
      let removed = 0;
      for (const [capabilityId, bucket] of providers) {
        const kept = bucket.filter((entry) => entry.pluginId !== pluginId);
        removed += bucket.length - kept.length;
        if (kept.length === 0) providers.delete(capabilityId);
        else providers.set(capabilityId, kept);
      }
      return removed;
    },

    clear: () => providers.clear(),
  };
};
