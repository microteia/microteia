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
  /**
   * Quando o DONO entrou pela primeira vez para instalar a lista (#28) — epoch em ms. Só o servidor o
   * grava (`startDefaultExtensionsOnboarding`), uma vez. É o começo da janela em que o teto do plano não
   * vale para o dono: ver `onboardingPlanWindowEnd`. Ausente enquanto ninguém começou.
   */
  startedAt?: number;
}

/**
 * Quanto dura, no máximo, a janela de instalação (#28).
 *
 * A janela existe porque a instalação das padrão roda com a sessão do dono e grava telas, automações,
 * ações e relatórios — o que o plano padrão pode justamente negar. O normal é ela fechar em minutos,
 * quando a lista esvazia. O prazo é o teto para o caso em que ela não esvazia: a instalação abandonada
 * no meio, ou alguém segurando a lista cheia por chamada direta à API para ficar sem o limite do plano.
 */
export const PLAN_ONBOARDING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Até quando (epoch em ms) o teto do plano fica suspenso para o dono, ou `null` se não está.
 *
 * Três condições, e as três valem juntas: há extensão pendente, o dono já começou (`startedAt`, gravado
 * pelo servidor) e o prazo não passou. Contar do COMEÇO, e não da criação do escritório, é o que cobre o
 * escritório que o `SYSTEM` abre em nome de alguém que só entra dias depois. Sem `startedAt` não há
 * janela: se a ausência abrisse a janela, bastaria nunca chamar o começo para ficar sem limite.
 */
export const onboardingPlanWindowEnd = (
  onboarding: DefaultExtensionsOnboarding | null,
  now: number,
): number | null => {
  const end = onboardingPlanWindowDeadline(onboarding);
  return end !== null && now < end ? end : null;
};

/**
 * O prazo da janela, sem perguntar se ele já passou — para quem não pode ler a hora onde calcula (o
 * render do React) e agenda a expiração à parte.
 */
export const onboardingPlanWindowDeadline = (onboarding: DefaultExtensionsOnboarding | null): number | null =>
  !onboarding || onboarding.pending.length === 0 || onboarding.startedAt === undefined
    ? null
    : onboarding.startedAt + PLAN_ONBOARDING_WINDOW_MS;

/** `Timestamp` do Firestore (cliente ou Admin SDK) ou número — o que vier do documento. */
const millisOf = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const toMillis = (value as { toMillis?: unknown } | null)?.toMillis;
  return typeof toMillis === 'function' ? (toMillis as () => number).call(value) : undefined;
};

export const defaultExtensionsOnboardingOf = (data: unknown): DefaultExtensionsOnboarding => {
  const fields = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  const ids = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  const startedAt = millisOf(fields.startedAt);
  return { pending: ids(fields.pending), failed: ids(fields.failed), ...(startedAt === undefined ? {} : { startedAt }) };
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
 *
 * A EMBUTIDA também pode ser padrão, e só o teto a segura: viajar no bundle não é estar instalada no
 * escritório — o pacote de tradução é o caso que motivou, porque sem ele o escritório que nasce com
 * idioma escolhido (`registration.defaultLocale`) tem os dados no idioma e a interface no idioma-fonte.
 * A garantia que a prova dá ao catálogo, a embutida já tem: ela é da mesma versão do kernel que a instala.
 */
export const defaultMarkIssues = (
  id: string,
  catalog: readonly DefaultCatalogSide[],
  defaults: readonly string[],
  isBuiltin: (pluginId: string) => boolean,
): LocalizedMessage[] => {
  const tooMany = defaults.length >= DEFAULT_EXTENSIONS_MAX
    ? [issue('@core.marketplace/default.too-many', { max: String(DEFAULT_EXTENSIONS_MAX) })]
    : [];
  if (isBuiltin(id)) return tooMany;
  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry || entry.status !== 'approved') return [issue('@core.marketplace/default.not-approved')];
  if (!entry.proven) return [issue('@core.marketplace/default.unproven')];
  if (tooMany.length > 0) return tooMany;
  return Object.keys(entry.dependencies ?? {})
    .filter((dependency) => !dependency.startsWith(KERNEL_PLUGIN_PREFIX)
      && !isBuiltin(dependency)
      && !defaults.includes(dependency))
    .map((dependency) => issue('@core.marketplace/default.dependency-not-default', { dependency }));
};

/**
 * Por que a extensão não pode deixar de ser padrão — outra padrão depende dela, e o escritório novo
 * receberia a dependente sem a dependência.
 *
 * A embutida nunca é segurada: a dependência embutida é instalada por quem instala a dependente, seja
 * ela padrão ou não.
 */
export const defaultUnmarkIssues = (
  id: string,
  catalog: readonly DefaultCatalogSide[],
  defaults: readonly string[],
  isBuiltin: (pluginId: string) => boolean,
): LocalizedMessage[] => (isBuiltin(id) ? [] : defaults
  .filter((other) => other !== id)
  .filter((other) => catalog.find((entry) => entry.id === other)?.dependencies?.[id] !== undefined)
  .map((dependent) => issue('@core.marketplace/default.required-by', { dependent })));

/**
 * O que o escritório novo de fato instala, e em que ordem — decidido no SERVIDOR, na criação dele.
 *
 * A lista marcada é a intenção do `SYSTEM`; esta é a conferência: do catálogo, só entra o que está
 * aprovado e com a prova de instalação da versão atual. A ordem põe cada dependência ANTES de quem
 * depende dela, porque a instalação recusa a extensão cuja dependência ainda não está lá. Dependência
 * embutida ou do kernel não entra na lista — quem instala a resolve.
 *
 * O id marcado que NÃO está no catálogo é embutida: o servidor não conhece o bundle, e o catálogo é o
 * único lugar de onde uma não embutida viria — as Rules recusam obsoletar ou apagar uma padrão, e
 * marcar exige aprovada. Quem confere é o navegador, que tem o bundle: o id que ele não achar é
 * adiado, como o que saiu do catálogo.
 *
 * As embutidas vêm PRIMEIRO, e o motivo é o pacote de tradução: a semente é resolvida no servidor no
 * instante em que é gravada, e uma extensão do catálogo cujos textos ele traduz semearia sem a
 * tradução se viesse antes dele.
 */
export const defaultInstallPlan = (
  defaults: readonly string[],
  catalog: readonly DefaultCatalogSide[],
): string[] => {
  const entryOf = (id: string) => catalog.find((entry) => entry.id === id);
  const builtins = defaults.filter((id) => entryOf(id) === undefined);
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
  return [...builtins, ...ordered];
};
