// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportStep.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkflowParameter } from '../../entities/Workflow';
import { isAggregateMeasure } from './reportSpec';
import type { ReportSpec } from './reportSpec';
import type { ReportResult } from './reportResult';
import { REPORT_PERIODS, REPORT_PROMPT_PERIOD_CONTROL } from './reportPeriod';
import type { ReportPeriod } from './reportPeriod';

export const RUN_REPORT_STEP_ID = 'run-report';

/**
 * O kernel a partir do qual existe o passo `run-report`. Um pacote que admite kernel anterior
 * instalaria um fluxo que reprova no primeiro passo.
 */
export const WORKFLOW_RUN_REPORT_SINCE_KERNEL = '2.111.0';

/**
 * Quantas linhas de grupo o passo publica. As saídas de um passo moram no histórico da execução, e o
 * histórico é UM documento: um relatório de mil grupos estouraria o documento para servir a uma
 * mensagem que ninguém lê até o fim. Quem precisa do detalhe abre o relatório pelo `link`.
 */
export const RUN_REPORT_MAX_ROWS = 100;

/** O kernel a partir do qual o passo grava o relatório em arquivo (`file`) e publica a tabela legível. */
export const REPORT_FILE_SINCE_KERNEL = '2.119.0';

/** O arquivo que o passo grava em Downloads, quando pedido. */
export const REPORT_FILE_FORMATS = ['xlsx', 'csv', 'pdf'] as const;
export type ReportFileFormat = typeof REPORT_FILE_FORMATS[number];

export const isReportFileFormat = (value: unknown): value is ReportFileFormat =>
  typeof value === 'string' && (REPORT_FILE_FORMATS as readonly string[]).includes(value);

/** O endereço da aba do relatório — o mesmo `rep:` que o ⌘K e o painel usam. */
export const reportTabLink = (key: string): string => `rep:${key}`;

export interface RunReportStepOutputs {
  /** A PRIMEIRA medida no total: é a pergunta da maioria dos relatórios, e o alvo natural de um alerta. */
  total: number | null;
  /** Chave de medida → valor no total. */
  totals: Record<string, number | null>;
  /** Registros que entraram na conta. */
  count: number;
  /** Grupos do nível mais fundo (ou registros, na lista simples). */
  groups: number;
  /** Uma linha por grupo: a chave de cada dimensão, cada medida e a contagem. */
  rows: Record<string, unknown>[];
  /** As linhas foram cortadas em `RUN_REPORT_MAX_ROWS`. */
  rowsTruncated: boolean;
  complete: boolean;
  scanned: number;
}

/**
 * O resultado do relatório na forma que um PASSO seguinte lê — `output.<passo>.total`,
 * `output.<passo>.totals.<medida>`.
 *
 * Achatado de propósito: a linha do agregador carrega níveis, subtotais e células de pivô, que são da
 * apresentação. Um fluxo pergunta "quanto deu" e "em quais grupos", e é isso que sai daqui. As chaves
 * saem CRUAS (a opção `pending`, o id do cliente): traduzi-las é da tela de quem lê, e o aviso leva ao
 * relatório pelo `link` exatamente por isso.
 */
export const runReportStepOutputs = (spec: ReportSpec, result: ReportResult): RunReportStepOutputs => {
  const totals = result.totals?.values ?? {};
  const firstMeasure = (spec.dataset.measures ?? []).find(isAggregateMeasure)?.key
    ?? (spec.dataset.measures ?? [])[0]?.key;
  const total = firstMeasure !== undefined ? totals[firstMeasure] ?? null : null;

  const deepest = result.rows.reduce((max, row) => (row.subtotal ? max : Math.max(max, row.level)), 0);
  const leaves = result.records && result.rows.length === 0
    ? result.records
    : result.rows
      .filter((row) => !row.subtotal && row.level === deepest)
      .map((row) => ({
        ...Object.fromEntries(row.keys.map((key) => [key.dimension, key.key])),
        ...row.values,
        count: row.count,
      }));

  return {
    total,
    totals: { ...totals },
    count: result.totals?.count ?? leaves.length,
    groups: leaves.length,
    rows: leaves.slice(0, RUN_REPORT_MAX_ROWS),
    rowsTruncated: leaves.length > RUN_REPORT_MAX_ROWS,
    complete: result.complete && result.completeGroups,
    scanned: result.scanned,
  };
};

/**
 * A REFERÊNCIA do nome de cada período — as mesmas chaves da barra de filtros do relatório. Tabela
 * literal, e não montada, para que `verify-messages` confira cada uma: um período novo sem nome
 * reprova aqui, pelo tipo, e não como uma opção em branco no editor.
 */
const PERIOD_LABEL_REFS: Record<ReportPeriod, string> = {
  'today': '@core.reports/period.today',
  'yesterday': '@core.reports/period.yesterday',
  'this-week': '@core.reports/period.this-week',
  'last-week': '@core.reports/period.last-week',
  'this-month': '@core.reports/period.this-month',
  'last-month': '@core.reports/period.last-month',
  'this-quarter': '@core.reports/period.this-quarter',
  'last-quarter': '@core.reports/period.last-quarter',
  'this-year': '@core.reports/period.this-year',
  'last-year': '@core.reports/period.last-year',
  'last-7-days': '@core.reports/period.last-7-days',
  'last-30-days': '@core.reports/period.last-30-days',
  'last-90-days': '@core.reports/period.last-90-days',
  'year-to-date': '@core.reports/period.year-to-date',
};

/**
 * Os filtros do relatório como PARÂMETROS do passo — é o que faz o editor mostrar um campo por filtro,
 * no mesmo molde dos parâmetros de "Chamar Workflow", em vez de pedir um objeto escrito à mão.
 *
 * O de período vira uma lista fechada dos períodos: é a única resposta que o servidor aceita ali, e um
 * texto livre seria um relatório que roda sem filtro por causa de um acento.
 */
export const reportPromptParameters = (spec: ReportSpec): WorkflowParameter[] =>
  (spec.presentation?.prompts ?? []).map((prompt): WorkflowParameter => ({
    key: prompt.key,
    label: prompt.label ?? prompt.key,
    ...(prompt.control === REPORT_PROMPT_PERIOD_CONTROL
      ? {
          type: 'select' as const,
          options: REPORT_PERIODS.map((period) => ({ value: period, label: PERIOD_LABEL_REFS[period] })),
        }
      : { type: 'String' as const }),
    // O padrão do relatório responde quando o passo não manda nada: o filtro só é obrigatório aqui
    // quando nem o autor do relatório o respondeu.
    ...(prompt.required === true && !prompt.default ? { required: true } : {}),
  }));
