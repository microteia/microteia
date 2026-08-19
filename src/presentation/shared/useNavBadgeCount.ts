import { useCallback } from 'react';
import { useRecords } from '../../stores/useRecords';
import { useExprViewer } from './useExprViewer';
import { evaluateFieldBoolean } from '../../domain/schema/fieldExpression';
import { EMPTY_VIEWER, type ExprViewer } from '../../domain/schema/actionExpression';
import type { UiNavBadge } from '../../domain/schema/ui/uiExtensionPoints';
import type { EntityRecord } from '../../domain/entities';

export const countBadgeRecords = (
  records: EntityRecord[],
  badge: UiNavBadge,
  viewer: ExprViewer = EMPTY_VIEWER,
): number => {
  const expression = badge.when?.trim();
  if (!expression) return records.length;
  return records.filter(
    (record) => evaluateFieldBoolean(expression, { value: null, data: { ...record, user: viewer } }),
  ).length;
};

/**
 * O número do selo de um item de menu. Conta os registros já carregados pela assinatura da coleção —
 * o mesmo dado que a listagem enxerga —, então o selo desce sozinho quando alguém tria um registro,
 * sem consulta própria e sem um contador a manter sincronizado.
 *
 * A expressão vê o registro E `user` (quem está olhando), que é o que permite o selo PESSOAL:
 * `not contains(readBy, user.id)` conta o que este usuário ainda não leu, sem que exista contador
 * por usuário em lugar nenhum. Um campo chamado `user` fica sobrescrito no escopo — é o preço de ter
 * o registro na raiz, o mesmo das expressões de Action.
 *
 * Coleção que ninguém descreve devolve zero, e não erro: uma extensão desinstalada deixa para trás
 * um item de menu que some no próximo carregamento, e um selo quebrado nesse intervalo seria pior
 * do que selo nenhum.
 */
export const useNavBadgeCount = (): ((badge: UiNavBadge | undefined) => number) => {
  const { recordsByCollection } = useRecords();
  const viewer = useExprViewer();

  return useCallback(
    (badge) => (badge ? countBadgeRecords(recordsByCollection[badge.collection] ?? [], badge, viewer) : 0),
    [recordsByCollection, viewer],
  );
};
