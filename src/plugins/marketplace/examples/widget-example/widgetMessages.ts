import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Surfaces example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const WIDGET_NAMESPACE = 'com.microteia.widget-example';

export const WIDGET_MESSAGES: Record<string, string> = {
  'package.name': 'Surfaces, by example',
  'package.category': 'Interface',
  'package.description':
    'Cards on the dashboard, a mark in the shell and a tab in the organization settings — all declared as data, with no code in the browser.',
  'package.summary':
    'How an extension shows up in places it does not own. It installs two cards on the dashboard surface, two marks in the workspace shell and one tab in the organization settings, and every one of them is a Widget DSL tree: data the kernel renders with its own components. Nothing here executes in the browser, so nothing here needs the office to review code before it runs.',

  'widget.glance': 'At a glance',
  'widget.glance.description': 'A card on the dashboard, drawn from a declared tree.',
  'widget.how': 'How this card got here',
  'widget.how.description': 'What a Widget DSL tree can say, and where it stops.',

  'slot.badge': 'Top bar mark',
  'slot.badge.description': 'A mark placed in the right of the top bar.',
  'slot.status': 'Status bar mark',
  'slot.status.description': 'A mark placed in the left of the status bar.',

  'tab.about': 'Surfaces example',
  'tab.about.description': 'A tab added to the organization settings.',

  'glance.heading': 'Placed by an extension',
  'glance.installed': 'Installed',
  'glance.installed.value': 'Surfaces example',
  'glance.code': 'Code in the browser',
  'glance.code.value': 'None',
  'glance.surface': 'Surface',
  'glance.surface.value': 'dashboard',
  'glance.note':
    'Remove this extension and the card goes with it. Nothing here was added to the dashboard by hand.',

  'how.body':
    'This card is a **tree of nodes**, not a component. The kernel walks it and renders each node with its own components — so the colour comes from the theme, never from the extension.\n\nA node the kernel does not recognise is **ignored, not fatal**: a card written for a newer platform degrades instead of taking the dashboard down with it.\n\nTo put a real NUMBER on a card, name a report:\n\n```\n{ type: \'report\', report: \'my-report-key\' }\n```\n\nThat is the data binding — indirect on purpose, so that what a number means stays declared in one place.',

  'badge.text': 'Surfaces example',
  'status.text': 'Placed by an extension',

  'about.heading': 'Surfaces, by example',
  'about.body':
    'A **surface** is a NAME, not a screen. Whoever hosts one declares the name; whoever fills it names the same string. Neither knows the other exists.\n\nThat is why this tab needed no change anywhere: the organization settings renders whatever is registered under `tenant-settings`, and this extension registered something there.\n\nThe same holds for the dashboard cards. If the Dashboard extension is not installed, the cards simply have nowhere to appear — and nothing breaks.',
  'about.surfaces': 'Surfaces used',
  'about.surfaces.value': 'dashboard, top-bar.right, status-bar.left, tenant-settings',
};

export const widgetMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: WIDGET_NAMESPACE,
    messages: WIDGET_MESSAGES,
  });
