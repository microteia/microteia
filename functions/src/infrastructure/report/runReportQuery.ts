import { requirePermission } from '../handlers/shared/requirePermission';
import { collectionPermissionId } from '../../domain/schema/access';
import { resolveMapping } from '../../domain/engine/InputMapping';
import type { WorkflowContext } from '../../domain/entities/WorkflowContext';
import type { SchemaContext } from '../../domain/schema/pathResolver';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import type { QueryPredicate, QuerySpec } from '../../domain/schema/querySpec';
import type { ResolvedPredicate } from '../../domain/schema/predicateMatch';
import { aggregateReportRows } from '../../domain/schema/report/aggregateRows';
import { filterReportRows } from '../../domain/schema/report/reportRowFilter';
import type { ReportResult } from '../../domain/schema/report/reportResult';
import { buildReportQuery, isAggregateMeasure, reportSourceCollections } from '../../domain/schema/report/reportSpec';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import { hasBlockingReportIssue, validateReportSpec } from '../../domain/schema/report/validateReportSpec';
import type { ReportSpecIssue } from '../../domain/schema/report/validateReportSpec';
import { runWorkflowQuery } from '../workflow/query/runWorkflowQuery';
import type { WorkflowQueryDeps } from '../workflow/query/runWorkflowQuery';
import {
  REPORT_MAX_COLUMNS,
  REPORT_MAX_GROUPS,
  REPORT_MAX_RECORDS,
  REPORT_MAX_SCAN,
} from './reportLimits';

export type ReportOutcome =
  | { ok: true; value: ReportResult; issues: ReportSpecIssue[] }
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string>; issues?: ReportSpecIssue[] };

/**
 * Cobra, no SERVIDOR, a leitura de cada coleção que o relatório toca.
 *
 * Um agregado sobre linhas que o leitor não pode ver é exatamente como um relatório vaza dado: a
 * contagem de salários acima de X não mostra nenhum salário e revela todos.
 *
 * E não é só a coleção-fonte. Agrupar por `cliente.cidade` LÊ a coleção de clientes — o executor de
 * workflow não cobra isso porque ele roda como ator de automação, enquanto o relatório roda como o
 * USUÁRIO. Sem esta checagem, um campo de Clientes sai num relatório para quem não pode abrir
 * Clientes; e a lista é DERIVADA do plano de hidratação, não declarada, para que uma extensão não
 * consiga esconder um hop declarando de menos.
 *
 * Devolve o conjunto CONCEDIDO, como `requirePermission` faz, porque quem acaba de autorizar precisa
 * dele em seguida: é o conjunto que o `hasPermission` de um filtro por expressão consulta, e uma
 * segunda leitura do mesmo documento de membro seria só desperdício. Vazio quando não havia coleção
 * a cobrar — e aí o spec já não resolve a tabela, e a execução o recusa antes de agregar qualquer coisa.
 */
export const requireReportCollections = async (
  spec: ReportSpec,
  ctx: SchemaContext,
  tenantId: string,
  userId: string,
): Promise<string[]> => {
  let granted: string[] = [];
  for (const collection of reportSourceCollections(spec, ctx)) {
    granted = await requirePermission(tenantId, userId, collectionPermissionId(collection, 'read'));
  }
  return granted;
};

const resolvedFilters = (
  predicates: QueryPredicate[],
  context: WorkflowContext,
): ResolvedPredicate[] => predicates.map((predicate) => ({
  path: predicate.path,
  op: predicate.op,
  value: predicate.value ? resolveMapping(predicate.value, context) : undefined,
}));

/**
 * O filtro FOI respondido.
 *
 * Nenhum escolhido num filtro de vários é o mesmo que não perguntar: uma lista vazia viraria um
 * predicado que nada atende, e o relatório voltaria vazio por causa do filtro que ninguém preencheu.
 */
const answered = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return false;
  return !Array.isArray(value) || value.length > 0;
};

