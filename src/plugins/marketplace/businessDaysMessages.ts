import { DEFAULT_LOCALE, messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **The Business days catalog, in the source language.**
 *
 * Counting business days is not a legal concept: tax filings, payroll, shipping and service levels
 * all count them. That is why this extension speaks the source language and carries its own
 * Portuguese next door — and why nothing here names a holiday, a court or a state. What a marked day
 * MEANS is the office's word, typed into the calendar's name.
 */
export const BUSINESS_DAYS_NAMESPACE = 'com.microteia.business-days';

export const BUSINESS_DAYS_MESSAGES: Record<string, string> = {
  'package.name': 'Business days',
  'package.category': 'Productivity',
  'package.description':
    'Business-day calendars: the office marks, year by year, the days that are not business days, and every formula counts with them.',
  'package.summary':
    'Keep one or more business-day calendars — national, regional, of a single client or court — and mark, on a grid of the twelve months, the days that are not business days. Formulas count with the union of the calendars a record names: a day that is not a business day in any of them is not one in the count.',

  'nav.business-days': 'Business days',
  'nav.group.schedule': 'Schedule',
  'page.business-days': 'Business days',

  'screen.singular': 'Business-day calendar',
  'screen.plural': 'Business-day calendars',
  'section.calendar': 'Calendar',
  'field.name': 'Name',
  'field.name.placeholder': 'How the office calls this calendar',
  'field.key': 'Key',
  'field.key.placeholder': 'What a formula writes to name it, e.g. national',

  'overview.body':
    'A **calendar** has the weekdays that are never business days and, for each year, the days that are not business days either. You mark them on a grid of the twelve months — click a day, or drag across a period.\n\nA formula names one or more calendars and counts with all of them: `addBusinessDays(start, 15, ["national", "regional"])`. A day that is not a business day in ANY of them is skipped. A year that was never registered is not counted as a year without holidays: the count stops and says which calendar lacks which year.',
  'overview.adds': 'Adds',
  'overview.adds.value': 'A "Business days" item in the menu',
  'overview.formulas': 'Formulas',
  'overview.formulas.value': 'addBusinessDays, businessDaysBetween, isBusinessDay, nextBusinessDay',
  'overview.years': 'Years',
  'overview.years.value': 'Each calendar keeps its own years; copying a year starts the next one',
  'overview.banner':
    'Copying a year repeats the same day and month. Holidays that move every year must be reviewed after copying.',

  'view.screen-missing': 'The "Business-day calendars" screen was not found. Install the extension to enable it.',
  'view.calendars': 'Calendars',
  'view.empty': 'No calendar yet. Create the first one to start marking days.',
  'view.new-calendar': 'New calendar',
  'view.new-calendar.name': 'New calendar',
  'view.select': 'Select a calendar on the left to mark its days.',
  'view.name': 'Name',
  'view.key': 'Key',
  'view.key.hint': 'Formulas name the calendar by this key.',
  'view.key.invalid': 'The key uses letters, digits, "-" and "_", starting with a letter or digit.',
  'view.key.taken': 'Another calendar already uses the key "{key}".',
  'view.weekend': 'Never business days',
  'view.years': 'Years',
  'view.no-years': 'This calendar has no year yet. Add one to start marking days.',
  'view.add-year': 'Add {year}',
  'view.copy-year': 'Copy to {year}',
  'view.copy-year.done': 'The days of {from} were copied to {to}. Review the holidays that move every year.',
  'view.remove-year': 'Remove {year}',
  'view.remove-year.title': 'Remove year {year}?',
  'view.remove-year.message': 'Counts that reach {year} will stop and say the year is missing.',
  'view.marked': '{count} days marked in {year}',
  'view.legend.off': 'Not a business day',
  'view.legend.weekend': 'Weekday never business',
  'view.save': 'Save',
  'view.saved': 'Calendar saved.',
  'view.discard': 'Discard changes',
  'view.delete': 'Delete calendar',
  'view.delete.title': 'Delete calendar "{name}"?',
  'view.delete.message': 'Formulas that name it will stop and say the calendar does not exist.',
  'view.delete.confirm': 'Delete',
  'view.remove.confirm': 'Remove',
  'view.cancel': 'Cancel',
  'view.failed': 'The calendar could not be saved.',
};

export const businessDaysMessagesContribution = (): Contribution => messageBundleContribution({
  locale: DEFAULT_LOCALE,
  namespace: BUSINESS_DAYS_NAMESPACE,
  messages: BUSINESS_DAYS_MESSAGES,
});
