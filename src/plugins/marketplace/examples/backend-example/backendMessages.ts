import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Cloud Functions example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const BACKEND_NAMESPACE = 'com.microteia.backend-example';

export const BACKEND_MESSAGES: Record<string, string> = {
  'package.name': 'Cloud Functions, by example',
  'package.category': 'Backend',
  'package.description':
    'A callable, a Firestore trigger and a nightly run — each with the guard its shape requires — plus the backend the extension asks of the project.',
  'package.summary':
    'What an extension needs when a declaration is not enough and code has to run on the server. It carries three Cloud Functions of its own, one of each shape, and each one is born with the guard that shape requires: a callable refuses a caller who is not a member of that organization, a document trigger refuses to fire where the extension was never installed, and a scheduled run loops over the organizations that have it. It also declares what it needs of the Firebase project — the functions, a setting, an index and one step a person has to take by hand.',

  'screen.ticket': 'Ticket',
  'screen.ticket.plural': 'Tickets',
  'field.subject': 'Subject',
  'field.subject.placeholder': 'What this ticket is about',
  'field.amount': 'Amount',
  'field.status': 'Status',
  'field.status.open': 'Open',
  'field.status.closed': 'Closed',
  'field.openedAt': 'Opened at',

  'prerequisite.scheduler.title': 'Enable Cloud Scheduler in the project',
  'prerequisite.scheduler.detail':
    'The nightly run needs Cloud Scheduler enabled and a billing account on the Firebase project, then a value in BACKEND_EXAMPLE_RATE in the backend settings. Settings are never shared between installations.',
};

export const backendMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: BACKEND_NAMESPACE,
    messages: BACKEND_MESSAGES,
  });
