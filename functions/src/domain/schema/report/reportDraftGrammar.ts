// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportDraftGrammar.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportDraftGrammar.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { NUMERIC_AGGREGATION_OPS } from '../fieldRules';
import { FIELD_EXPRESSION_FUNCTION_NAMES, FIELD_EXPRESSION_OPERATOR_FUNCTIONS } from '../fieldExpression';
import { QUERY_OPERATORS } from '../querySpec';
import { REPORT_CAPABILITIES } from './reportCapabilities';
import { REPORT_PERIODS, REPORT_PROMPT_PERIOD_CONTROL } from './reportPeriod';
import {
  REPORT_CHART_KINDS,
  REPORT_GRANULARITIES,
  REPORT_HIGHLIGHT_OPS,
  REPORT_HIGHLIGHT_TONES,
  REPORT_SPEC_VERSION,
} from './reportSpec';

const list = (values: readonly string[]): string => values.map((value) => JSON.stringify(value)).join(' | ');

/**
 * O que a IA aprende de cada capacidade do relatório — uma linha por token de `REPORT_CAPABILITIES`.
 *
 * Existe porque o rascunho por IA tinha a SUA descrição do relatório, escrita à mão no prompt, e ela
 * ficou para trás no primeiro recurso novo: o filtro fixo existia, o prompt não o ensinava, e "as
 * faturas em aberto" virava "todas as faturas". Aqui cada capacidade TEM de aparecer — há teste —, e
 * a lista de valores de cada uma vem da constante que o executor lê, nunca de uma cópia.
 *
 * `null` é uma decisão, não um esquecimento: a capacidade existe mas não é do rascunho (a exportação
 * é escolha de quem lê; o detalhamento já vem ligado).
 */
export const REPORT_DRAFT_TEACHING: Readonly<Record<string, string | null>> = {
  'dataset.collection':
    `"dataset.table" is one collection below. "dataset.where" is the FIXED filter: [{ "path": "<field>", "op": ${list(QUERY_OPERATORS)}, "value": { "kind": "Literal", "value": <value> } }] — "exists" takes no value.`,
  'dataset.includeWhen':
    '"dataset.includeWhen" is a filter EXPRESSION on the record, true keeps it — for what "where" cannot say: two fields compared, a date relative to today, an "or". Fields by key, a reference navigated as "<refField>.<field>".',
  'dataset.dimension.expression':
    'A computed dimension: { "key", "label", "expression": "<expression on the record>" } instead of "path" — e.g. days overdue.',
  'dimension.buckets':
    'Numeric ranges on a dimension: "buckets": [{ "key": "<id>", "label": "<text>", "lt": <exclusive upper limit> }, …], the last without "lt" — e.g. aging 0–30, 31–60, 61–90, 90+.',
  'dimension.granularity':
    `A date dimension groups by "granularity": ${list(REPORT_GRANULARITIES)}.`,
  'dimension.sort.measure':
    'Top N: on a dimension, "sort": { "by": "<measure key>", "dir": "desc" } with "limit": <n>.',
  'dimension.others':
    'With "limit", "others": true keeps the rest as one "Others" group, so the rows still add up to the total.',
  'measure.aggregate':
    `A measure: { "key", "label", "op": ${list(NUMERIC_AGGREGATION_OPS)}, "path": "<numeric field>" } — "count" takes no path.`,
  'measure.distinct':
    '"distinct": true on a "count" with "path" counts different values instead of records.',
  'measure.filter':
    'A measure restricted on its own: "filter": [<same predicates as dataset.where>] — e.g. the paid total next to the total.',
  'measure.computed':
    'A computed measure: { "key", "label", "kind": "computed", "expression": "<expression on OTHER measure keys>" } — a ratio, a percentage, an average ticket. It never sees the record.',
  'shape.tabular':
    '"tabular" lists records: { "kind": "tabular", "columns": ["<dimension key>", …] }.',
  'shape.tabular.group':
    'A tabular list split into groups that frame the records: "groupBy": [{ "dimension": "<key>" }].',
  'shape.summary':
    '"summary" answers totals by group: { "kind": "summary", "groupBy": [{ "dimension": "<key>" }, …], "values": ["<measure key>", …] }.',
  'shape.matrix':
    '"matrix" crosses two groupings: { "kind": "matrix", "rows": [{ "dimension": "<key>" }], "columns": [{ "dimension": "<key>" }], "values": ["<measure key>"] }.',
  'shape.subtotal':
    'A grouping level takes "subtotal": true.',
  'presentation.chart':
    `"presentation.chart": { "kind": ${list(REPORT_CHART_KINDS)} } — it draws the first grouping level; a tabular list without groupBy has no chart.`,
  'presentation.chart.split':
    '"splitBy": "<dimension key>" in the chart turns a second grouping into the legend.',
  'presentation.highlight':
    `"presentation.highlight": [{ "measure": "<key>", "op": ${list(REPORT_HIGHLIGHT_OPS)}, "value": <number>, "tone": ${list(REPORT_HIGHLIGHT_TONES)} }] — for "mark in red when…".`,
  'presentation.prompt':
    `"presentation.prompts": filters the READER answers: [{ "key", "label", "path", "op": ${list(QUERY_OPERATORS)} }] — use them when the request says "by client of my choice", never for a fixed restriction.`,
  'presentation.prompt.period':
    `A relative period the reader picks: { "key", "label", "path": "<date field>", "op": "eq", "control": "${REPORT_PROMPT_PERIOD_CONTROL}", "default": { "kind": "Literal", "value": ${list(REPORT_PERIODS)} } } — "this month", "last 30 days" go here.`,
  'presentation.prompt.default':
    'A prompt\'s "default": { "kind": "Literal", "value": <value> } answers it when the reader does not.',
  'presentation.prompt.required':
    '"required": true on a prompt makes the reader answer before it runs.',
  'presentation.drilldown': null,
  'export.csv': null,
  'export.filename': null,
  'export.pdf': null,
  'export.xlsx': null,
};

/**
 * A gramática do `ReportSpec` que a IA recebe, MONTADA a partir de `REPORT_DRAFT_TEACHING`, na ordem
 * de `REPORT_CAPABILITIES` — a ordem que o executor anuncia.
 */
export const reportDraftGrammar = (): string => [
  `ReportSpec: { "v": ${REPORT_SPEC_VERSION}, "dataset": { "table", "where"?, "includeWhen"?, "dimensions": [{ "key", "path", "label" }], "measures": [...] }, "shape": {...}, "presentation"?: {...} }`,
  'Keys are identifiers (letters, digits, _); "shape" and "presentation" cite dimensions and measures by KEY, never by path.',
  '',
  ...REPORT_CAPABILITIES
    .map((capability) => REPORT_DRAFT_TEACHING[capability])
    .filter((line): line is string => typeof line === 'string')
    .map((line) => `- ${line}`),
  '',
  `Expressions: functions ${[...FIELD_EXPRESSION_FUNCTION_NAMES, ...FIELD_EXPRESSION_OPERATOR_FUNCTIONS].sort().join(', ')}; operators + - * / == != > >= < <= and or not, "? :".`,
].join('\n');
