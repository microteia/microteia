import { HttpsError } from 'firebase-functions/v2/https';
import { requirePermission } from '../handlers/shared/requirePermission';
import { exactTotalsPlan, withExactTotals } from '../../domain/schema/report/reportExactTotals';
import { keepByRelated, relatedParentIds, relatedQuery } from '../../domain/schema/report/reportRelated';
import type { ResolvedRelated } from '../../domain/schema/report/reportRelated';
import type { CallerAuth } from '../handlers/shared/requirePermission';
import { resolveMapping } from '../../domain/engine/InputMapping';
import { businessCalendarsFor } from '../../domain/services/businessCalendarScope';
import { mentionsBusinessDays } from '../../domain/schema/time/businessDays';
import type { WorkflowContext } from '../../domain/entities/WorkflowContext';
import type { SchemaContext } from '../../domain/schema/pathResolver';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import type { QueryPredicate, QuerySpec } from '../../domain/schema/querySpec';
import type { ResolvedPredicate } from '../../domain/schema/predicateMatch';
import { matchesResolvedPredicates } from '../../domain/schema/predicateMatch';
import {
  REPORT_SNAPSHOT_MAX_SERIES,
  isSnapshotReport,
  reportAccessPermissions,
  reportSeriesInfo,
  snapshotReportView,
  snapshotSchemaContext,
  snapshotSeriesRows,
} from '../../domain/schema/report/reportSnapshot';
import type { IReportDefinitionReader } from '../../domain/repositories/IReportDefinitionReader';
import type { IReportSnapshotRepository } from '../../domain/repositories/IReportSnapshotRepository';
import { aggregateReportRows, drillReportRows } from '../../domain/schema/report/aggregateRows';
import type { ReportDrillResult, ReportDrillTarget } from '../../domain/schema/report/aggregateRows';
import { filterReportRows, filterRowsByExpression } from '../../domain/schema/report/reportRowFilter';
import { materializeReportDimensions } from '../../domain/schema/report/reportComputedDimension';
import type { ReportResult } from '../../domain/schema/report/reportResult';
import {
  buildReportQuery,
  isAggregateMeasure,
  reportDrillEnabled,
} from '../../domain/schema/report/reportSpec';
import type { ReportPrompt, ReportSpec } from '../../domain/schema/report/reportSpec';
import {
  isReportPeriod,
  REPORT_PROMPT_PERIOD_CONTROL,
  reportPeriodRange,
} from '../../domain/schema/report/reportPeriod';
import { dayInTimeZone } from '../../domain/schema/i18n/timeZone';
import { hasBlockingReportIssue, validateReportSpec } from '../../domain/schema/report/validateReportSpec';
import type { ReportSpecIssue } from '../../domain/schema/report/validateReportSpec';
import { runWorkflowQuery } from '../workflow/query/runWorkflowQuery';
import type { WorkflowQueryDeps, WorkflowQueryResult } from '../workflow/query/runWorkflowQuery';
import {
  REPORT_MAX_COLUMNS,
  REPORT_MAX_GROUPS,
  REPORT_MAX_RECORDS,
  REPORT_MAX_SCAN,
} from './reportLimits';

export type ReportOutcome =
  | { ok: true; value: ReportResult; issues: ReportSpecIssue[]; drill?: ReportDrillResult }
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string>; issues?: ReportSpecIssue[] };

/**
 * Cobra, no SERVIDOR, tudo o que ver o relatório exige (`reportRequiredPermissions`): a permissão
 * PRÓPRIA dele, quando declarada, e a leitura de cada coleção que ele toca.
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
export const requireReportAccess = async (
  spec: ReportSpec,
  ctx: SchemaContext,
  tenantId: string,
  caller: CallerAuth,
  reports?: IReportDefinitionReader,
): Promise<string[]> => {
  // A série cobra as permissões do relatório de ORIGEM. Sem como lê-lo, recusa: falha fechada.
  const source = isSnapshotReport(spec) && reports ? (await reports.find(tenantId, spec.dataset.table))?.spec : undefined;
  const required = reportAccessPermissions(spec, ctx, source);
  if (required === null) {
    throw new HttpsError('permission-denied', '@core.reports/snapshot.source-missing', { messageParams: { report: spec.dataset.table } });
  }
  let granted: string[] = [];
  for (const permission of required) {
    granted = await requirePermission(tenantId, caller, permission);
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
 * A resposta EFETIVA de um filtro: a que o leitor deu, ou o `default` quando ele não mandou a chave.
 *
 * Chave ausente e chave vazia são perguntas diferentes, e é essa diferença que deixa o leitor limpar
 * o padrão: quem apagou "este mês" mandou o filtro vazio — sem restrição —, e o padrão não volta por
 * cima dele. Quem não mandou nada (o MCP, um widget, a primeira abertura) recebe o recorte que o
 * autor escolheu.
 */
