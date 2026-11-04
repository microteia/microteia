import { useEffect, useMemo } from 'react';
import { useRecords } from '../../stores/useRecords';
import { MEMBER_REFERENCE_ENTITY } from '../../domain/schema/memberVisibility';
import type { FieldDefinition } from '../../domain/entities';

const idsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return value === '' ? [] : [value];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id !== '') : [];
};

/**
 * Traz por id os registros que estes registros APONTAM e que não estão carregados — para que o cartão
 * e o formulário mostrem o nome, e não um registro "não encontrado", quando a pessoa apontada ficou
 * fora dos 500 mais recentes da coleção dela.
 *
 * Membro não é coleção de registro: o nome dele vem da lista de membros do escritório.
 */
export const useEnsureReferencedRecords = (
  records: readonly Record<string, unknown>[],
  fields: readonly FieldDefinition[],
): void => {
  const { ensureRecords } = useRecords();

  const wanted = useMemo(() => {
    const byCollection = new Map<string, Set<string>>();
    for (const field of fields) {
      if (field.type !== 'reference' || !field.refEntity || field.refEntity === MEMBER_REFERENCE_ENTITY) continue;
      const ids = byCollection.get(field.refEntity) ?? new Set<string>();
      for (const record of records) for (const id of idsOf(record[field.key])) ids.add(id);
      byCollection.set(field.refEntity, ids);
    }
    return [...byCollection]
      .filter(([, ids]) => ids.size > 0)
      .map(([collection, ids]) => [collection, [...ids].sort()] as const);
  }, [records, fields]);

  useEffect(() => {
    for (const [collection, ids] of wanted) ensureRecords(collection, ids);
  }, [wanted, ensureRecords]);
};
