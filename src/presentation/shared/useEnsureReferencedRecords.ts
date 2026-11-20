import { useEffect, useMemo } from 'react';
import { useRecords } from '../../stores/useRecords';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { MEMBER_REFERENCE_ENTITY } from '../../domain/schema/memberVisibility';
import { searchTitleReferenceField } from '../../domain/schema/recordSearch';
import { screenDataCollection } from '../../domain/services/screenDataCollection';
import type { EntityRecord, FieldDefinition, ScreenDefinition } from '../../domain/entities';

const idsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return value === '' ? [] : [value];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id !== '') : [];
};

type Wanted = (readonly [string, string[]])[];

const add = (byCollection: Map<string, Set<string>>, collection: string, ids: readonly string[]): void => {
  if (ids.length === 0) return;
  const set = byCollection.get(collection) ?? new Set<string>();
  for (const id of ids) set.add(id);
  byCollection.set(collection, set);
};

const sorted = (byCollection: Map<string, Set<string>>): Wanted =>
  [...byCollection]
    .filter(([, ids]) => ids.size > 0)
    .map(([collection, ids]) => [collection, [...ids].sort()] as const);

/** A tela que descreve a coleção (ou que tem a chave pedida) — a de quem é dono dela, quando há duas. */
const screenFor = (screens: readonly ScreenDefinition[], collectionOrKey: string): ScreenDefinition | undefined =>
  screens.find((screen) => screen.id === collectionOrKey)
  ?? screens.find((screen) => screenDataCollection(screen) === collectionOrKey);

/**
 * O SEGUNDO salto: dos registros apontados já conhecidos cuja tela se chama por outra referência (a conta
 * cujo título é o titular), os registros que esse título aponta. Sem eles o nome do apontado não tem de
 * onde sair, e a carta que aponta a conta mostrava "Sem título".
 *
 * Um salto só, como na busca e no portal: o título do segundo que for referência não é seguido.
 */
export const titleReferenceNeeds = (
  pointed: readonly { collection: string; record: Record<string, unknown> }[],
  screens: readonly ScreenDefinition[],
): Wanted => {
  const byCollection = new Map<string, Set<string>>();
  for (const { collection, record } of pointed) {
    const screen = screenFor(screens, collection);
    if (!screen) continue;
    const field = searchTitleReferenceField({ titleFieldKey: screen.titleFieldKey, fields: screen.fields ?? [] });
    if (!field?.refEntity || field.refEntity === MEMBER_REFERENCE_ENTITY) continue;
    add(byCollection, field.refEntity, idsOf(record[field.key]));
  }
  return sorted(byCollection);
};

const knownRecordsOf = (
  knownRecordsByCollection: Record<string, EntityRecord[]>,
  screens: readonly ScreenDefinition[],
  wanted: Wanted,
): { collection: string; record: Record<string, unknown> }[] =>
  wanted.flatMap(([refEntity, ids]) => {
    const screen = screenFor(screens, refEntity);
    const collection = knownRecordsByCollection[refEntity] || !screen ? refEntity : screenDataCollection(screen);
    const wantedIds = new Set(ids);
    return (knownRecordsByCollection[collection] ?? [])
      .filter((record) => wantedIds.has(record.id))
      .map((record) => ({ collection, record: record as unknown as Record<string, unknown> }));
  });

/**
 * Traz por id os registros que estes registros APONTAM e que não estão carregados — para que o cartão
 * e o formulário mostrem o nome, e não um registro "não encontrado", quando a pessoa apontada ficou
 * fora dos 500 mais recentes da coleção dela. E, do apontado que se chama por outra referência, o
 * registro de onde sai o nome dele.
 *
 * Membro não é coleção de registro: o nome dele vem da lista de membros do escritório.
 */
export const useEnsureReferencedRecords = (
  records: readonly Record<string, unknown>[],
  fields: readonly FieldDefinition[],
): void => {
  const { ensureRecords, knownRecordsByCollection } = useRecords();
  const { dynamicScreens } = useScreenDefinitions();

  const wanted = useMemo(() => {
    const byCollection = new Map<string, Set<string>>();
    for (const field of fields) {
      if (field.type !== 'reference' || !field.refEntity || field.refEntity === MEMBER_REFERENCE_ENTITY) continue;
      for (const record of records) add(byCollection, field.refEntity, idsOf(record[field.key]));
    }
    return sorted(byCollection);
  }, [records, fields]);

  const distant = useMemo(
    () => titleReferenceNeeds(knownRecordsOf(knownRecordsByCollection, dynamicScreens, wanted), dynamicScreens),
    [knownRecordsByCollection, dynamicScreens, wanted],
  );

  useEffect(() => {
    for (const [collection, ids] of wanted) ensureRecords(collection, ids);
  }, [wanted, ensureRecords]);

  useEffect(() => {
    for (const [collection, ids] of distant) ensureRecords(collection, ids);
  }, [distant, ensureRecords]);
};

/**
 * O registro cujo TÍTULO é uma referência só tem nome com o apontado carregado. Para listas que mostram
 * registros de várias telas pelo título — o ⌘K —, e não por um campo de referência.
 */
export const useEnsureTitleReferences = (records: readonly EntityRecord[]): void => {
  const { ensureRecords } = useRecords();
  const { dynamicScreens } = useScreenDefinitions();

  const wanted = useMemo(
    () => titleReferenceNeeds(
      records.map((record) => ({ collection: record.collection, record: record as unknown as Record<string, unknown> })),
      dynamicScreens,
    ),
    [records, dynamicScreens],
  );

  useEffect(() => {
    for (const [collection, ids] of wanted) ensureRecords(collection, ids);
  }, [wanted, ensureRecords]);
};
