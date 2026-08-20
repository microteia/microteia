// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/i18n/extensionPoints.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { Contribution } from '../plugin/contribution';
import type { ExtensionPointDefinition } from '../plugin/extensionPoint';
import type { MessageBundle, MessageCatalog } from './messages';
import { asMessageBundle, buildMessageCatalog } from './messages';
import type { LocaleCode } from './localeNegotiation';
import { normalizeLocale } from './localeNegotiation';

export const I18N_MESSAGES_POINT = 'i18n.messages';

export const I18N_API_VERSION = '1.0.0';

/**
 * O ponto que torna a plataforma agnóstica de idioma.
 *
 * `allowedImplKinds: []` não é omissão — é a decisão central. Uma tradução é METADATA PURA, e sendo
 * pura ela pode vir de QUALQUER plugin, inclusive de um `.json` que um usuário montou à mão: não há
 * código para revisar, então não há gesto de confiança a exigir. É isso que permite "instalar um
 * pacote contendo somente traduções" sem abrir nenhuma porta nova de execução.
 *
 * `multiple: true` porque o normal é haver muitos: um bundle por (idioma × plugin). Quem resolve o
 * conflito entre dois bundles do mesmo idioma para o mesmo namespace é a ordem determinística do
 * `ContributionRegistry` — maior `priority` primeiro —, e não quem foi instalado por último.
 */
export const I18N_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: I18N_MESSAGES_POINT,
    apiVersion: I18N_API_VERSION,
    title: '@core.i18n/point.messages.title',
    description:
      '@core.i18n/point.messages.description',
    ownerPluginId: 'core.i18n',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

const bundleId = (bundle: MessageBundle): string =>
  `${normalizeLocale(bundle.locale).toLowerCase()}.${bundle.namespace}`
    .replace(/[^a-z0-9.-]+/g, '-');

export const messageBundleContribution = (
  bundle: MessageBundle,
  priority?: number,
): Contribution => ({
  point: I18N_MESSAGES_POINT,
  id: bundleId(bundle),
  apiVersion: I18N_API_VERSION,
  ...(priority === undefined ? {} : { priority }),
  metadata: bundle as unknown as Record<string, unknown>,
});

/** Lê de volta o bundle de uma contribuição, descartando metadata malformada de terceiro. */
export const messageBundleOf = (contribution: Contribution): MessageBundle | null =>
  asMessageBundle(contribution.metadata);

/**
 * Os bundles de uma lista de contribuições, PRESERVANDO a ordem em que chegaram — é a ordem do
 * registro (prioridade desc, depois pluginId, depois id) e é dela que `buildMessageCatalog` depende
 * para decidir quem vence uma chave disputada.
 */
export const messageBundlesOf = (contributions: Contribution[]): MessageBundle[] => {
  const bundles: MessageBundle[] = [];
  for (const contribution of contributions) {
    const bundle = messageBundleOf(contribution);
    if (bundle) bundles.push(bundle);
  }
  return bundles;
};

/**
 * O catálogo que um PACOTE traz consigo — lido direto das contribuições `i18n.messages` do manifest,
 * sem passar pelo registro do host.
 *
 * Existe por causa do pacote que AINDA NÃO ESTÁ INSTALADO. O Marketplace lista extensões antes de
 * qualquer contribuição delas chegar ao host, então nome, resumo e descrição apareciam ali como a
 * chave crua (`com.microteia.news/package.name`): o texto existe, viaja dentro do próprio pacote, e
 * só ninguém o estava lendo.
 *
 * Ele NÃO substitui o catálogo do escritório — é `fallback` dele. Ver `catalogWithFallback`.
 */
export const packageMessageCatalog = (
  contributions: Contribution[] | undefined,
  locale: LocaleCode,
): MessageCatalog => {
  const own = (contributions ?? []).filter((contribution) => contribution?.point === I18N_MESSAGES_POINT);
  return buildMessageCatalog(messageBundlesOf(own), locale);
};
