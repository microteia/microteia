import type { MarketplacePlugin } from '../../../../domain/entities/MarketplacePlugin';
import type { SettingsSection } from '../../../../domain/schema/settings';
import type { WidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import { settingsSection } from '../../../contributionBuilders';
import { settingsMessagesContribution } from './settingsMessages';
import { settingsPtBrContribution } from './settingsMessagesPtBr';

/**
 * **Configuration, by example** — how an extension is configured without bringing a screen for it.
 *
 * The Settings page is a GENERIC HOST, in the shape of the one in VS Code: two scopes as tabs, a search
 * at the top, a visual editor and a switch to JSON that writes the very same document. The kernel knows
 * NO setting in particular — if nothing is contributed, the page is empty by definition.
 *
 * The contract is pure data, and that is what makes it travel: the same declaration goes inside a
 * `.json` to an office that does not run this bundle, and the JSON editor there is exactly as
 * legitimate as the visual one, because both write the same document through the same validation.
 *
 * **Two scopes, one resolution: user → office → the declared default.** Two rules follow, and both are
 * about not surprising anyone:
 *
 * - A scope the property does not accept is SKIPPED, so a leftover value in the database from a
 *   declaration that has since been switched off does not come back to life.
 * - An invalid value is skipped too, falling through to the next level instead of breaking whoever
 *   reads it.
 *
 * And a value stored under a key nobody declares is PRESERVED when the JSON is edited: the extension
 * that owns it may simply be disabled at that moment, and dropping it would lose its configuration.
 */

const message = (key: string): string => `@com.microteia.settings-example/${key}`;

const SECTION: SettingsSection = {
  key: 'settings-example',
  title: message('section.title'),
  description: message('section.description'),
  icon: 'settings',
  order: 90,
  properties: [
    /** Both scopes: the office sets a default and a person may differ from it. */
    {
      key: 'settingsExample.enabled',
      label: message('prop.enabled'),
      description: message('prop.enabled.description'),
      type: 'boolean',
      default: true,
      scopes: ['tenant', 'user'],
    },

    /**
     * Office-wide only, and the choice of scope is the interesting part: this is about the
     * installation, not about a person, so offering it per user would invite someone to change a
     * number that is not theirs to change.
     */
    {
      key: 'settingsExample.batchSize',
      label: message('prop.batch'),
      description: message('prop.batch.description'),
      type: 'number',
      default: 50,
      min: 1,
      max: 500,
      scopes: ['tenant'],
    },

    {
      key: 'settingsExample.heading',
      label: message('prop.label'),
      description: message('prop.label.description'),
      type: 'text',
      default: '',
      scopes: ['tenant'],
    },

    /** A closed list. `value` is the stable key; `label` is what is read, and is translated. */
    {
      key: 'settingsExample.mode',
      label: message('prop.mode'),
      description: message('prop.mode.description'),
      type: 'select',
      default: 'strict',
      options: [
        { value: 'strict', label: message('prop.mode.strict') },
        { value: 'lenient', label: message('prop.mode.lenient') },
      ],
      scopes: ['tenant'],
    },

    /**
     * The list of texts — the kernel's tag input, declared. It exists because the alternative, for an
     * extension needing "several addresses", was `json` (a field where somebody types brackets) or a
     * screen of its own.
     *
     * `itemPattern` validates each item BY REGULAR EXPRESSION IN TEXT, so the declaration stays
     * serialisable. A broken expression becomes "no pattern", never an exception: a third party's
     * declaration cannot be allowed to take the Settings page down.
     */
    {
      key: 'settingsExample.senders',
      label: message('prop.senders'),
      description: message('prop.senders.description'),
      type: 'stringList',
      default: [],
      itemPlaceholder: message('prop.senders.placeholder'),
      itemPattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
      scopes: ['tenant'],
    },

    /**
     * The escape hatch, and it is last for a reason: everything the vocabulary above can express should
     * be expressed there. A `json` property asks a person to type syntax, and syntax is the one thing a
     * settings editor exists to avoid.
     */
    {
      key: 'settingsExample.advanced',
      label: message('prop.extra'),
      description: message('prop.extra.description'),
      type: 'json',
      default: {},
      scopes: ['tenant'],
    },
  ],
};

/**
 * The terms this package asks the office to accept before installing. They are ADDED to the ones
 * Microteia already asks for, never a replacement — an extension cannot licence away the platform's
 * own terms.
 *
 * It is a Widget DSL tree rather than a blob of text so it renders like everything else, in the
 * viewer's theme, with no markup of the extension's own reaching the page.
 */
const LICENCE: WidgetSpec = {
  type: 'stack',
  gap: 'md',
  children: [
    { type: 'heading', text: message('licence.heading') },
    { type: 'markdown', content: message('licence.body') },
  ],
};

export const settingsExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.settings-example',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    icon: 'settings',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    license: LICENCE,
    contributes: [
      settingsMessagesContribution(),
      settingsPtBrContribution(),
      settingsSection(SECTION),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
};