const promptAnswer = (
  prompt: ReportPrompt,
  values: Record<string, unknown>,
  context: WorkflowContext,
): unknown => {
  if (Object.prototype.hasOwnProperty.call(values, prompt.key)) return values[prompt.key];
  return prompt.default ? resolveMapping(prompt.default, context) : undefined;
};

/**
 * Os predicados que o LEITOR preencheu, na forma que o resto do caminho já entende.
 *
 * Entram como `Literal` de propósito: assim eles passam pelo MESMO `resolveMapping` do filtro fixo,
 * e não existe um segundo jeito de um valor chegar a uma consulta.
 *
 * O filtro de PERÍODO vira dois predicados sobre DIAS (`gte` o primeiro, `lt` o dia seguinte ao
 * último), contados a partir de hoje no fuso do escritório. Dias, e não instantes, porque é como o
 * comparador entende uma data sem hora: o dia inteiro, e não a meia-noite dele.
 */
const promptPredicates = (
  spec: ReportSpec,
  values: Record<string, unknown>,
  context: WorkflowContext,
): QueryPredicate[] => {
  const today = dayInTimeZone(context.services.now(), context.services.timeZone ?? '');
  return (spec.presentation?.prompts ?? []).flatMap((prompt): QueryPredicate[] => {
    const value = promptAnswer(prompt, values, context);
    if (!answered(value)) return [];

    if (prompt.control === REPORT_PROMPT_PERIOD_CONTROL) {
      const range = isReportPeriod(value) ? reportPeriodRange(value, today) : null;
      if (!range) return [];
      return [
        { path: prompt.path, op: 'gte', value: { kind: 'Literal', value: range.from } },
        { path: prompt.path, op: 'lt', value: { kind: 'Literal', value: range.until } },
      ];
    }

    return [{ path: prompt.path, op: prompt.op, value: { kind: 'Literal', value } }];
  });
};

/**
 * Os filtros OBRIGATÓRIOS que ficaram sem resposta — nem a do leitor, nem o padrão.
 *
 * É recusa, e não aviso, porque é a razão de o autor ter marcado o filtro: o relatório sem ele é
 * outra pergunta (o ano todo em vez do mês, todos os clientes em vez de um), e respondê-la com o
 * título da primeira é um número plausível e errado.
 */
const missingRequiredPrompts = (
  spec: ReportSpec,
  values: Record<string, unknown>,
  context: WorkflowContext,
): string[] =>
  (spec.presentation?.prompts ?? [])
    .filter((prompt) => prompt.required === true && !answered(promptAnswer(prompt, values, context)))
    .map((prompt) => prompt.key);

export interface RunReportInput {
  spec: ReportSpec;
  context: WorkflowContext;
  deps: WorkflowQueryDeps;
  prompts?: Record<string, unknown>;
  /**
   * O recorte que o leitor clicou. Passa pelo MESMO caminho do número — mesma varredura, mesmos
   * filtros, mesma visibilidade por registro —, e é por isso que o detalhe nunca mostra um registro que
   * o total não contou.
   */
  drill?: ReportDrillTarget;
  /** De onde vem a série de um relatório de instantâneos. Sem isto, o relatório da série é recusado. */
  series?: ReportSeriesDeps;
}

export interface ReportSeriesDeps {
  reports: IReportDefinitionReader;
  snapshots: IReportSnapshotRepository;
}

/**
 * Executa o relatório: valida, busca as linhas e agrega.
 *
 * A agregação em si é FUNÇÃO PURA e mora no domínio compartilhado — é o que faz a pré-visualização
 * da autoria devolver exatamente o número que isto devolve, sem uma segunda implementação, e o que
 * deixa um executor paginado de amanhã reusá-la sem mudar a forma da resposta.
 */
