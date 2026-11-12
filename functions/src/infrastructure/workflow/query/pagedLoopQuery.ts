import type { QuerySpec } from '../../../domain/schema/querySpec';
import type { WorkflowContext, WorkflowQueryPage } from '../../../domain/entities/WorkflowContext';
import { runWorkflowQuery } from './runWorkflowQuery';
import type { WorkflowQueryDeps } from './runWorkflowQuery';

/**
 * Uma página do `Loop` paginado pela MESMA consulta do passo `query` — mesmos filtros, mesma
 * hidratação, mesma visibilidade —, lendo pela ordem do id (`QuerySpec.page`), que é o que deixa o
 * cursor dispensar índice. Por isso a ordem declarada não vale aqui: com página, o Firestore entrega na
 * ordem do id, e uma `orderBy` daria páginas que se repetem ou pulam registros.
 */
export const makeQueryPage = (deps: WorkflowQueryDeps) => async (
  spec: QuerySpec,
  cursor: string | null,
  pageSize: number,
  context: WorkflowContext,
): Promise<WorkflowQueryPage> => {
  const outcome = await runWorkflowQuery(
    {
      table: spec.table,
      where: spec.where,
      projections: spec.projections,
      limit: pageSize,
      page: { after: { kind: 'Literal', value: cursor ?? '' } },
    },
    context,
    deps,
  );
  if (!outcome.ok) return outcome;
  const next = outcome.value.cursor;
  return { ok: true, items: outcome.value.results, cursor: next, hasMore: outcome.value.hasMore && next !== null };
};
