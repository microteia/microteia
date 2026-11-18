import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Report view example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const REPORT_VIEW_NAMESPACE = 'com.microteia.report-view-example';

export const REPORT_VIEW_MESSAGES: Record<string, string> = {
  'package.name': 'A report drawn in code, by example',
  'package.category': 'Reports',
  'package.description':
    'A report whose tab the extension draws: its own period buttons and headline, above the chart and the table of the platform.',
  'package.summary':
    'How an extension draws the BODY of a report it declares. The report names one of the package views (`reports[].view`), and that view replaces the standard body of the report tab wherever it is opened — the report list, the command palette, a link in a notification. The platform keeps the title, the warnings and Export / Print / Subscribe, and it runs the report: the view asks for a new period with `useReportFrame().run(...)`, so what is exported is what is on screen. The numbers still come from the declared dataset — the view only decides how they are shown.',

  'screen.entry': 'Entry',
  'screen.entry.plural': 'Entries',

  'field.label': 'Description',
  'field.category': 'Category',
  'field.category.standard': 'Standard',
  'field.category.priority': 'Priority',
  'field.category.exception': 'Exception',
  'field.entryDate': 'Date',
  'field.amount': 'Amount',

  'report.overview': 'Entries overview',
  'report.overview.description': 'Totals by category for a period, with the headline above the chart.',
  'dimension.category': 'Category',
  'measure.total': 'Total',
  'measure.count': 'Entries',
  'measure.average': 'Average per entry',
  'prompt.period': 'Period',

  'view.overview': 'Entries overview',

  'period.this-month': 'This month',
  'period.this-year': 'This year',
  'period.last-year': 'Last year',
  'period.all': 'All time',

  'overview.total': 'Total',
  'overview.count': 'Entries',
  'overview.average': 'Average per entry',
  'overview.loading': 'Running the report…',
  'overview.outside': 'This view draws the body of the Entries overview report. Open the report to see it.',
};

export const reportViewMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: REPORT_VIEW_NAMESPACE,
    messages: REPORT_VIEW_MESSAGES,
  });
