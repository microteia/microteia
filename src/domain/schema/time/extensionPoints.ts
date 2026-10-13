// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/time/extensionPoints.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Contribution } from '../plugin/contribution';
import type { ExtensionPointDefinition } from '../plugin/extensionPoint';

/**
 * Onde moram os calendários de dias úteis — declarado por uma extensão, nunca escrito no kernel.
 *
 * O kernel sabe CONTAR dias úteis (`businessDays.ts`); quem sabe onde estão os calendários do
 * escritório é a extensão que traz a tela deles. A contribuição diz só a coleção, e os documentos dela
 * seguem o contrato de `BUSINESS_CALENDAR_FIELDS`. Mais de uma extensão pode declarar: os calendários
 * de todas entram no mesmo conjunto, e uma fórmula os cita pela chave ou pelo id.
 *
 * Metadata pura (`allowedImplKinds: []`): não há código a revisar, e uma extensão de terceiro declara
 * pelo mesmo caminho que uma de primeira parte. Independe de qualquer extensão opcional — sem nenhuma
 * contribuição, a conta recusa com erro nomeado.
 */
export const BUSINESS_CALENDAR_POINT = 'time.business.calendar';

export const BUSINESS_CALENDAR_API_VERSION = '1.0.0';

export const TIME_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: BUSINESS_CALENDAR_POINT,
    apiVersion: BUSINESS_CALENDAR_API_VERSION,
    title: '@core.data/point.business-calendar.title',
    description: '@core.data/point.business-calendar.description',
    ownerPluginId: 'core.data',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

/** O que a extensão declara: a coleção em que os calendários moram. */
export interface BusinessCalendarSource {
  collection: string;
}

const COLLECTION_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** O id da contribuição sai da coleção, na forma que o kernel aceita para um id (`business-calendars`). */
const contributionIdOf = (collection: string): string =>
  collection.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase();

export const businessCalendarContribution = (source: BusinessCalendarSource): Contribution => ({
  point: BUSINESS_CALENDAR_POINT,
  id: contributionIdOf(source.collection),
  apiVersion: BUSINESS_CALENDAR_API_VERSION,
  metadata: { collection: source.collection },
});

/** Lê de volta a declaração, descartando a malformada: coleção ausente ou com caractere de caminho. */
export const businessCalendarSourceOf = (contribution: { metadata?: unknown }): BusinessCalendarSource | undefined => {
  const metadata = contribution.metadata as Partial<BusinessCalendarSource> | undefined;
  const collection = typeof metadata?.collection === 'string' ? metadata.collection.trim() : '';
  return COLLECTION_PATTERN.test(collection) ? { collection } : undefined;
};

/** As coleções declaradas, sem repetição e na ordem em que as contribuições chegaram. */
export const businessCalendarCollectionsOf = (contributions: readonly { point?: string; metadata?: unknown }[]): string[] => [
  ...new Set(
    contributions
      .filter((contribution) => contribution?.point === BUSINESS_CALENDAR_POINT)
      .map(businessCalendarSourceOf)
      .filter((source): source is BusinessCalendarSource => source !== undefined)
      .map((source) => source.collection),
  ),
];
