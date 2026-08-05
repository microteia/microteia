import { useCallback } from 'react';
import { useRecords } from '../../stores/useRecords';
import { evaluateFieldBoolean } from '../../domain/schema/fieldExpression';
import type { UiNavBadge } from './uiExtensionPoints';
import type { EntityRecord } from '../../domain/entities';

export const countBadgeRecords = (records: EntityRecord[], badge: UiNavBadge): number => {
  const expression = badge.when?.trim();
  if (!expression) return records.length;
  return records.filter(
    (record) => evaluateFieldBoolean(expression, { value: null, data: record }),
  ).length;
};

/**
 * O número do selo de um item de menu. Conta os registros já carregados pela assinatura da coleção —
 * o mesmo dado que a listagem enxerga —, então o selo desce sozinho quando alguém tria um registro,
 * sem consulta própria e sem um contador a manter sincronizado.
 *
 * Coleção que ninguém descreve devolve zero, e não erro: uma extensão desinstalada deixa para trás
 * um item de menu que some no próximo carregamento, e um selo quebrado nesse intervalo seria pior
 * do que selo nenhum.
 */
export const useNavBadgeCount = (): ((badge: UiNavBadge | undefined) => number) => {
  const { recordsByCollection } = useRecords();
  return useCallback(
    (badge) => (badge ? countBadgeRecords(recordsByCollection[badge.collection] ?? [], badge) : 0),
    [recordsByCollection],
  );
};
