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
  const push = (code: PluginDiagnostic['code'], message: string, path: string) =>
    diagnostics.push(error({ code, message, pluginId, contributionId, path }));

  if (!isValidContributionId(contributionId)) {
    push('contribution.id.invalid', `Id de contribuição "${contributionId}" é inválido. Use letras minúsculas, números, "-" e ".".`, at('id'));
  }
  if (!isValidExtensionPointId(contribution?.point)) {
    push('contribution.invalid', `Ponto de extensão "${contribution?.point}" é inválido.`, at('point'));
  }
  if (!isValidSemVer(contribution?.apiVersion)) {
    push('contribution.invalid', `A contribuição "${contributionId}" precisa declarar apiVersion em semver.`, at('apiVersion'));
  }
  if (!isPlainObject(contribution?.metadata)) {
    push('contribution.invalid', `A metadata da contribuição "${contributionId}" precisa ser um objeto.`, at('metadata'));
  }
  if (contribution?.impl !== undefined && !isWellFormedImpl(contribution.impl)) {
    push('contribution.invalid', `A implementação da contribuição "${contributionId}" está malformada para o tipo "${contribution.impl?.kind}".`, at('impl'));
  }

  if (!point) {
    push('contribution.point.unknown', `O ponto de extensão "${contribution?.point}" não está registrado. A contribuição "${contributionId}" foi ignorada.`, at('point'));
    return diagnostics;
  }

  if (!isApiVersionCompatible(contribution?.apiVersion, point.apiVersion)) {
    push('contribution.point.incompatible', `A contribuição "${contributionId}" espera o contrato ${contribution?.apiVersion} de "${point.id}", que está na versão ${point.apiVersion}.`, at('apiVersion'));
  }

  const kind = implKindOf(contribution);
  if (point.implRequired && kind === null) {
    push('contribution.impl.missing', `O ponto "${point.id}" exige uma implementação e a contribuição "${contributionId}" não declarou nenhuma.`, at('impl'));
  }
  if (kind !== null) {
    if (!point.allowedImplKinds.includes(kind)) {
      push('contribution.impl.forbidden', `O ponto "${point.id}" não aceita implementação do tipo "${kind}". Aceita: ${point.allowedImplKinds.join(', ') || 'nenhuma'}.`, at('impl.kind'));
    } else if (isTrustedOnlyImplKind(kind) && !trusted) {
      push('contribution.impl.forbidden', `Implementação do tipo "${kind}" é exclusiva de plugins internos. Use "script", "widget" ou "workflow".`, at('impl.kind'));
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
          message: `A contribuição "${contribution?.id}" já foi declarada para o ponto "${contribution?.point}" neste plugin.`,
          pluginId,
          contributionId: contribution?.id,
          path: `contributes[${index}].id`,
        }),
      ];
    }
    seen.add(key);
    return [];
  });
};
