// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plugin/contribution.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { PluginDiagnostic } from './diagnostics';
import { error } from './diagnostics';
import type { ExtensionPointDefinition, ImplKind } from './extensionPoint';
import { isApiVersionCompatible, isTrustedOnlyImplKind, isValidExtensionPointId } from './extensionPoint';
import { isValidSemVer } from './semver';

export type ImplRef =
  | { kind: 'code'; key: string }
  | { kind: 'script'; scriptId: string }
  | { kind: 'widget'; spec: Record<string, unknown> }
  | { kind: 'workflow'; workflowId: string };

export interface Contribution {
  point: string;
  id: string;
  apiVersion: string;
  priority?: number;
  when?: string;
  metadata: Record<string, unknown>;
  impl?: ImplRef;
}

export interface QualifiedContribution extends Contribution {
  pluginId: string;
}

export const DEFAULT_CONTRIBUTION_PRIORITY = 0;

const CONTRIBUTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;

export const isValidContributionId = (id: string): boolean =>
  typeof id === 'string' && CONTRIBUTION_ID_PATTERN.test(id);

export const contributionKey = (pluginId: string, contributionId: string): string =>
  `${pluginId}:${contributionId}`;

export const contributionPriority = (contribution: Contribution): number =>
  typeof contribution.priority === 'number' && Number.isFinite(contribution.priority)
    ? contribution.priority
    : DEFAULT_CONTRIBUTION_PRIORITY;

/**
 * Ordem total e estável entre contribuições do mesmo ponto: maior prioridade primeiro e, no
 * empate, pluginId e id em ordem alfabética. Nunca a ordem de carregamento — com centenas de
 * plugins, depender de quem registrou primeiro tornaria o menu (e o resultado de qualquer
 * conflito) não-determinístico entre um boot e outro.
 */
export const compareContributions = (a: QualifiedContribution, b: QualifiedContribution): number => {
  const byPriority = contributionPriority(b) - contributionPriority(a);
  if (byPriority !== 0) return byPriority;
  if (a.pluginId !== b.pluginId) return a.pluginId < b.pluginId ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
};

export const sortContributions = (contributions: QualifiedContribution[]): QualifiedContribution[] =>
  [...contributions].sort(compareContributions);

export const implKindOf = (contribution: Contribution): ImplKind | null => contribution.impl?.kind ?? null;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWellFormedImpl = (impl: ImplRef): boolean => {
  switch (impl.kind) {
    case 'code':     return typeof impl.key === 'string' && impl.key.trim().length > 0;
    case 'script':   return typeof impl.scriptId === 'string' && impl.scriptId.trim().length > 0;
    case 'workflow': return typeof impl.workflowId === 'string' && impl.workflowId.trim().length > 0;
    case 'widget':   return isPlainObject(impl.spec);
    default:         return false;
  }
};

export interface ValidateContributionOptions {
  pluginId: string;
  trusted: boolean;
  point?: ExtensionPointDefinition;
  index?: number;
}

export const validateContribution = (
  contribution: Contribution,
  options: ValidateContributionOptions,
): PluginDiagnostic[] => {
  const { pluginId, trusted, point, index = 0 } = options;
  const diagnostics: PluginDiagnostic[] = [];
  const contributionId = contribution?.id;
  const at = (field: string) => `contributes[${index}].${field}`;
  const push = (
    code: PluginDiagnostic['code'],
    message: string,
    path: string,
    messageParams?: Record<string, string>,
  ) =>
    diagnostics.push(
      error({ code, message, messageParams, pluginId, contributionId, contributionIndex: index, path }),
    );

  if (!isValidContributionId(contributionId)) {
    push('contribution.id.invalid', '@core.marketplace/diagnostic.contribution.id.invalid', at('id'), { id: String(contributionId) });
  }
  if (!isValidExtensionPointId(contribution?.point)) {
    push('contribution.invalid', '@core.marketplace/diagnostic.contribution.point.invalid', at('point'), { point: String(contribution?.point) });
  }
  if (!isValidSemVer(contribution?.apiVersion)) {
    push('contribution.invalid', '@core.marketplace/diagnostic.contribution.api-version.missing', at('apiVersion'), { id: String(contributionId) });
  }
  if (!isPlainObject(contribution?.metadata)) {
    push('contribution.invalid', '@core.marketplace/diagnostic.contribution.metadata.invalid', at('metadata'), { id: String(contributionId) });
  }
  if (contribution?.impl !== undefined && !isWellFormedImpl(contribution.impl)) {
    push('contribution.invalid', '@core.marketplace/diagnostic.contribution.impl.malformed', at('impl'), { id: String(contributionId), kind: String(contribution.impl?.kind) });
  }

  if (!point) {
    push('contribution.point.unknown', '@core.marketplace/diagnostic.contribution.point.unknown', at('point'), { point: String(contribution?.point), id: String(contributionId) });
    return diagnostics;
  }

  if (!isApiVersionCompatible(contribution?.apiVersion, point.apiVersion)) {
    push('contribution.point.incompatible', '@core.marketplace/diagnostic.contribution.point.incompatible', at('apiVersion'), { id: String(contributionId), expected: String(contribution?.apiVersion), point: point.id, actual: point.apiVersion });
  }

  const kind = implKindOf(contribution);
  if (point.implRequired && kind === null) {
    push('contribution.impl.missing', '@core.marketplace/diagnostic.contribution.impl.missing', at('impl'), { point: point.id, id: String(contributionId) });
  }
  if (kind !== null) {
    if (!point.allowedImplKinds.includes(kind)) {
      push('contribution.impl.forbidden', '@core.marketplace/diagnostic.contribution.impl.kind-forbidden', at('impl.kind'), { point: point.id, kind, allowed: point.allowedImplKinds.join(', ') });
    } else if (isTrustedOnlyImplKind(kind) && !trusted) {
      push('contribution.impl.forbidden', '@core.marketplace/diagnostic.contribution.impl.trusted-only', at('impl.kind'), { kind });
    }
  }

  return diagnostics;
};

export const findDuplicateContributions = (
  contributions: Contribution[],
  pluginId: string,
): PluginDiagnostic[] => {
  const seen = new Set<string>();
  return contributions.flatMap((contribution, index) => {
    const key = `${contribution?.point}::${contribution?.id}`;
    if (seen.has(key)) {
      return [
        error({
          code: 'contribution.duplicate',
          message: '@core.marketplace/diagnostic.contribution.duplicate',
          messageParams: { id: String(contribution?.id), point: String(contribution?.point) },
          pluginId,
          contributionId: contribution?.id,
          contributionIndex: index,
          path: `contributes[${index}].id`,
        }),
      ];
    }
    seen.add(key);
    return [];
  });
};
