import type {
  MarketplacePlugin,
  ReportModuleTemplate,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';
import { REPORT_SPEC_VERSION } from '../../../../domain/schema/report/reportSpec';
import { deriveReportRequires } from '../../../../domain/schema/report/reportCapabilities';
import { mergeViewSources } from '../../../../sdk/mergeSources';
import OVERVIEW_VIEW from './views/Overview.view.tsx?raw';
import OVERVIEW_VIEWMODEL from './views/Overview.viewmodel.tsx?raw';
import OVERVIEW_STYLES from './views/Overview.styles.tsx?raw';
import { reportViewMessagesContribution } from './reportViewMessages';
import { reportViewPtBrContribution } from './reportViewMessagesPtBr';

/**
 * **A report drawn in code, by example** — the body of a report tab, written by the extension.
 *
 * | What | How |
 * |---|---|
 * | the report draws its tab with a view | `reports[].view: '<views[].key>'` — a view of THIS package |
 * | the view reads the report the tab ran | `useReportFrame()` from `@microteia/report` |
 * | the view asks for other answers | `frame.run({ <prompt key>: value })` — the tab runs, not the view |
 * | the chart and the table | `ReportChart` / `ReportTable` with `frame.report.spec` and `frame.result` |
 *
 * Read `report-example` first: it is the report as DATA, and every word there holds here. This
 * example adds the one thing a declaration cannot say — how the tab looks — and pays for it the way
 * all code pays: the package carries a view, so the organization has to trust it before it runs.
 * Until then, or on a kernel older than 2.138.0, the same report opens with the standard body. That is
 * why the report still declares its prompt and its chart: they are what that body draws, and what the
 * agent, an automation and a subscription see — none of them renders this view.
 */

const message = (key: string): string => `@com.microteia.report-view-example/${key}`;

const ENTRY_FIELDS: TemplateField[] = [
  { key: 'label', label: message('field.label'), type: 'text', required: true, order: 0 },
  {
    key: 'category',
    label: message('field.category'),
    type: 'select',
    required: true,
    order: 1,
    filterable: true,
    optionsColored: true,
    options: [
      { key: 'standard', label: message('field.category.standard'), color: 'info' },
      { key: 'priority', label: message('field.category.priority'), color: 'warning' },
      { key: 'exception', label: message('field.category.exception'), color: 'danger' },
    ],
  },
  { key: 'entryDate', label: message('field.entryDate'), type: 'date', required: true, order: 2, filterable: true },
  { key: 'amount', label: message('field.amount'), type: 'currency', required: true, order: 3 },
];

const ENTRY_SCREEN: ScreenModuleTemplate = {
  key: 'reportViewEntry',
  sourceId: 'microteia:report-view-example:entry',
  sourceRev: 1,
  titleSingular: message('screen.entry'),
  titlePlural: message('screen.entry.plural'),
  icon: 'fileList',
  fields: ENTRY_FIELDS,
  titleFieldKey: 'label',
  subtitleFieldKey: 'category',
  eventPrefix: 'reportViewEntry',
};

/**
 * The report is a complete declaration on its own — open it without the view and it is still right.
 *
 * `average` is a COMPUTED measure, and that is the rule the view lives by: the headline shows it, but
 * the number is the report's. Dividing in the view would put on screen a figure the CSV, the agent and
 * the automation never see.
 *
 * The `period` prompt is answered by the view's buttons, and the tab hides the standard prompt bar while
 * the view is drawn. The `default` still matters: the tab runs the report on opening with it, and the
 * view lights the matching button from the answers the tab remembers.
 */
const OVERVIEW: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: 'reportViewEntry',
    dimensions: [
      { key: 'category', path: 'category', label: message('dimension.category') },
    ],
    measures: [
      { key: 'total', op: 'sum', path: 'amount', label: message('measure.total'), format: { kind: 'currency' } },
      { key: 'count', op: 'count', label: message('measure.count') },
      {
        key: 'average',
        kind: 'computed',
        expression: 'total / count',
        label: message('measure.average'),
        format: { kind: 'currency' },
      },
    ],
  },
  shape: {
    kind: 'summary',
    groupBy: [{ dimension: 'category' }],
    values: ['total', 'count', 'average'],
    grandTotal: true,
  },
  presentation: {
    chart: { kind: 'bar', category: 'category', series: ['total'] },
    prompts: [{
      key: 'period',
      label: message('prompt.period'),
      path: 'entryDate',
      op: 'gte',
      control: 'period',
      default: { kind: 'Literal', value: 'this-year' },
    }],
    export: { csv: true },
  },
};

const OVERVIEW_REPORT: ReportModuleTemplate = {
  templateId: 'overview',
  key: 'entries-overview',
  title: message('report.overview'),
  description: message('report.overview.description'),
  icon: 'barChart',
  origin: 'plugin',
  sourceId: 'microteia:report-view-example:overview',
  sourceRev: 1,
  managed: true,
  enabled: true,
  spec: { ...OVERVIEW, requires: deriveReportRequires(OVERVIEW) },
  /**
   * The key of the view below. It stays in the package — the organization's copy of the report never
   * carries it —, so "duplicate to edit" gives the office a report of its own with the standard body.
   */
  view: 'overview',
};

/**
 * The view in three files, merged into the one module the runtime evaluates. From the office you write
 * `sourceFile: ['./views/Overview.view.tsx', ...]` and the compiler does the same merge.
 */
const OVERVIEW_SOURCE = mergeViewSources({
  'Overview.view.tsx': OVERVIEW_VIEW,
  'Overview.viewmodel.tsx': OVERVIEW_VIEWMODEL,
  'Overview.styles.tsx': OVERVIEW_STYLES,
});

export const reportViewExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.report-view-example',
    version: '1.0.0',
    // `reports[].view` and `useReportFrame` exist from kernel 2.138.0 on. An older kernel would open the
    // report with the standard body — still right, but not what this example is here to show.
    kernel: '^2.138.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    contributes: [
      reportViewMessagesContribution(),
      reportViewPtBrContribution(),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [ENTRY_SCREEN],
  reports: [OVERVIEW_REPORT],
  /**
   * A view with no `ui.page` and no `nav()`: nothing opens it on its own. The report tab is its only
   * door, and it reaches the view through `reports[].view` above.
   */
  views: [
    { key: 'overview', title: message('view.overview'), icon: 'barChart', source: OVERVIEW_SOURCE },
  ],
};