export const runReportQuery = async ({
  spec: requested,
  context,
  deps,
  prompts,
  drill,
  series: seriesDeps,
}: RunReportInput): Promise<ReportOutcome> => {
  const tenantId = context.execution.tenantId;
  const baseSchema = await deps.screenProvider.getSchemaContext(tenantId);

  /*
   * A SÉRIE de instantâneos: a partir daqui ela é um relatório de coleção — a coleção sintética das fotos
   * do relatório de origem —, e tudo o que segue (validação, filtros, dimensões calculadas, agregação) é o
   * caminho de sempre. Só a leitura muda: as fotos vêm do repositório, e os filtros são aplicados em memória.
   */
  let spec = requested;
  let schema = baseSchema;
  let snapshots: Awaited<ReturnType<IReportSnapshotRepository['series']>> | null = null;
  if (isSnapshotReport(requested)) {
    if (!seriesDeps) return { ok: false, error: '@core.reports/snapshot.unavailable' };
    const source = await seriesDeps.reports.find(tenantId, requested.dataset.table);
    if (!source) {
      return { ok: false, error: '@core.reports/snapshot.source-missing', errorParams: { report: requested.dataset.table } };
    }
    if (isSnapshotReport(source.spec)) return { ok: false, error: '@core.reports/snapshot.of-series' };
    schema = snapshotSchemaContext(baseSchema, requested.dataset.table, source.spec, source.title);
    spec = snapshotReportView(requested);
    snapshots = await seriesDeps.snapshots.series(tenantId, source.key, REPORT_SNAPSHOT_MAX_SERIES);
  }

  const issues = validateReportSpec(spec, { schema, scanCeiling: REPORT_MAX_SCAN });
  if (hasBlockingReportIssue(issues)) {
    return {
      ok: false,
      error: '@core.reports/spec.invalid',
      errorParams: { detail: issues.map((issue) => `${issue.field}: ${issue.error}`).join('; ') },
      issues,
    };
  }

  const missing = missingRequiredPrompts(spec, prompts ?? {}, context);
  if (missing.length > 0) {
    return {
      ok: false,
      error: '@core.reports/prompt.required.missing',
      errorParams: { keys: missing.join(', ') },
      issues,
    };
  }

  const base = buildReportQuery(spec, REPORT_MAX_SCAN);
  const query: QuerySpec = {
    ...base,
    where: [...base.where, ...promptPredicates(spec, prompts ?? {}, context)],
  };

  // Os dois tetos são o MESMO número: quem corta o resultado é a agregação, não a consulta. Cortar
  // antes de agregar somaria as primeiras cem linhas e chamaria isso de total.
  const outcome: { ok: true; value: WorkflowQueryResult } | { ok: false; error: string; errorParams?: Record<string, string> } = snapshots
    ? seriesScan(snapshots, query, context)
    : await runWorkflowQuery(query, context, deps, {
      maxScan: REPORT_MAX_SCAN,
      maxResults: REPORT_MAX_SCAN,
    });
  if (!outcome.ok) return { ok: false, error: outcome.error, errorParams: outcome.errorParams, issues };
  if (snapshots && reportSeriesInfo(snapshots).definitionChanged) {
    issues.push({ field: 'dataset.table', error: '@core.reports/snapshot.definition-changed', severity: 'warning' });
  }

  /*
   * O filtro por EXPRESSÃO, aplicado entre a varredura e a agregação.
   *
   * Aqui e não dentro do agregador porque ele pode RECUSAR: uma expressão que estoura não vira linha
   * descartada, e o agregador devolve um resultado, nunca um resultado-ou-recusa. O que ele recebe
   * continua sendo o `scanned` da varredura, que é o que responde pela incompletude — o filtro
   * restringe o que entra na conta, não muda quantos documentos foram lidos.
   */
  const now = context.services.now();
  const rowContext = {
    spec,
    entity: resolveQueryTable(spec.dataset.table, schema)?.physicalCollection,
    permissions: context.actor?.permissions,
    now,
    timeZone: context.services.timeZone,
    businessCalendars: await businessCalendarsFor(
      context.services,
      context.execution.tenantId,
      mentionsBusinessDays(JSON.stringify([
        spec.dataset.includeWhen ?? '',
        ...(spec.dataset.dimensions ?? []).map((dimension) => dimension.expression ?? ''),
      ])),
    ),
  };
  const kept = filterReportRows({ ...rowContext, rows: outcome.value.results });
  if (!kept.ok) {
    return { ok: false, error: kept.error, errorParams: kept.errorParams, issues };
  }

  /*
   * Com ou SEM relacionados (`dataset.related`): uma leitura por entrada, com o filtro fixo dela no banco
   * e a expressão em memória — sobre o RELACIONADO, como o leitor o vê (a mesma visibilidade por
   * registro). O relacionado que a varredura não alcançou deixa o resultado PARCIAL: num "sem pedido",
   * um pedido não lido é um cliente contado a mais, e isso precisa estar dito na tela.
   */
  const resolvedRelated: ResolvedRelated[] = [];
  let relatedComplete = true;
  for (const related of spec.dataset.related ?? []) {
    const read = await runWorkflowQuery(relatedQuery(related, REPORT_MAX_SCAN), context, deps, {
      maxScan: REPORT_MAX_SCAN,
      maxResults: REPORT_MAX_SCAN,
    });
    if (!read.ok) return { ok: false, error: read.error, errorParams: read.errorParams, issues };
    const matching = filterRowsByExpression(related.includeWhen, {
      ...rowContext,
      entity: resolveQueryTable(related.table, schema)?.physicalCollection,
      rows: read.value.results,
    });
    if (!matching.ok) return { ok: false, error: matching.error, errorParams: matching.errorParams, issues };
    relatedComplete = relatedComplete && read.value.complete;
    resolvedRelated.push({ mode: related.mode, ids: relatedParentIds(matching.rows, related.via) });
  }

  // As dimensões calculadas, uma vez por linha e depois do filtro — o que ele descartou não é calculado.
  const filtered = materializeReportDimensions({ ...rowContext, rows: keepByRelated(kept.rows, resolvedRelated) });
  if (!filtered.ok) {
    return { ok: false, error: filtered.error, errorParams: filtered.errorParams, issues };
  }

  const measureFilters: Record<string, ResolvedPredicate[]> = {};
  for (const measure of spec.dataset.measures ?? []) {
    if (isAggregateMeasure(measure) && measure.filter && measure.filter.length > 0) {
      measureFilters[measure.key] = resolvedFilters(measure.filter, context);
    }
  }

  // O relatório que desligou o detalhamento não o serve por outra porta: a tela esconde o gesto, e a
  // callable recusa o pedido feito à mão.
  if (drill && !reportDrillEnabled(spec)) {
    return { ok: false, error: '@core.reports/drill.disabled', issues };
  }

  const aggregated = aggregateReportRows({
    spec,
    rows: filtered.rows,
    measureFilters,
    scanned: outcome.value.scanned,
    complete: outcome.value.complete && relatedComplete,
    limits: {
      maxGroups: REPORT_MAX_GROUPS,
      maxColumns: REPORT_MAX_COLUMNS,
      maxRecords: REPORT_MAX_RECORDS,
    },
    now,
  });

  return {
    ok: true,
    issues,
    ...(drill
      ? {
          drill: drillReportRows({
            spec,
            rows: filtered.rows,
            target: drill,
            measureFilters,
            maxRecords: REPORT_MAX_RECORDS,
          }),
        }
      : {}),
    value: snapshots
      ? { ...aggregated, series: reportSeriesInfo(snapshots) }
      : await withTotalsFromDatabase(aggregated, spec, schema, outcome.value, tenantId, deps),
  };
};

