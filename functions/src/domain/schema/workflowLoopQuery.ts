// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowLoopQuery.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowLoopQuery.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { QuerySpec } from './querySpec';
import { QUERY_MAX_RESULTS } from './querySpec';

/** O kernel a partir do qual o `Loop` percorre uma consulta em páginas (`loop.query`). */
export const WORKFLOW_PAGED_LOOP_SINCE_KERNEL = '2.120.0';

/** O teto de uma página: o mesmo da resposta de uma consulta, porque é a consulta que a traz. */
export const PAGED_LOOP_MAX_PAGE_SIZE = QUERY_MAX_RESULTS;
export const PAGED_LOOP_DEFAULT_PAGE_SIZE = 50;

/**
 * Um `Loop` que percorre uma CONSULTA, e não uma lista: uma página por volta. É o "todo dia, para cada
 * registro vencido…" sobre milhares de registros — o `query` sozinho para em `QUERY_MAX_RESULTS`, e uma
 * execução só não cabe no orçamento de tempo para todos eles.
 */
export interface WorkflowLoopQuery {
  spec: QuerySpec;
  pageSize: number;
}

/**
 * Onde o laço paginado parou: o passo, o cursor da próxima página e o que já foi feito. É o que a
 * continuação leva no relógio, e o que faz a retomada voltar AO LAÇO, e não ao passo depois dele.
 */
export interface PagedLoopState {
  stepId: string;
  cursor: string;
  /** Páginas já processadas. */
  page: number;
  /** Itens já processados. */
  processed: number;
}

/** O tamanho efetivo: o declarado, dentro do teto; inválido, o padrão. */
export const pagedLoopPageSize = (value: unknown): number => {
  const size = Number(value);
  return Number.isFinite(size) && size >= 1 ? Math.min(Math.trunc(size), PAGED_LOOP_MAX_PAGE_SIZE) : PAGED_LOOP_DEFAULT_PAGE_SIZE;
};
