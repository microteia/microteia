import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/**
 * **The Reports example catalog, in the source language.**
 *
 * Every label a person reads is a key here, and the package carries a reference
 * (`@com.microteia.report-example/report.by-category`). The namespace is the PLUGIN ID, never the
 * translator's — a bundle keyed by who translated it could not be replaced by a better translation.
 */
export const REPORT_NAMESPACE = 'com.microteia.report-example';

export const REPORT_MESSAGES: Record<string, string> = {
  'package.name': 'Reports, by example',
  'package.category': 'Reports',
  'package.description':
    'Four reports over one small screen: a grouped list, a summary with a chart, a pivot, and one that filters by expression and asks a question first.',
  'package.summary':
    'What a declarative report can say, with no business in the way. It installs one screen and four reports over it, so each shape can be read as source: a list broken into groups with subtotals, a summary bucketed by month with a chart beside it, a pivot of category against month, and a list that filters by an expression over each row and asks the reader for a date before it runs.',

  'screen.entry': 'Entry',
  'screen.entry.plural': 'Entries',
  'section.entry': 'Entry',
  'section.amounts': 'Amounts',
  'field.label': 'Label',
  'field.label.placeholder': 'What this entry is',
  'field.category': 'Category',
  'field.category.standard': 'Standard',
  'field.category.priority': 'Priority',
  'field.category.exception': 'Exception',
  'field.amount': 'Amount',
  'field.estimate': 'Estimate',
  'field.entryDate': 'Date',
  'field.archived': 'Archived',

  'report.by-category': 'Entries by category',
  'report.by-category.description':
    'The grouped list: every entry stays visible, broken into one block per category, with a subtotal under each block.',

  'report.by-month': 'Totals by month',
  'report.by-month.description':
    'The summary: one line per month, with a chart beside it. The month is a BUCKET cut from the date, not a field anybody types.',

  'report.category-by-month': 'Category against month',
  'report.category-by-month.description':
    'The pivot: categories down the side, months across the top, one total in each cell.',

  'report.over-estimate': 'Over the estimate',
  'report.over-estimate.description':
    'The list that no fixed filter can write: it keeps the rows whose amount went past their own estimate, and asks the reader for a starting date first.',

  'measure.total': 'Total',
  'measure.count': 'Entries',
  'measure.open-total': 'Total still open',
  'measure.categories': 'Categories',

  'dimension.label': 'Label',
  'dimension.category': 'Category',
  'dimension.date': 'Date',
  'dimension.month': 'Month',

  'prompt.from': 'From',
};

export const reportMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: REPORT_NAMESPACE,
    messages: REPORT_MESSAGES,
  });
