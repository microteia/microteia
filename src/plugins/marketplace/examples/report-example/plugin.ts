import type {
  MarketplacePlugin,
  ReportModuleTemplate,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';
import { REPORT_SPEC_VERSION } from '../../../../domain/schema/report/reportSpec';
import { deriveReportRequires } from '../../../../domain/schema/report/reportCapabilities';
import { reportMessagesContribution } from './reportMessages';
import { reportPtBrContribution } from './reportMessagesPtBr';

/**
 * **Reports, by example** — the four shapes a declarative report can take, over one small screen.
 *
 * A report is not a screen and not a view: it is an AFFIRMATION ABOUT A NUMBER, declared as data and
 * executed by the kernel. Nothing below is code, and that is the whole point — a package that only
 * declares reports needs no trust gesture from the office that installs it.
 *
 * The three layers of a `ReportSpec` are separable on purpose, and the separation IS the contract:
 *
 * - `dataset` — where the rows come from, what is grouped and what is measured. It decides the NUMBER.
 * - `shape` — how the number is folded: a list, a summary, a pivot.
 * - `presentation` — what can be removed without making the report wrong: a chart, an export, a
 *   prompt. If taking a property out of here changes a number, it was in the wrong layer.
 *
 * The screen exists only so the reports have something to read. It is deliberately anonymous — an
 * "entry" with an amount, an estimate, a category and a date — because a report example that also
 * taught a business would teach the business instead.
 */

const message = (key: string): string => `@com.microteia.report-example/${key}`;

const ENTRY = message('section.entry');
const AMOUNTS = message('section.amounts');

/**
 * `amount` and `estimate` are two currency fields on the same record, and they are two on purpose:
 * the last report asks whether one passed the other, and comparing a field with ANOTHER FIELD is
 * exactly what a fixed predicate cannot write.
 */
const ENTRY_FIELDS: TemplateField[] = [
  { key: 'label', label: message('field.label'), type: 'text', required: true, order: 0, section: ENTRY, placeholder: message('field.label.placeholder') },
  {
    key: 'category',
    label: message('field.category'),
    type: 'select',
    required: true,
    order: 1,
    section: ENTRY,
    filterable: true,
    optionsColored: true,
    options: [
      { key: 'standard', label: message('field.category.standard'), color: 'info' },
      { key: 'priority', label: message('field.category.priority'), color: 'warning' },
      { key: 'exception', label: message('field.category.exception'), color: 'danger' },
    ],
  },
  { key: 'entryDate', label: message('field.entryDate'), type: 'date', required: true, order: 2, section: ENTRY, filterable: true },
  { key: 'amount', label: message('field.amount'), type: 'currency', required: true, order: 3, section: AMOUNTS },
  { key: 'estimate', label: message('field.estimate'), type: 'currency', required: false, order: 4, section: AMOUNTS },
  { key: 'archived', label: message('field.archived'), type: 'checkbox', required: false, order: 5, section: AMOUNTS, filterable: true },
];

const ENTRY_SCREEN: ScreenModuleTemplate = {
  key: 'reportEntry',
  sourceId: 'microteia:report-example:entry',
  sourceRev: 1,
  titleSingular: message('screen.entry'),
  titlePlural: message('screen.entry.plural'),
  icon: 'fileList',
  fields: ENTRY_FIELDS,
  titleFieldKey: 'label',
  subtitleFieldKey: 'category',
  eventPrefix: 'reportEntry',
};

/**
 * The GROUPED LIST. Every entry stays visible and the list is broken into blocks, with a subtotal
 * under each one.
 *
 * It is not a summary with detail underneath: in a summary the group REPLACES the records — it is
 * the answer — and here it FRAMES them. "How much does each category add up to" and "what is in each
 * category" are different questions, and this is the second one.
 *
 * The dimension that groups is absent from `columns` on purpose: repeating it on every detail line
 * writes the same value under the heading that just said it.
 */
const BY_CATEGORY: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: 'reportEntry',
    dimensions: [
      { key: 'category', path: 'category', label: message('dimension.category') },
      { key: 'label', path: 'label', label: message('dimension.label') },
      { key: 'date', path: 'entryDate', label: message('dimension.date') },
    ],
    measures: [
      { key: 'total', op: 'sum', path: 'amount', label: message('measure.total'), format: { kind: 'currency' } },
    ],
  },
  shape: {
    kind: 'tabular',
    columns: ['label', 'date'],
    groupBy: [{ dimension: 'category', subtotal: true }],
    orderBy: [{ path: 'entryDate', dir: 'desc' }],
  },
  presentation: { export: { csv: true } },
};

/**
 * The SUMMARY, with the chart beside it.
 *
 * `granularity` is the bucket: without it a date dimension produces one group per record, and
 * "totals by month" could not be declared at all. `timeZone` is what keeps the cut from moving —
 * absent, the bucket is cut in UTC, and a month boundary would land on a different day for whoever
 * opens it from another offset.
 *
 * `openTotal` is a FILTERED MEASURE: the restriction belongs to that measure and to nothing else,
 * which is how one line can carry both the whole total and the part of it still open.
 *
 * `openShare` is a COMPUTED MEASURE: an expression over the other measures of the same group, by key,
 * evaluated after aggregation — on every row, subtotal and the grand total. That is what makes it the
 * share of the month and not an average of per-entry shares. It sees measures only, never the record,
 * and a measure it cites does not have to be shown. A `percent` format prints the number as it is,
 * followed by `%`, so the ratio is multiplied by 100 in the expression. A month with nothing in it
 * divides by zero, and that cell comes out empty instead of claiming a number.
 */
