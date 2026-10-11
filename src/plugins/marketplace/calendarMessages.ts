import { DEFAULT_LOCALE, messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **The Calendar catalog, in the source language.**
 *
 * An agenda is not a legal concept, a sales concept or an accounting one: any office that has dates
 * to keep has one. That is what makes this extension GENERIC — and a generic extension cannot ship
 * with its text nailed to a single language.
 *
 * So every string a person reads is a key here, and what the manifest carries is a reference
 * (`@com.microteia.calendar/nav.calendar`). Nothing else changes: the same `resolveLabel` that lets
 * an office rename a screen resolves the reference, and an office that types its own label keeps it
 * untouched.
 *
 * The namespace is the PLUGIN ID, never the translator's. A third party translating this extension
 * declares `namespace: 'com.microteia.calendar'` too — that is what lets one package translate
 * something it does not own.
 */
export const CALENDAR_NAMESPACE = 'com.microteia.calendar';

export const CALENDAR_MESSAGES: Record<string, string> = {
  'package.name': 'Calendar',
  'package.category': 'Productivity',
  'package.description': 'The office agenda, agnostic: any extension puts an item on it and stays its owner.',
  'package.summary':
    'The office agenda in day columns, with the whole month on a single scroll that opens on today. It knows nothing about deadlines, hearings or instalments: any extension registers an item, stays its owner and decides what happens when someone drags it to another day.',

  'nav.calendar': 'Calendar',
  'page.calendar': 'Calendar',

  'screen.singular': 'Calendar item',
  'screen.plural': 'Calendar',

  'section.item': 'Item',
  'section.dates': 'Dates',
  'section.origin': 'Origin',

  'field.title': 'Title',
  'field.title.placeholder': 'What appears on the card',
  'field.status': 'Status',
  'field.status.placeholder': 'Select the status...',
  'field.priority': 'Priority',
  'field.priority.placeholder': 'Select the priority...',
  'field.description': 'Description',
  'field.description.placeholder': 'Detail shown on the card',
  'field.date': 'Date',
  'field.hour': 'Time',
  'field.finish-date': 'Completion date',
  'field.finish-hour': 'Completion time',
  'field.origin': 'Origin collection',
  'field.origin.placeholder': 'The record set the item came from',
  'field.origin-id': 'Origin record',

  'lookup.statuses': 'Calendar: Status',
  'lookup.priorities': 'Calendar: Priority',
  'status.pending': 'Pending',
  'status.closed': 'Done',
  'priority.low': 'Low',
  'priority.medium': 'Medium',
  'priority.high': 'High',
  'priority.critical': 'Critical',

  'point.move.title': 'Action when an item moves to another day',
  'point.move.description': 'The action executed when an item is dragged to another day. What the change means is decided by the origin.',
  'point.source.title': 'How an origin presents itself on the agenda',
  'point.source.description': 'The tag, the subtitle and the lines of the cards an origin puts on the agenda. Read when the agenda is drawn, so a change reaches the items already there.',

  'settings.section.title': 'Calendar',
  'settings.section.description': 'How the agenda answers what the user does.',
  'settings.move-actions': 'When an item is dragged to another day',
  'settings.move-actions.description':
    'The actions that answer a change of day, in the order they are consulted. The first one that serves the item origin wins — dragging writes nothing on its own.',
  'settings.sources': 'Origins shown on the agenda',
  'settings.sources.description':
    'The extensions that put items on the agenda. Switching one off hides its items — it keeps them up to date, so switching it back on shows them again at once.',

  'overview.body':
    'The **Calendar** shows the days of the month side by side and what is scheduled on each one. The scroll opens on today, the card is coloured by priority, and the legend below filters by it in one click.\n\nThe agenda owns nothing it shows. Each item belongs to the record that created it — a deadline, a hearing, an instalment — and it is that record that keeps it current: changed there, changed here; deleted there, gone from here. That is why an item is not edited from the agenda, and why clicking the card goes straight to the origin record.\n\nDragging a card to another day **asks** the extension that owns the item what to do. In Settings › Calendar you choose which ones answer, and in what order.',
  'overview.adds': 'Adds',
  'overview.adds.value': 'A "Calendar" item in the menu',
  'overview.shows': 'Shows',
  'overview.shows.value': 'The whole month, in day columns',
  'overview.filter': 'Filter',
  'overview.filter.value': 'By status, priority, date — and whatever extensions add',
  'overview.drag': 'Dragging',
  'overview.drag.value': 'Runs the action the origin declared',
  'overview.origin': 'Origin',
  'overview.origin.value': 'Each card says where it comes from, and you choose which origins appear',
  'overview.banner': 'On its own the agenda opens empty: it is filled by the extensions that register items on it, such as Deadlines.',

  'view.screen-missing': 'The "Calendar" screen was not found. Install the extension to enable it.',
  'view.stat.month': 'This month',
  'view.stat.pending': 'Pending',
  'view.stat.closed': 'Done',
  'view.stat.late': 'Overdue',
  'view.previous-month': 'Previous month',
  'view.next-month': 'Next month',
  'view.today': 'Today',
  'view.filter.placeholder': 'Filter the agenda...',
  'view.legend.priority': 'Priority:',
  'view.legend.all': 'All',
  'view.legend.origin': 'Origin:',
  'view.move.no-handler': 'No extension answers for this item when the day changes.',
};

export const calendarMessagesContribution = (): Contribution => messageBundleContribution({
  locale: DEFAULT_LOCALE,
  namespace: CALENDAR_NAMESPACE,
  messages: CALENDAR_MESSAGES,
});
