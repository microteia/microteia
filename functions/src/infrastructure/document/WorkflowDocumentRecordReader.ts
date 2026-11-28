import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { IWorkflowQueryRepository } from '../../domain/repositories/IWorkflowQueryRepository';
import type {
  IDocumentRecordReader,
  RecordReadOutcome,
} from '../../domain/repositories/IDocumentGenerationPorts';
import type { DocumentTemplateDataset } from '../../domain/schema/document/documentTemplate';
import { DOCUMENT_DATASET_MAX_ROWS, datasetOrder } from '../../domain/schema/document/documentTemplate';
import type { QueryOrderBy, QuerySpec } from '../../domain/schema/querySpec';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import { parsePath, resolvePath } from '../../domain/schema/pathResolver';
import type { PathRoot, SchemaContext } from '../../domain/schema/pathResolver';
import { applyDerivedFields, collectDerivedFieldKeys } from '../../domain/schema/recordRules';
import { withAmbientTimeZone } from '../../domain/schema/clockGate';
import { withAmbientBusinessCalendars } from '../../domain/schema/time/businessDaysGate';
import type { BusinessCalendarSet } from '../../domain/schema/time/businessDays';
import {
  DEFAULT_WORKFLOW_QUERY_LIMITS,
  applyDeterministicOrdering,
  hydrateRecords,
  runRecordQuery,
} from '../workflow/query/runWorkflowQuery';
import type { RecordQueryScope, WorkflowQueryDeps } from '../workflow/query/runWorkflowQuery';
import { readerFetcher } from '../workflow/query/readerScope';
import type { RecordReader } from '../../domain/schema/memberVisibility';

/**
 * O tamanho da página quando a lista passa do teto de uma consulta (o arquivo de leiaute, #47). Cada
 * página é uma consulta de igualdade com cursor pelo id — a mesma do `page` da automação —, e por isso
 * não pede índice composto: a ordem declarada é aplicada depois, sobre a lista inteira.
 */
const PAGE_SIZE = 500;

/**
 * Só os caminhos que resolvem A PARTIR DESTA raiz. Dentro de um laço a gramática não sabe se um nome
 * é do item ou do registro de fora, e pede aos dois lados; a consulta valida as projeções e recusaria
 * a lista inteira por causa de um nome que era do pai.
 */
const reachable = (ctx: SchemaContext, root: PathRoot, paths: readonly string[]): string[] =>
  paths.filter((path) => resolvePath(ctx, root, parsePath(path)).valid);

/**
 * A leitura do documento pelo mesmo caminho das automações: a hidratação por caminho, a derivação na
 * leitura e, para os filhos, a consulta inteira (`runRecordQuery`). Um campo derivado aparece no
 * documento com o valor de HOJE, como aparece na tela.
 */
export class WorkflowDocumentRecordReader implements IDocumentRecordReader {
  constructor(
    private readonly fetcher: IWorkflowRecordFetcher,
    private readonly screens: IScreenDefinitionProvider,
    private readonly queryRepository: IWorkflowQueryRepository,
  ) {}

  async record(
    tenantId: string,
    collection: string,
    recordId: string,
    paths: readonly string[],
    timeZone: string,
    businessCalendars?: BusinessCalendarSet | null,
    reader?: RecordReader | null,
  ): Promise<RecordReadOutcome<Record<string, unknown> | null>> {
    const ctx = await this.screens.getSchemaContext(tenantId);
    const table = resolveQueryTable(collection, ctx);
    if (!table) return { ok: false, error: '@core.automation/mutation.table.unknown', errorParams: { table: collection } };
    if (!recordId) return { ok: true, value: null };

    const fetcher = readerFetcher(this.fetcher, ctx, reader);
    const fetched = await fetcher.fetchByIds(tenantId, table.physicalCollection, [recordId]);
    const data = fetched.get(recordId);
    if (!data) return { ok: true, value: null };

    const [hydrated] = await hydrateRecords(
      [{ id: recordId, data }],
      table.root,
      ctx,
      reachable(ctx, table.root, paths),
      tenantId,
      fetcher,
    );
    if (collectDerivedFieldKeys(ctx, collection).size === 0) return { ok: true, value: hydrated };

    const at = new Date();
    return {
      ok: true,
      value: withAmbientBusinessCalendars(businessCalendars, () =>
        withAmbientTimeZone(timeZone, () => applyDerivedFields(ctx, collection, hydrated, at)),
      ),
    };
  }

