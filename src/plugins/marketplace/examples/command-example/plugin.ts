import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import type { WidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import { USER_MENU_SURFACE } from '../../../../domain/schema/ui/uiExtensionPoints';
import { menuItem, widgetPage } from '../../../contributionBuilders';
import COMMAND_STARTUP from './views/startup.tsx?raw';
import { commandMessagesContribution } from './commandMessages';
import { commandPtBrContribution } from './commandMessagesPtBr';

/**
 * **Gestures, by example** — the two ways to add one, and why there are two.
 *
 * | Gesture | Where it is declared | Why there |
 * |---|---|---|
 * | a line in the user menu | `ui.menu`, in the manifest | it is a FIXED row — data is enough |
 * | a command palette entry | `startup`, at load time | it has to SEARCH as the person types |
 * | an `@` mention | `startup`, at load time | same reason |
 *
 * That is the whole distinction, and it is not about power: a manifest is DATA, and neither of the last
 * two can be data, because both have to answer a query that does not exist until somebody types it.
 *
 * `startup` is the one place an extension registers something at runtime instead of declaring it. It
 * runs when the extension loads, everything it registers is scoped to this plugin and released when it
 * unloads, and it may return its own teardown for whatever it subscribed to itself.
 *
 * **The manifest points `ui.command` and `ui.record.action` are a different road, and a closed one for
 * a third party**: both require `impl: { kind: 'code', key }`, and that key resolves in the bundle's
 * own implementation registry, which only first-party plugins populate. An extension that ships source
 * uses `startup` for a palette entry — this file — and an `ActionModuleTemplate` for a gesture on a
 * record, which `automation-example` shows.
 */

const message = (key: string): string => `@com.microteia.command-example/${key}`;

const NOTE_FIELDS: TemplateField[] = [
  { key: 'title', label: message('field.title'), type: 'text', required: true, order: 0, placeholder: message('field.title.placeholder') },
  { key: 'note', label: message('field.note'), type: 'textarea', required: false, order: 1 },
];

/**
 * The screen exists so the palette and the mention have something to find. `sourceId` is how the
 * startup code locates it: the screen KEY can gain a suffix in the destination office, and the id it
 * ends up with is not the one declared here — the `sourceId` is stable everywhere.
 */
const NOTE_SCREEN: ScreenModuleTemplate = {
  key: 'commandNote',
  sourceId: 'microteia:command-example:note',
  sourceRev: 1,
  titleSingular: message('screen.note'),
  titlePlural: message('screen.note.plural'),
  icon: 'keyboard',
  fields: NOTE_FIELDS,
  titleFieldKey: 'title',
  eventPrefix: 'commandNote',
};

const GUIDE: WidgetSpec = {
  type: 'stack',
  gap: 'lg',
  children: [
    { type: 'heading', text: message('guide.heading') },
    { type: 'markdown', content: message('guide.body') },
    { type: 'divider' },
    {
      type: 'keyValue',
      items: [
        { label: message('guide.declared'), value: message('guide.declared.value') },
        { label: message('guide.registered'), value: message('guide.registered.value') },
      ],
    },
  ],
};

export const commandExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.command-example',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      commandMessagesContribution(),
      commandPtBrContribution(),

      /**
       * The declared gesture. `ui.menu` takes NO implementation — the action is one of two shapes,
       * `openTab` or `url`, and both are data. That is what lets any package add a line here, including
       * one that ships no code at all.
       */
      menuItem({
        surface: USER_MENU_SURFACE,
        key: 'command-example.guide',
        title: message('menu.guide'),
        icon: 'keyboard',
        order: 50,
        action: { kind: 'openTab', tabKey: 'command-example-guide' },
      }),

      widgetPage(
        { key: 'command-example-guide', title: message('page.guide'), icon: 'keyboard' },
        GUIDE,
      ),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [NOTE_SCREEN],
  /**
   * Here it is a `?raw` import because that is how a package in THIS repository loads its own source.
   * From the office you write `startupFile: './views/startup.tsx'` and the compiler inlines it — same
   * artifact, one less step.
   */
  startup: COMMAND_STARTUP,
};
