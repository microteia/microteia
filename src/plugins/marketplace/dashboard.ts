import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { nav, page, settingsSection } from '../contributionBuilders';
import { dashboardMessagesContribution } from './dashboardMessages';
import { dashboardPtBrContribution } from './dashboardMessagesPtBr';
import DASHBOARD_SOURCE from './views/dashboard/Dashboard.view.tsx?raw';

/**
 * **Dashboard** — the opening screen of the office, now an extension that knows no data at all.
 *
 * What it delivers is only the PLACE: a surface named `dashboard` where every installed extension
 * drops its cards, plus the Settings section that decides which ones appear, in what order and at
 * what width. The record counts, the dates coming due and the financial summary are NOT here — they
 * are widgets of the extensions that know each of those subjects. Uninstalling Finance takes its
 * card off the Dashboard without touching a line of this extension.
 *
 * The configuration accepts both scopes: the administrator sets the office default and each person
 * assembles their own on top of it, without changing anyone else's.
 *
 * Because it is a PLACE and not a subject, it fits any kind of business — and so it ships in the
 * source language, with its own Portuguese translation as one more contribution. That is why nothing
 * below is a phrase: every label is a reference into `dashboardMessages.ts`.
 */
export const DASHBOARD_SURFACE = 'dashboard';

/**
 * A reference into this extension's own catalog. The namespace is written out, not composed:
 * `npm run verify-messages` reads these calls and fails on a key that does not exist, and it can
 * only do that if the namespace is there to be read.
 */
const message = (key: string): string => `@com.microteia.dashboard/${key}`;

export const dashboardPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.dashboard',
    version: '1.1.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      dashboardMessagesContribution(),
      dashboardPtBrContribution(),
      nav({ key: 'dashboard', label: message('nav.dashboard'), icon: 'dashboard', order: 10 }),
      page({ key: 'dashboard', title: message('page.dashboard'), icon: 'dashboard', fullBleed: true }, 'dashboard'),
      settingsSection({
        key: 'dashboard',
        title: message('settings.section.title'),
        icon: 'dashboard',
        order: 10,
        description: message('settings.section.description'),
        properties: [
          {
            key: 'dashboard.widgets',
            label: message('settings.widgets'),
            description: message('settings.widgets.description'),
            type: 'widgets',
            surface: DASHBOARD_SURFACE,
            default: [],
            scopes: ['tenant', 'user'],
          },
        ],
      }),
    ],
  },
  summary: message('package.summary'),
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      { type: 'markdown', content: message('overview.body') },
      {
        type: 'keyValue',
        items: [
          { label: message('overview.adds'), value: message('overview.adds.value') },
          { label: message('overview.content'), value: message('overview.content.value') },
          { label: message('overview.configuration'), value: message('overview.configuration.value') },
        ],
      },
      { type: 'banner', message: message('overview.banner'), variant: 'info' },
    ],
  },
  workflows: [],
  views: [
    {
      key: 'dashboard',
      title: message('page.dashboard'),
      icon: 'dashboard',
      source: DASHBOARD_SOURCE,
    },
  ],
};
