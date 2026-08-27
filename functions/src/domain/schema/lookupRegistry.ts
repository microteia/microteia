// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/lookupRegistry.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

export type LookupGroup = 'document';

export interface LookupMetadata {
  collection: string;
  group: LookupGroup;
  screenLabel: string;
  entityLabel: string;
}

const LOOKUP_LIST: LookupMetadata[] = [
  {
    collection: 'documentTypes',
    group: 'document',
    screenLabel: '@core.data/lookup.document-types.screen',
    entityLabel: '@core.data/lookup.document-types.entity',
  },
];

export const LOOKUP_REGISTRY: Record<string, LookupMetadata> = Object.fromEntries(
  LOOKUP_LIST.map((lookup) => [lookup.collection, lookup]),
);

export const LOOKUP_REGISTRY_LIST: LookupMetadata[] = LOOKUP_LIST;

export const isLookupCollection = (collection: string): boolean => collection in LOOKUP_REGISTRY;

/**
 * O rótulo composto de uma lista — "Documentos: Tipo" — como REFERÊNCIA e parâmetros, nunca como
 * texto pronto.
 *
 * Devolvia `${screenLabel}:${lookup.entityLabel}`, e a concatenação era o defeito duas vezes: prendia
 * os dois rótulos no código e prendia o separador junto, que é onde o idioma se esconde. Este módulo é
 * compartilhado com o backend e não conhece catálogo — então aqui se declara a forma, e quem mostra
 * resolve. Os parâmetros IRMÃOS descem para a mensagem aninhada, como em `resolveEventCatalogLabel`.
 */
export const lookupLabelRef = (
  collection: string,
): { label: string; labelParams?: Record<string, string> } => {
  const lookup = LOOKUP_REGISTRY[collection];
  if (!lookup) return { label: collection };
  return {
    label: '@core.data/lookup.qualified',
    labelParams: { screen: lookup.screenLabel, entity: lookup.entityLabel },
  };
};
