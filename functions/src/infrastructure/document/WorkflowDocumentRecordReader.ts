import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { IWorkflowQueryRepository } from '../../domain/repositories/IWorkflowQueryRepository';
import type {
  IDocumentRecordReader,
  RecordReadOutcome,
} from '../../domain/repositories/IDocumentGenerationPorts';
import type { DocumentTemplateDataset } from '../../domain/schema/document/documentTemplate';
import { datasetOrder } from '../../domain/schema/document/documentTemplate';
import type { QuerySpec } from '../../domain/schema/querySpec';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import { parsePath, resolvePath } from '../../domain/schema/pathResolver';
import type { PathRoot, SchemaContext } from '../../domain/schema/pathResolver';
import { applyDerivedFields, collectDerivedFieldKeys } from '../../domain/schema/recordRules';
import { withAmbientTimeZone } from '../../domain/schema/clockGate';
import { withAmbientBusinessCalendars } from '../../domain/schema/time/businessDaysGate';
import type { BusinessCalendarSet } from '../../domain/schema/time/businessDays';
import { DEFAULT_WORKFLOW_QUERY_LIMITS, hydrateRecords, runRecordQuery } from '../workflow/query/runWorkflowQuery';
import { readerFetcher } from '../workflow/query/readerScope';
import type { RecordReader } from '../../domain/schema/memberVisibility';

/**
 * O teto de filhos de um documento: o mesmo de "Buscar Registros". Uma lista de parcelas que passe
 * disso é um relatório, não um documento.
 */
const MAX_CHILDREN = 100;

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
  ): Promise<RecordReadOutcome<Record<string, unknown>[]>> {
    const ctx = await this.screens.getSchemaContext(tenantId);
    const table = resolveQueryTable(dataset.from, ctx);
    if (!table) return { ok: false, error: '@core.automation/mutation.table.unknown', errorParams: { table: dataset.from } };

    const orderBy = datasetOrder(dataset);
    const spec: QuerySpec = {
      table: dataset.from,
      where: [{ path: dataset.via, op: 'eq', value: { kind: 'Literal', value: parentId } }],
      ...(orderBy.length > 0 ? { orderBy } : {}),
      limit: Math.min(Math.max(dataset.limit ?? MAX_CHILDREN, 1), MAX_CHILDREN),
      projections: reachable(ctx, table.root, paths),
    };
    const outcome = await runRecordQuery(
      spec,
      [parentId],
      { tenantId, timeZone, reader, ...(businessCalendars !== undefined ? { businessCalendars } : {}) },
      { queryRepository: this.queryRepository, fetcher: this.fetcher, screenProvider: this.screens },
      DEFAULT_WORKFLOW_QUERY_LIMITS,
      { deterministicOrder: true },
    );
    if (!outcome.ok) return outcome;
    return { ok: true, value: outcome.value.results };
  }
}
