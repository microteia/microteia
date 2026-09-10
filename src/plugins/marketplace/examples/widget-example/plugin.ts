import type { MarketplacePlugin } from '../../../../domain/entities/MarketplacePlugin';
import type { WidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import { WORKSPACE_SLOT_SURFACES } from '../../../../domain/schema/ui/uiExtensionPoints';
import { surfaceSlotSpec, surfaceTabSpec, surfaceWidgetSpec } from '../../../contributionBuilders';
import { widgetMessagesContribution } from './widgetMessages';
import { widgetPtBrContribution } from './widgetMessagesPtBr';

/**
 * **Surfaces, by example** — how an extension shows up in places it does not own.
 *
 * A SURFACE IS A NAME. Whoever hosts one declares the name and renders whatever is registered under
 * it; whoever fills it writes the same string. Neither side knows the other exists, and that is the
 * whole coupling: there is no registry to join, no import, and nothing to change on the host.
 *
 * Everything below is a `WidgetSpec` — a serialisable tree the kernel walks and renders with its own
 * components. That matters for more than tidiness: a package that ships no code needs **no trust
 * gesture** from the office that installs it. `impl: { kind: 'code' }` executes JavaScript and is a
 * first-party privilege; `impl: { kind: 'widget' }` is data, and anyone may ship it.
 *
 * Two consequences worth knowing before you copy this:
 *
 * - **An unknown node is ignored, never fatal.** A card written against a newer platform degrades in
 *   place instead of taking the whole surface down. Each card also renders inside its own error
 *   boundary — with dozens of extensions installed, a broken card is a warning in that one space.
 * - **A surface that nobody hosts is not an error.** These cards name `dashboard`, which the Dashboard
 *   extension declares. Without it installed they have nowhere to appear, and nothing breaks.
 *
 * There is a seventh region this example does not fill — the user menu (`USER_MENU_SURFACE`). It takes
 * `ui.menu`, not `ui.slot`, because a menu item is an ACTION and not a drawing. Read `command-example`
 * for that point.
 */

const message = (key: string): string => `@com.microteia.widget-example/${key}`;

/** The surface the Dashboard extension declares. It is a STRING here on purpose — see above. */
const DASHBOARD_SURFACE = 'dashboard';

/** The surface the Organization screen declares for its tabs. Same reasoning. */
const TENANT_SETTINGS_SURFACE = 'tenant-settings';

/**
 * The descriptive card. `metric` and `keyValue` are the two nodes that carry a value beside a label,
 * and here both values are declared text — the Widget DSL v1 draws what it is told.
 */
const AT_A_GLANCE: WidgetSpec = {
  type: 'stack',
  gap: 'md',
  children: [
    { type: 'heading', text: message('glance.heading') },
    {
      type: 'grid',
      columns: 3,
      children: [
        { type: 'metric', label: message('glance.installed'), value: message('glance.installed.value') },
        { type: 'metric', label: message('glance.code'), value: message('glance.code.value') },
        { type: 'metric', label: message('glance.surface'), value: message('glance.surface.value') },
      ],
    },
    { type: 'divider' },
    { type: 'banner', message: message('glance.note'), variant: 'info' },
  ],
};

/**
 * The card that explains the mechanism, including the one thing this example deliberately does NOT
 * do: bind to data. That arrives through the `report` node — `{ type: 'report', report: '<key>' }` —
 * which names a report instead of inlining a query. Naming it keeps aggregation, permission and scan
 * limits declared in ONE place; inlining a query here would create a second place where the meaning
 * of a number lives. Read `report-example` for the reports themselves.
 */
const HOW_IT_WORKS: WidgetSpec = {
  type: 'stack',
  gap: 'sm',
  children: [{ type: 'markdown', content: message('how.body') }],
};

/**
 * The shell marks. A slot is the same mechanism as a dashboard card with a different name — the six
 * workspace regions are constants (`WORKSPACE_SLOT_SURFACES`) because a typo in a surface name is
 * silent: the contribution registers fine and simply never renders anywhere.
 */
const BADGE: WidgetSpec = { type: 'text', text: message('badge.text'), muted: true };
const STATUS: WidgetSpec = { type: 'text', text: message('status.text'), muted: true };

const ABOUT: WidgetSpec = {
  type: 'stack',
  gap: 'lg',
  children: [
    { type: 'heading', text: message('about.heading') },
    { type: 'markdown', content: message('about.body') },
    { type: 'divider' },
    {
      type: 'keyValue',
      items: [{ label: message('about.surfaces'), value: message('about.surfaces.value') }],
    },
  ],
};

export const widgetExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.widget-example',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    /** The four points below are `core.ui`'s. Depending on the owner of a point you fill is the rule. */
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      widgetMessagesContribution(),
      widgetPtBrContribution(),
      /**
       * `defaultSpan` and `order` are the card's OPENING position, not its position. The office
       * reorders the surface in Settings, and `resolveWidgetLayout` reconciles what it chose with
       * what is registered: a card installed later joins the end, a card that vanished leaves no
       * hole, and the chosen order survives both.
       */
      surfaceWidgetSpec(
        {
          surface: DASHBOARD_SURFACE,
          key: 'widget-example.at-a-glance',
          title: message('widget.glance'),
          description: message('widget.glance.description'),
          icon: 'layoutGrid',
          defaultSpan: 2,
          order: 10,
        },
        AT_A_GLANCE,
      ),
      surfaceWidgetSpec(
        {
          surface: DASHBOARD_SURFACE,
          key: 'widget-example.how-it-works',
          title: message('widget.how'),
          description: message('widget.how.description'),
          icon: 'bookSimple',
          defaultSpan: 1,
          order: 20,
        },
        HOW_IT_WORKS,
      ),
      surfaceSlotSpec(
        {
          surface: WORKSPACE_SLOT_SURFACES.topBarRight,
          key: 'widget-example.badge',
          title: message('slot.badge'),
          description: message('slot.badge.description'),
          order: 10,
        },
        BADGE,
      ),
      surfaceSlotSpec(
        {
          surface: WORKSPACE_SLOT_SURFACES.statusBarLeft,
          key: 'widget-example.status',
          title: message('slot.status'),
          description: message('slot.status.description'),
          order: 10,
        },
        STATUS,
      ),
      surfaceTabSpec(
        {
          surface: TENANT_SETTINGS_SURFACE,
          key: 'widget-example.about',
          title: message('tab.about'),
          description: message('tab.about.description'),
          icon: 'layoutGrid',
          order: 90,
        },
        ABOUT,
      ),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
};