/**
 * A "varredura" da série: as linhas de cada foto, com os filtros fixos e os do leitor aplicados em memória —
 * a série inteira já é pequena (`REPORT_SNAPSHOT_MAX_SERIES` fotos de no máximo
 * `REPORT_SNAPSHOT_MAX_GROUPS` grupos). Completa quando não ficou foto mais antiga para trás.
 */
const seriesScan = (
  snapshots: Parameters<typeof snapshotSeriesRows>[0],
  query: QuerySpec,
  context: WorkflowContext,
): { ok: true; value: WorkflowQueryResult } => {
  const rows = snapshotSeriesRows(snapshots);
  const filters = resolvedFilters(query.where ?? [], context);
  const results = rows.filter((row) => matchesResolvedPredicates(row, filters));
  const complete = snapshots.length < REPORT_SNAPSHOT_MAX_SERIES;
  return {
    ok: true,
    value: { count: results.length, results, first: results[0] ?? null, scanned: rows.length, complete, hasMore: !complete, cursor: null },
  };
};

/**
 * O total pedido ao BANCO quando a varredura não alcançou tudo — e só então. O relatório que cabe no teto
 * continua exatamente como sempre foi; o que hoje sai marcado como parcial ganha o total de todos os
 * registros (`totalsExact`), com os grupos ainda da varredura.
 *
 * Só quando o banco responde com o MESMO número: os filtros desceram todos (`pushdown`) e o relatório não
 * pede nada que só a memória faz (`exactTotalsPlan`). Uma agregação que falha deixa o total parcial de
 * antes — pior seria trocar um parcial dito por um erro.
 */
const withTotalsFromDatabase = async (
  result: ReportResult,
  spec: ReportSpec,
  schema: SchemaContext,
  scan: WorkflowQueryResult,
  tenantId: string,
  deps: WorkflowQueryDeps,
): Promise<ReportResult> => {
  if (result.complete || !result.totals || !scan.pushdown || !deps.queryRepository.aggregateByEquality) return result;
  const plan = exactTotalsPlan(spec, schema);
  if (!plan) return result;
  try {
    const exact = await deps.queryRepository.aggregateByEquality(tenantId, scan.pushdown.collection, scan.pushdown.filters, plan);
    return withExactTotals(result, spec, exact);
  } catch {
    return result;
  }
};
