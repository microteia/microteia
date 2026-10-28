import { readRecordText, readValueByPath } from '../../domain/services/customFieldValues';
import { screenDataCollection } from '../../domain/services/screenDataCollection';
import type { EntityRecord, FieldDefinition, LookupOption, ScreenDefinition, TenantMember } from '../../domain/entities';

export interface ReferenceOption {
  value: string;
  label: string;
  meta?: string;
}

export interface ReferenceOptionSources {
  recordsByCollection: Record<string, EntityRecord[]>;
  dynamicScreens: ScreenDefinition[];
  members: Pick<TenantMember, 'userId' | 'displayName' | 'email'>[];
  /** As opções de uma lista do escritório, com o rótulo já no idioma corrente. */
  getOptions: (collection: string) => LookupOption[];
  /** Resolve um rótulo declarativo (`@ns/chave`) e deixa intacto o texto que o escritório digitou. */
  label: (value: string) => string;
  /** O nome de um registro sem título, já traduzido. */
  untitled: string;
}

/**
 * A tela que descreve cada COLEÇÃO — e não a que tem o nome dela.
 *
 * A chave da tela e a coleção divergem sempre que a tela vem de uma extensão: `processos` descreve
 * `cases`, `prazos` descreve `deadlines`. Procurar a tela pelo nome da coleção não achava nenhuma,
 * e todo registro referenciado virava "Sem título" — no cartão, no filtro e no formulário.
 *
 * Duas telas podem apontar para a mesma coleção (uma visão sobre a outra); vale a que a possui.
 */
const definitionsByCollection = (dynamicScreens: ScreenDefinition[]): Map<string, ScreenDefinition> => {
  const map = new Map<string, ScreenDefinition>();
  dynamicScreens.forEach((definition) => {
    const collection = screenDataCollection(definition);
    const current = map.get(collection);
    if (!current || definition.id === collection) map.set(collection, definition);
  });
  return map;
};

/**
 * As opções de todo campo `reference`, por coleção apontada: o registro pelo id, rotulado pelo
 * campo-título da tela e complementado pelo campo-subtítulo.
 *
 * Título e subtítulo saem pelo VALOR EXIBIDO, como no cartão e no cabeçalho do detalhe
 * (`useRecordIdentityText`): uma seleção guarda a chave da opção e uma relação guarda o id do registro
 * apontado, e nenhum dos dois é o que se lê. O seletor mostrava `nao_habilitado` onde o cartão mostrava
 * "Não habilitado", e o registro sem título com a referência crua do catálogo.
 *
 * O nome de um registro apontado é, ele mesmo, o título resolvido do registro — e por isso a resolução
 * segue a relação. Duas telas cujos títulos apontam uma para a outra não podem girar para sempre: o
 * registro já em resolução responde vazio, e quem o pediu cai no "sem título".
 */
