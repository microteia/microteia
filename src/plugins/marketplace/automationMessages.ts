import { DEFAULT_LOCALE, messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **The Automation example catalog, in the source language.**
 *
 * Every label a person reads is a key here, and the manifest carries a reference
 * (`@com.microteia.automation-example/workflow.on-save`). The namespace is the PLUGIN ID, never the
 * translator's.
 */
export const AUTOMATION_NAMESPACE = 'com.microteia.automation-example';

export const AUTOMATION_MESSAGES: Record<string, string> = {
  'package.name': 'Automation, by example',
  'package.description':
    'A worked automation: a workflow on save, a branch, a query, a write that does not duplicate, a script, and an action that asks for a value.',
  'package.summary':
    'The mechanics of automation, with no business in the way. It installs one screen and every kind of automation the platform runs, so each can be read as source: a workflow that fires on save, a control node that branches, a query that asks whether a record already exists, a write that stays idempotent on a second run, a sandbox script, and a button that asks a person for a value before firing a flow.',

  'screen.request': 'Request',
  'screen.request.plural': 'Requests',
  'section.request': 'Request',
  'section.handling': 'Handling',
  'field.title': 'Title',
  'field.title.placeholder': 'What is being asked for',
  'field.amount': 'Amount',
  'field.status': 'Status',
  'field.status.open': 'Open',
  'field.status.approved': 'Approved',
  'field.status.rejected': 'Rejected',
  'field.note': 'Note',

  'workflow.on-save': 'On saving a request',
  'workflow.on-save.description':
    'Fires whenever a request is written. Branches on whether it is new, and records what happened in the audit trail.',
  'workflow.on-save.created.title': 'Request opened',
  'workflow.on-save.updated.title': 'Request changed',

  'workflow.review': 'Review a request',
  'workflow.review.description':
    'Called by the Review button. Receives the decision and the note as parameters, and writes them to the record.',
  'workflow.review.done.title': 'Request reviewed',

  'workflow.mirror': 'Keep the summary in step',
  'workflow.mirror.description':
    'Called flow: asks whether the summary of this month already exists, then updates it or creates it. Running it twice does not duplicate anything.',
  'workflow.mirror.audit.title': 'Summary kept in step',

  'action.review': 'Review',
  'action.review.confirm': 'Record this review on the request?',
  'action.mirror': 'Recount summary',

  'parameter.decision': 'Decision',
  'parameter.decision.approve': 'Approve',
  'parameter.decision.reject': 'Reject',
  'parameter.note': 'Note',

  'script.total': 'Add up amounts',
  'script.total.output.total': 'Total of the amounts given',
  'script.total.output.counted': 'How many were counted',

  'screen.summary': 'Request summary',
  'screen.summary.plural': 'Request summaries',
  'field.period': 'Period',
  'field.openTotal': 'Open total',
  'field.openCount': 'Open requests',
};

export const automationMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: AUTOMATION_NAMESPACE,
    messages: AUTOMATION_MESSAGES,
  });
