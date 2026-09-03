import { DEFAULT_LOCALE, messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **The Dashboard catalog, in the source language.**
 *
 * The Dashboard delivers a PLACE, not a subject — and a place belongs to every kind of business. So
 * nothing here names a domain, and nothing here is written in a single language: the manifest carries
 * references, the text lives in this catalog, and a translation is one more `i18n.messages`
 * contribution.
 */
export const DASHBOARD_NAMESPACE = 'com.microteia.dashboard';

export const DASHBOARD_MESSAGES: Record<string, string> = {
  'package.name': 'Dashboard',
  'package.category': 'Analytics',
  'package.description': 'The opening screen of the office, assembled from the widgets each extension offers.',
  'package.summary':
    'The opening screen of the office: a grid of widgets offered by each installed extension. You choose which ones appear, in what order and at what width — and each person can assemble their own.',

  'nav.dashboard': 'Dashboard',
  'page.dashboard': 'Dashboard',

  'settings.section.title': 'Dashboard',
  'settings.section.description': 'What appears on the opening screen, in what order and at what width.',
  'settings.widgets': 'Dashboard widgets',
  'settings.widgets.description':
    'Tick the cards that should appear, choose the width of each one (1 to 3 columns) and use the arrows to order them. Whatever an extension installs later goes to the end of the list.',

  'overview.body':
    'The **Dashboard** is the screen that opens when you enter the office. It has no content of its own: it shows the **widgets** that other extensions offer — the numbers, the dates coming due, the summaries.\n\nIn **Settings → Dashboard** you turn each widget on and off and set its width (1, 2 or 3 columns) and its order. The administrator sets the default Dashboard of the office under **Office**; each person can assemble their own under **User**.',
  'overview.adds': 'Adds',
  'overview.adds.value': 'A "Dashboard" item in the menu',
  'overview.content': 'Content',
  'overview.content.value': 'Widgets from the installed extensions',
  'overview.configuration': 'Configuration',
  'overview.configuration.value': 'Per office and per user',
  'overview.banner':
    'Installing an extension that offers widgets makes its cards appear here automatically; removing the extension takes them away, leaving no empty space.',

  'view.empty': 'No widgets available. Install extensions to give the Dashboard content.',
};

export const dashboardMessagesContribution = (): Contribution => messageBundleContribution({
  locale: DEFAULT_LOCALE,
  namespace: DASHBOARD_NAMESPACE,
  messages: DASHBOARD_MESSAGES,
});