export const buildReferenceOptions = (sources: ReferenceOptionSources): Record<string, ReferenceOption[]> => {
  const { recordsByCollection, dynamicScreens, members, getOptions, label, untitled } = sources;
  const definitionByCollection = definitionsByCollection(dynamicScreens);

  const collectionOf = (refEntity: string): string => {
    if (recordsByCollection[refEntity] || refEntity === 'members') return refEntity;
    const screen = dynamicScreens.find((definition) => definition.id === refEntity);
    return screen ? screenDataCollection(screen) : refEntity;
  };

  const recordIndex = new Map<string, Map<string, EntityRecord>>();
  const recordOf = (collection: string, id: string): EntityRecord | undefined => {
    let index = recordIndex.get(collection);
    if (!index) {
      index = new Map((recordsByCollection[collection] ?? []).map((record) => [record.id, record]));
      recordIndex.set(collection, index);
    }
    return index.get(id);
  };

  const memberLabels = new Map(members.map((m) => [m.userId, m.displayName || m.email]));
  const titleCache = new Map<string, string>();
  const resolving = new Set<string>();

  const fieldOf = (definition: ScreenDefinition | undefined, fieldKey: string): FieldDefinition | undefined =>
    fieldKey ? definition?.fields?.find((field) => field.key === fieldKey) : undefined;

  const lookupCache = new Map<string, LookupOption[]>();
  const lookupOf = (collection: string): LookupOption[] => {
    const cached = lookupCache.get(collection);
    if (cached) return cached;
    const options = collection ? getOptions(collection) : [];
    lookupCache.set(collection, options);
    return options;
  };

  const optionLabel = (field: FieldDefinition, key: string): string =>
    label(field.options?.find((option) => option.key === key)?.label
      ?? lookupOf(field.lookupCollection ?? '').find((option) => option.key === key)?.label
      ?? key);

  /** O título resolvido de um registro carregado — vazio quando ele não tem título. */
  const titleOf = (collection: string, id: string): string => {
    const cacheKey = `${collection}/${id}`;
    const cached = titleCache.get(cacheKey);
    if (cached !== undefined) return cached;
    if (resolving.has(cacheKey)) return '';
    const record = recordOf(collection, id);
    if (!record) return '';
    resolving.add(cacheKey);
    const definition = definitionByCollection.get(collection);
    const title = fieldText(record, definition, definition?.titleFieldKey ?? '');
    resolving.delete(cacheKey);
    titleCache.set(cacheKey, title);
    return title;
  };

  /**
   * O nome de um registro APONTADO. O que não está carregado não tem nome a mostrar — o cartão também
   * deixa a relação em branco —, mas o que está carregado e não tem título é "sem título".
   */
  const pointedName = (refEntity: string, id: string): string => {
    const collection = collectionOf(refEntity);
    if (collection === 'members') return memberLabels.get(id) ?? '';
    if (!recordOf(collection, id)) return '';
    return titleOf(collection, id) || untitled;
  };

  /** O texto que se LÊ num campo do registro: a opção pelo rótulo, a relação pelo nome do apontado. */
  const fieldText = (record: EntityRecord, definition: ScreenDefinition | undefined, fieldKey: string): string => {
    const field = fieldOf(definition, fieldKey);
    if (field?.type !== 'select' && field?.type !== 'reference') return readRecordText(record, fieldKey);
    const raw = readValueByPath(record, fieldKey);
    const keys = (Array.isArray(raw) ? raw : [raw]).filter((v): v is string => typeof v === 'string' && v !== '');
    const texts = field.type === 'select'
      ? keys.map((key) => optionLabel(field, key))
      : keys.map((id) => pointedName(field.refEntity ?? '', id));
    return texts.filter(Boolean).join(', ');
  };

  // Só o que NÃO é tela do escritório fica nomeado aqui. Toda coleção descrita por uma tela entra
  // pelo caminho genérico abaixo: o rótulo sai do campo-título e o complemento, do subtítulo.
  const map: Record<string, ReferenceOption[]> = {
    members: members
      .map((m) => ({
        value: m.userId,
        label: m.displayName || m.email,
        meta: m.email || undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
  Object.entries(recordsByCollection).forEach(([collection, records]) => {
    const definition = definitionByCollection.get(collection);
    const subtitleFieldKey = definition?.subtitleFieldKey ?? '';
    map[collection] = records
      .map((record) => ({
        value: record.id,
        label: titleOf(collection, record.id) || untitled,
        meta: fieldText(record, definition, subtitleFieldKey) || undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  // A CHAVE da tela também responde, ao lado da coleção. Quem aponta para uma entidade grava a
  // coleção — mas declarações antigas guardaram a chave da tela (`processos` no lugar de `cases`),
  // e uma referência gravada assim ficava com a lista vazia, sem nada a escolher. Aqui ela volta a
  // achar os registros; o autor não precisa reabrir o que já declarou.
  dynamicScreens.forEach((definition) => {
    const collection = screenDataCollection(definition);
    if (definition.id !== collection && map[collection] && !map[definition.id]) {
      map[definition.id] = map[collection];
    }
  });
  return map;
};