/**
 * Os predicados que o LEITOR preencheu, na forma que o resto do caminho já entende.
 *
 * Entram como `Literal` de propósito: assim eles passam pelo MESMO `resolveMapping` do filtro fixo,
 * e não existe um segundo jeito de um valor chegar a uma consulta.
 */
const promptPredicates = (spec: ReportSpec, values: Record<string, unknown>): QueryPredicate[] =>
  (spec.presentation?.prompts ?? [])
    .filter((prompt) => answered(values[prompt.key]))
    .map((prompt) => ({
      path: prompt.path,
      op: prompt.op,
      value: { kind: 'Literal' as const, value: values[prompt.key] },
    }));

export interface RunReportInput {
  spec: ReportSpec;
  context: WorkflowContext;
  deps: WorkflowQueryDeps;
  prompts?: Record<string, unknown>;
}

/**
 * Executa o relatório: valida, busca as linhas e agrega.
 *
 * A agregação em si é FUNÇÃO PURA e mora no domínio compartilhado — é o que faz a pré-visualização
 * da autoria devolver exatamente o número que isto devolve, sem uma segunda implementação, e o que
 * deixa um executor paginado de amanhã reusá-la sem mudar a forma da resposta.
 */
export const runReportQuery = async ({
  spec,
  context,
  deps,
  prompts,
}: RunReportInput): Promise<ReportOutcome> => {
  const tenantId = context.execution.tenantId;
  const schema = await deps.screenProvider.getSchemaContext(tenantId);

  const issues = validateReportSpec(spec, { schema, scanCeiling: REPORT_MAX_SCAN });
  if (hasBlockingReportIssue(issues)) {
    return {
      ok: false,
      error: '@core.reports/spec.invalid',
      errorParams: { detail: issues.map((issue) => `${issue.field}: ${issue.error}`).join('; ') },
      issues,
    };
  }

  const base = buildReportQuery(spec, REPORT_MAX_SCAN);
  const query: QuerySpec = {
    ...base,
    where: [...base.where, ...promptPredicates(spec, prompts ?? {})],
  };

  // Os dois tetos são o MESMO número: quem corta o resultado é a agregação, não a consulta. Cortar
  // antes de agregar somaria as primeiras cem linhas e chamaria isso de total.
  const outcome = await runWorkflowQuery(query, context, deps, {
    maxScan: REPORT_MAX_SCAN,
    maxResults: REPORT_MAX_SCAN,
  });
  if (!outcome.ok) return { ok: false, error: outcome.error, errorParams: outcome.errorParams, issues };

  /*
   * O filtro por EXPRESSÃO, aplicado entre a varredura e a agregação.
   *
   * Aqui e não dentro do agregador porque ele pode RECUSAR: uma expressão que estoura não vira linha
   * descartada, e o agregador devolve um resultado, nunca um resultado-ou-recusa. O que ele recebe
   * continua sendo o `scanned` da varredura, que é o que responde pela incompletude — o filtro
   * restringe o que entra na conta, não muda quantos documentos foram lidos.
   */
  const now = context.services.now();
  const filtered = filterReportRows({
    spec,
    rows: outcome.value.results,
    entity: resolveQueryTable(spec.dataset.table, schema)?.physicalCollection,
    permissions: context.actor?.permissions,
    now,
  });
  if (!filtered.ok) {
    return { ok: false, error: filtered.error, errorParams: filtered.errorParams, issues };
  }

  const measureFilters: Record<string, ResolvedPredicate[]> = {};
  for (const measure of spec.dataset.measures ?? []) {
    if (isAggregateMeasure(measure) && measure.filter && measure.filter.length > 0) {
      measureFilters[measure.key] = resolvedFilters(measure.filter, context);
    }
  }

  return {
    ok: true,
    issues,
    value: aggregateReportRows({
      spec,
      rows: filtered.rows,
      measureFilters,
      scanned: outcome.value.scanned,
      complete: outcome.value.complete,
      limits: {
        maxGroups: REPORT_MAX_GROUPS,
        maxColumns: REPORT_MAX_COLUMNS,
        maxRecords: REPORT_MAX_RECORDS,
      },
      now,
    }),
  };
};