  async children(
    tenantId: string,
    dataset: DocumentTemplateDataset,
    parentId: string,
    paths: readonly string[],
    timeZone: string,
    businessCalendars?: BusinessCalendarSet | null,
    reader?: RecordReader | null,
    ceiling: number = DOCUMENT_DATASET_MAX_ROWS,
  ): Promise<RecordReadOutcome<Record<string, unknown>[]>> {
    const ctx = await this.screens.getSchemaContext(tenantId);
    const table = resolveQueryTable(dataset.from, ctx);
    if (!table) return { ok: false, error: '@core.automation/mutation.table.unknown', errorParams: { table: dataset.from } };

    const orderBy = datasetOrder(dataset);
    const limit = Math.min(Math.max(dataset.limit ?? ceiling, 1), ceiling);
    const projections = reachable(ctx, table.root, paths);
    const where: QuerySpec['where'] = [{ path: dataset.via, op: 'eq', value: { kind: 'Literal', value: parentId } }];
    const scope: RecordQueryScope = { tenantId, timeZone, reader, ...(businessCalendars !== undefined ? { businessCalendars } : {}) };
    const deps: WorkflowQueryDeps = { queryRepository: this.queryRepository, fetcher: this.fetcher, screenProvider: this.screens };

    if (ceiling <= DOCUMENT_DATASET_MAX_ROWS) {
      const outcome = await runRecordQuery(
        { table: dataset.from, where, ...(orderBy.length > 0 ? { orderBy } : {}), limit, projections },
        [parentId],
        scope,
        deps,
        DEFAULT_WORKFLOW_QUERY_LIMITS,
        { deterministicOrder: true },
      );
      if (!outcome.ok) return outcome;
      return { ok: true, value: outcome.value.results };
    }

    const all = await this.everyChild(dataset, where, orderBy, projections, parentId, scope, deps, ceiling);
    if (!all.ok) return all;
    const ordered = orderBy.length > 0 ? applyDeterministicOrdering(all.value, orderBy) : all.value;
    return { ok: true, value: ordered.slice(0, limit) };
  }

  /**
   * TODOS os filhos, página a página. A ordem declarada só pode ser aplicada sobre a lista inteira —
   * a página segue o id, e o `limit` com ordem decide QUAIS entram —, e por isso o teto vale para o
   * que existe, não para o que o modelo pede: passar dele é recusa, não um arquivo pela metade.
   */
  private async everyChild(
    dataset: DocumentTemplateDataset,
    where: QuerySpec['where'],
    orderBy: QueryOrderBy[],
    projections: string[],
    parentId: string,
    scope: RecordQueryScope,
    deps: WorkflowQueryDeps,
    ceiling: number,
  ): Promise<RecordReadOutcome<Record<string, unknown>[]>> {
    const spec: QuerySpec = {
      table: dataset.from,
      where,
      limit: PAGE_SIZE,
      projections: [...new Set([...projections, ...orderBy.map((order) => order.path)])],
      page: {},
    };
    const rows: Record<string, unknown>[] = [];
    let after: string | null = null;
    do {
      const page = await runRecordQuery(
        spec,
        [parentId],
        scope,
        deps,
        { maxScan: PAGE_SIZE, maxResults: PAGE_SIZE },
        { pageAfter: after ?? undefined },
      );
      if (!page.ok) return page;
      rows.push(...page.value.results);
      if (rows.length > ceiling) {
        return {
          ok: false,
          error: '@core.documents/render.dataset-too-large',
          errorParams: { name: dataset.name, max: String(ceiling) },
        };
      }
      after = page.value.cursor ?? null;
    } while (after !== null);
    return { ok: true, value: rows };
  }
}