const BY_MONTH: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: 'reportEntry',
    dimensions: [
      {
        key: 'month',
        path: 'entryDate',
        label: message('dimension.month'),
        granularity: 'month',
        timeZone: 'UTC',
      },
    ],
    measures: [
      { key: 'total', op: 'sum', path: 'amount', label: message('measure.total'), format: { kind: 'currency' } },
      { key: 'count', op: 'count', label: message('measure.count') },
      {
        key: 'openTotal',
        op: 'sum',
        path: 'amount',
        label: message('measure.open-total'),
        format: { kind: 'currency' },
        filter: [{ path: 'archived', op: 'eq', value: { kind: 'Literal', value: false } }],
      },
      {
        key: 'openShare',
        kind: 'computed',
        expression: 'openTotal / total * 100',
        label: message('measure.open-share'),
        format: { kind: 'percent', decimals: 1 },
      },
    ],
  },
  shape: {
    kind: 'summary',
    groupBy: [{ dimension: 'month' }],
    values: ['total', 'count', 'openTotal', 'openShare'],
    grandTotal: true,
  },
  presentation: {
    chart: { kind: 'column', category: 'month', series: ['total'] },
    export: { csv: true },
  },
};

/**
 * The PIVOT: categories down the side, months across the top.
 *
 * `emptyCell: 'zero'` is a statement, not a style. Blank and zero are different affirmations — one
 * says "there was nothing", the other "there was something and it came to zero" — and choosing
 * between them is the author's job, not the renderer's.
 */
const CATEGORY_BY_MONTH: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: 'reportEntry',
    dimensions: [
      { key: 'category', path: 'category', label: message('dimension.category') },
      {
        key: 'month',
        path: 'entryDate',
        label: message('dimension.month'),
        granularity: 'month',
        timeZone: 'UTC',
      },
    ],
    measures: [
      { key: 'total', op: 'sum', path: 'amount', label: message('measure.total'), format: { kind: 'currency' } },
    ],
  },
  shape: {
    kind: 'matrix',
    rows: [{ dimension: 'category' }],
    columns: [{ dimension: 'month' }],
    values: ['total'],
    grandTotal: true,
    emptyCell: 'zero',
  },
};

/**
 * The one that needed `includeWhen`, and the PROMPT.
 *
 * `where` compares ONE path with ONE value, and that is what makes it cheap: an equality goes down
 * to the store and the scan stays index-free. `includeWhen` is the other half — the question no list
 * of predicates writes: two fields compared with each other, an arithmetic, a date relative to today,
 * an OR between two ANDs. It is evaluated in MEMORY over what the scan brought, so it narrows the
 * result without ever widening what was read.
 *
 * It lives in `dataset` because it changes the NUMBER. That position is the decision: a kernel that
 * cannot run it REFUSES the report by the name of the capability, instead of quietly summing the very
 * rows it was meant to exclude and labelling the total the same way.
 *
 * A field never filled is absent from the document, and an absent name would blow up the evaluator;
 * it reads as null instead. So `estimate` being empty simply does not pass the test — it does not
 * take the report down with it.
 */
const OVER_ESTIMATE: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: 'reportEntry',
    includeWhen: 'amount > estimate',
    dimensions: [
      { key: 'label', path: 'label', label: message('dimension.label') },
      { key: 'category', path: 'category', label: message('dimension.category') },
      { key: 'date', path: 'entryDate', label: message('dimension.date') },
    ],
    measures: [
      { key: 'total', op: 'sum', path: 'amount', label: message('measure.total'), format: { kind: 'currency' } },
      { key: 'categories', op: 'count', path: 'category', distinct: true, label: message('measure.categories') },
    ],
  },
  shape: {
    kind: 'tabular',
    columns: ['label', 'category', 'date'],
    orderBy: [{ path: 'entryDate', dir: 'desc' }],
  },
  /**
   * The prompt is what the READER fills in before the report runs. It is presentation because taking
   * it away leaves a correct report — a wider one, but not a wrong one.
   */
  presentation: {
    prompts: [{ key: 'from', label: message('prompt.from'), path: 'entryDate', op: 'gte' }],
    export: { csv: true },
  },
};

/**
 * `requires` is DERIVED, never written by hand — the same rule that governs every generated claim
 * about the kernel in this repository.
 *
 * It is the list of capabilities the report needs from whoever executes it, and it exists so an old
 * kernel can refuse BY THE NAME of what it lacks instead of running the report without it. Writing it
 * by hand has exactly one failure mode, and it is the dangerous one: a `requires` written SHORT is
 * preferred over the derivation, so the missing capability stops being announced and the report runs
 * without it. The package gate refuses that omission — and calling the function is how you never
 * meet it.
 */
const report = (
  templateId: string,
  key: string,
  icon: string,
  spec: ReportSpec,
): ReportModuleTemplate => ({
  templateId,
  key,
  title: message(`report.${templateId}`),
  description: message(`report.${templateId}.description`),
  icon,
  origin: 'plugin',
  sourceId: `microteia:report-example:${templateId}`,
  sourceRev: 1,
  managed: true,
  enabled: true,
  spec: { ...spec, requires: deriveReportRequires(spec) },
});

export const reportExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.report-example',
    version: '1.1.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    contributes: [
      reportMessagesContribution(),
      reportPtBrContribution(),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [ENTRY_SCREEN],
  reports: [
    report('by-category', 'entries-by-category', 'fileList', BY_CATEGORY),
    report('by-month', 'entry-totals-by-month', 'barChart', BY_MONTH),
    report('category-by-month', 'entry-category-by-month', 'barChartBox', CATEGORY_BY_MONTH),
    report('over-estimate', 'entries-over-estimate', 'fileSearch', OVER_ESTIMATE),
  ],
};
