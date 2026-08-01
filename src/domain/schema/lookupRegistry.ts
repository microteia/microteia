export type LookupGroup = 'deadline' | 'document' | 'news';

export interface LookupMetadata {
  collection: string;
  group: LookupGroup;
  screenLabel: string;
  entityLabel: string;
}

const LOOKUP_LIST: LookupMetadata[] = [
  { collection: 'documentTypes', group: 'document', screenLabel: 'Documentos', entityLabel: 'Tipo' },
  { collection: 'newsCategories', group: 'news', screenLabel: 'Notícias', entityLabel: 'Categoria' },
  // O centro de custo é do FINANCEIRO, que é do kernel, e a extensão de Contratos aponta para a
  // mesma lista — as duas telas compartilham as opções, como dois campos com o mesmo
  // `lookupCollection`. Por isso ela fica, enquanto as outras nove listas de Contrato saíram junto
  // com a entidade.
  { collection: 'deadlineTypes', group: 'deadline', screenLabel: 'Prazo', entityLabel: 'Tipo' },
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
