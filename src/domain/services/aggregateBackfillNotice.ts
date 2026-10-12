import { AGGREGATION_MAX_CHILDREN } from '../schema/aggregateBackfill';
import type { AggregateBackfillState } from '../schema/aggregateBackfill';

/**
 * O aviso que a listagem de uma tela mostra sobre o recálculo dos agregados dela — ou nenhum. É
 * INFORMAÇÃO, nunca um gesto: o kernel retoma sozinho o que é dele, e só aparece o que a pessoa
 * precisa saber para entender um campo vazio ou um valor que não fecha.
 *
 * A ordem é a do que pede ação primeiro: uma declaração que aponta para uma tela que não existe só se
 * resolve corrigindo a declaração; a falha e o teto explicam um valor; o andamento só explica a espera.
 */
export interface AggregateBackfillNotice {
  /** Chave no catálogo `core.records`. */
  messageKey: string;
  params: Record<string, string>;
  variant: 'info' | 'warning';
}

export const aggregateBackfillNotice = (
  state: AggregateBackfillState | null,
  fieldLabel: (fieldKey: string) => string,
): AggregateBackfillNotice | null => {
  if (!state) return null;

  if (state.status === 'blocked' && state.blocked.length > 0) {
    return {
      messageKey: 'aggregate.backfill.blocked',
      params: {
        fields: state.blocked.map((entry) => fieldLabel(entry.field)).join(', '),
        sources: [...new Set(state.blocked.map((entry) => entry.from))].join(', '),
      },
      variant: 'warning',
    };
  }

  if (state.status === 'running' && Object.keys(state.pending).length > 0) {
    return {
      messageKey: 'aggregate.backfill.running',
      params: { count: String(state.processed) },
      variant: 'info',
    };
  }

  if (state.status === 'done' && state.failed > 0) {
    return {
      messageKey: 'aggregate.backfill.failed',
      params: { count: String(state.failed) },
      variant: 'warning',
    };
  }

  if (state.status === 'done' && state.truncated > 0) {
    return {
      messageKey: 'aggregate.backfill.truncated',
      params: { count: String(state.truncated), max: String(AGGREGATION_MAX_CHILDREN) },
      variant: 'info',
    };
  }

  return null;
};
