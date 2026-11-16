// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plugin/defaultExtensions.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { LocalizedMessage } from '../i18n/localizedMessage';
import type { PluginDependency } from './pluginManifest';
import { KERNEL_PLUGIN_PREFIX } from './publicationProof';

/**
 * EXTENSÕES PADRÃO — as que todo escritório novo recebe instaladas. Uma instalação dedicada a um ramo
 * (um escritório de advocacia, uma clínica) não deveria obrigar cada pessoa que entra a abrir a tela de
 * Extensões e instalar, uma a uma, as mesmas extensões que todos usam.
 *
 * A marca aponta o ID, nunca uma versão: quem é instalado é a versão ATUAL do catálogo. Isso só é seguro
 * porque toda versão do catálogo foi instalada por completo antes de ir para lá (`publicationProof`) — a
 * garantia está na publicação, e por isso a marca não precisa guardar cópia de pacote nenhum.
 *
 * Mora em `system/registration.defaultExtensions`, ao lado das outras decisões do `SYSTEM` sobre quem
 * chega: é o que o escritório novo GANHA.
 */

/**
 * O que o escritório novo ainda tem a instalar — `tenants/{id}/extension_onboarding/defaults`. A lista
 * é fixada na CRIAÇÃO do escritório: marcar ou desmarcar depois não alcança escritório que já existe.
 */
export const EXTENSION_ONBOARDING_COLLECTION = 'extension_onboarding';
export const DEFAULT_EXTENSIONS_ONBOARDING_DOC = 'defaults';

export interface DefaultExtensionsOnboarding {
  /** Na ordem de instalação: dependência antes de quem depende dela. */
  pending: string[];
  /**
   * As que não foram instaladas — falharam e quem instalava seguiu sem elas, ou saíram do catálogo depois
   * de o escritório nascer. Ficam como registro; instalá-las depois é pela tela de Extensões, como qualquer outra.
   */
  failed: string[];
}

export const defaultExtensionsOnboardingOf = (data: unknown): DefaultExtensionsOnboarding => {
  const fields = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  const ids = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  return { pending: ids(fields.pending), failed: ids(fields.failed) };
};

/** Um teto para a lista: cada uma é uma instalação que a pessoa espera, na primeira entrada. */
export const DEFAULT_EXTENSIONS_MAX = 30;

/** Uma entrada do catálogo, na parte que a régua lê. */
export interface DefaultCatalogSide {
  id: string;
  status: string;
  /** A versão atual tem a prova de instalação (`proof`). A entrada anterior à regra não tem. */
  proven: boolean;
  dependencies?: Record<string, PluginDependency>;
}

const issue = (message: string, messageParams?: Record<string, string>): LocalizedMessage =>
  messageParams ? { message, messageParams } : { message };

/**
 * Por que a extensão ainda não pode virar padrão — vazio quando pode.
 *
 * A dependência é a parte que não é óbvia: o escritório novo terá SÓ as padrão, então cada dependência
 * precisa vir junto — do kernel, embutida na aplicação (`isBuiltin`, que só o navegador sabe responder),
 * ou padrão ela também.
 */
export const defaultMarkIssues = (
  id: string,
  catalog: readonly DefaultCatalogSide[],
  defaults: readonly string[],
  isBuiltin: (pluginId: string) => boolean,
): LocalizedMessage[] => {
  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry || entry.status !== 'approved') return [issue('@core.marketplace/default.not-approved')];
  if (!entry.proven) return [issue('@core.marketplace/default.unproven')];
  if (defaults.length >= DEFAULT_EXTENSIONS_MAX) {
    return [issue('@core.marketplace/default.too-many', { max: String(DEFAULT_EXTENSIONS_MAX) })];
  }
  return Object.keys(entry.dependencies ?? {})
    .filter((dependency) => !dependency.startsWith(KERNEL_PLUGIN_PREFIX)
      && !isBuiltin(dependency)
      && !defaults.includes(dependency))
    .map((dependency) => issue('@core.marketplace/default.dependency-not-default', { dependency }));
};

/**
 * Por que a extensão não pode deixar de ser padrão — outra padrão depende dela, e o escritório novo
 * receberia a dependente sem a dependência.
 */
export const defaultUnmarkIssues = (
  id: string,
  catalog: readonly DefaultCatalogSide[],
  defaults: readonly string[],
): LocalizedMessage[] => defaults
  .filter((other) => other !== id)
  .filter((other) => catalog.find((entry) => entry.id === other)?.dependencies?.[id] !== undefined)
  .map((dependent) => issue('@core.marketplace/default.required-by', { dependent }));

/**
 * O que o escritório novo de fato instala, e em que ordem — decidido no SERVIDOR, na criação dele.
 *
 * A lista marcada é a intenção do `SYSTEM`; esta é a conferência: só entra o que está no catálogo,
 * aprovado e com a prova de instalação da versão atual. A ordem põe cada dependência ANTES de quem
 * depende dela, porque a instalação recusa a extensão cuja dependência ainda não está lá. Dependência
 * embutida ou do kernel não entra na lista — quem instala a resolve.
 */
export const defaultInstallPlan = (
  defaults: readonly string[],
  catalog: readonly DefaultCatalogSide[],
): string[] => {
  const entryOf = (id: string) => catalog.find((entry) => entry.id === id);
  const eligible = defaults.filter((id) => {
    const entry = entryOf(id);
    return entry !== undefined && entry.status === 'approved' && entry.proven;
  });
  const inPlan = new Set(eligible);
  const ordered: string[] = [];
  const placed = new Set<string>();
  // Um ciclo de dependências não trava a ordem: quem está sendo visitado não é revisitado, e a
  // instalação recusa o que de fato não resolve — com o "continuar sem" de quem instala.
  const visiting = new Set<string>();
  const place = (id: string): void => {
    if (placed.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const dependency of Object.keys(entryOf(id)?.dependencies ?? {})) {
      if (inPlan.has(dependency)) place(dependency);
    }
    visiting.delete(id);
    placed.add(id);
    ordered.push(id);
  };
  eligible.forEach(place);
  return ordered;
};
