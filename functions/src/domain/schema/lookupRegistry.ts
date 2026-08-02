// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/lookupRegistry.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

export type LookupGroup = 'document' | 'news';

export interface LookupMetadata {
  collection: string;
  group: LookupGroup;
  screenLabel: string;
  entityLabel: string;
}

const LOOKUP_LIST: LookupMetadata[] = [
  { collection: 'documentTypes', group: 'document', screenLabel: 'Documentos', entityLabel: 'Tipo' },
  { collection: 'newsCategories', group: 'news', screenLabel: 'Notícias', entityLabel: 'Categoria' },
];

export const LOOKUP_REGISTRY: Record<string, LookupMetadata> = Object.fromEntries(
  LOOKUP_LIST.map((lookup) => [lookup.collection, lookup]),
);

export const LOOKUP_REGISTRY_LIST: LookupMetadata[] = LOOKUP_LIST;

export const isLookupCollection = (collection: string): boolean => collection in LOOKUP_REGISTRY;

export const getLookupLabel = (collection: string): string => {
  const lookup = LOOKUP_REGISTRY[collection];
  return lookup ? `${lookup.screenLabel}:${lookup.entityLabel}` : collection;
};
