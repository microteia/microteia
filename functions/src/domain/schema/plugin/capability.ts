// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plugin/capability.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { PluginDiagnostic } from './diagnostics';
import { error } from './diagnostics';
import { isValidRange, isValidSemVer, satisfiesRange } from './semver';

const CAPABILITY_ID_PATTERN = /^[a-z0-9]+(\.[a-z0-9][a-z0-9-]*)+$/;

export const isValidCapabilityId = (id: string): boolean =>
  typeof id === 'string' && CAPABILITY_ID_PATTERN.test(id);

export interface CapabilityProvision {
  capability: string;
  version: string;
  priority?: number;
  label?: string;
  configFields?: string[];
}

export interface CapabilityRequirement {
  capability: string;
  range: string;
  optional?: boolean;
}

export const DEFAULT_CAPABILITY_PRIORITY = 0;

export const provisionPriority = (provision: CapabilityProvision): number =>
  typeof provision.priority === 'number' && Number.isFinite(provision.priority)
    ? provision.priority
    : DEFAULT_CAPABILITY_PRIORITY;

export interface ResolvedProvider {
  pluginId: string;
  provision: CapabilityProvision;
}

/**
 * Escolhe o provedor de uma capability. A vinculação explícita do escritório vence sempre; sem
 * ela, decide a maior `priority` e, no empate, o `pluginId` em ordem alfabética — nunca a ordem
 * de registro, que dependeria de quem carregou primeiro.
 */
export const selectProvider = (
  candidates: ResolvedProvider[],
  requirement: CapabilityRequirement,
  boundPluginId?: string,
): ResolvedProvider | null => {
  const compatible = candidates.filter(
    (candidate) =>
      candidate.provision.capability === requirement.capability &&
      satisfiesRange(candidate.provision.version, requirement.range),
  );
  if (compatible.length === 0) return null;

  if (boundPluginId) {
    return compatible.find((candidate) => candidate.pluginId === boundPluginId) ?? null;
  }

  return compatible.reduce((best, candidate) => {
    const byPriority = provisionPriority(candidate.provision) - provisionPriority(best.provision);
    if (byPriority !== 0) return byPriority > 0 ? candidate : best;
    return candidate.pluginId < best.pluginId ? candidate : best;
  });
};

export const validateProvisions = (
  provisions: CapabilityProvision[] | undefined,
  pluginId: string,
): PluginDiagnostic[] =>
  (provisions ?? []).flatMap((provision, index) => {
    const diagnostics: PluginDiagnostic[] = [];
    if (!isValidCapabilityId(provision?.capability)) {
      diagnostics.push(
        error({
          code: 'capability.id.invalid',
          message: `Capability "${provision?.capability}" é inválida. Use o formato "grupo.nome" (ex.: "ai.completion").`,
          pluginId,
          path: `provides[${index}].capability`,
        }),
      );
    }
    if (!isValidSemVer(provision?.version)) {
      diagnostics.push(
        error({
          code: 'manifest.version.invalid',
          message: `A versão "${provision?.version}" da capability "${provision?.capability}" não é um semver válido.`,
          pluginId,
          path: `provides[${index}].version`,
        }),
      );
    }
    return diagnostics;
  });

export const validateRequirements = (
  requirements: CapabilityRequirement[] | undefined,
  pluginId: string,
): PluginDiagnostic[] =>
  (requirements ?? []).flatMap((requirement, index) => {
    const diagnostics: PluginDiagnostic[] = [];
    if (!isValidCapabilityId(requirement?.capability)) {
      diagnostics.push(
        error({
          code: 'capability.id.invalid',
          message: `Capability "${requirement?.capability}" é inválida. Use o formato "grupo.nome" (ex.: "ai.completion").`,
          pluginId,
          path: `consumes[${index}].capability`,
        }),
      );
    }
    if (!isValidRange(requirement?.range)) {
      diagnostics.push(
        error({
          code: 'capability.range.invalid',
          message: `A faixa "${requirement?.range}" da capability "${requirement?.capability}" é inválida.`,
          pluginId,
          path: `consumes[${index}].range`,
        }),
      );
    }
    return diagnostics;
  });
