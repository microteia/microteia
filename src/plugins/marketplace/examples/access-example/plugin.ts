import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import type { WidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import {
  accessPermissionContribution,
  accessResourceContribution,
} from '../../../../domain/schema/access/extensionPoints';
import { nav, widgetPage } from '../../../contributionBuilders';
import { accessMessagesContribution } from './accessMessages';
import { accessPtBrContribution } from './accessMessagesPtBr';

/**
 * **Permissions, by example** — who may do what, and where that is declared.
 *
 * Authorisation here is by PERMISSION and never by role. There is no per-office role to compare
 * against: the office builds its own profiles, members receive them, and every question the code asks
 * is "is this permission held?". A `role === '...'` anywhere would be the one thing this design exists
 * to prevent, because it hard-codes into the product a hierarchy that belongs to the office.
 *
 * Three things are declared below, and knowing which is which is most of the subject:
 *
 * 1. **Nothing, for the collection.** A screen's collection yields `read`, `create`, `update` and
 *    `delete` for free — the catalog derives them. An extension that only installs screens declares no
 *    permission at all and is still fully governed.
 * 2. **A RESOURCE**, for the thing that is not a collection. The board below is another VIEW of notes
 *    that already exist; there is no collection for the platform to derive names from, so the resource
 *    gives permissions something to be *about*.
 * 3. **PERMISSIONS**, each with the closure it drags along. `requires` is not documentation: a
 *    permission whose requirement is not held is not held either, and that is what stops a page from
 *    being reachable while the data behind it is not.
 *
 * A permission only ever RESTRICTS; it never grants. Holding `access-example.view` still gets you
 * nothing on a note you may not read — which is why a cheap gesture like declaring a permission can
 * never become a privilege-escalation path.
 */

const message = (key: string): string => `@com.microteia.access-example/${key}`;

const NOTE_FIELDS: TemplateField[] = [
  { key: 'title', label: message('field.title'), type: 'text', required: true, order: 0, placeholder: message('field.title.placeholder') },
  { key: 'body', label: message('field.body'), type: 'textarea', required: false, order: 1 },
  { key: 'published', label: message('field.published'), type: 'checkbox', required: false, order: 2, filterable: true },
];

/**
 * The screen that costs no permission declaration. Installing it is what creates `accessNote.read`,
 * `accessNote.create`, `accessNote.update` and `accessNote.delete` in the office's catalog — the
 * platform derives the four from the collection, and no line below asks for them.
 */
const NOTE_SCREEN: ScreenModuleTemplate = {
  key: 'accessNote',
  sourceId: 'microteia:access-example:note',
  sourceRev: 1,
  titleSingular: message('screen.note'),
  titlePlural: message('screen.note.plural'),
  icon: 'fileText',
  fields: NOTE_FIELDS,
  titleFieldKey: 'title',
  eventPrefix: 'accessNote',
};

const BOARD: WidgetSpec = {
  type: 'stack',
  gap: 'lg',
  children: [
    { type: 'heading', text: message('board.heading') },
    { type: 'markdown', content: message('board.body') },
    { type: 'divider' },
    {
      type: 'keyValue',
      items: [
        { label: message('board.free'), value: message('board.free.value') },
        { label: message('board.declared'), value: message('board.declared.value') },
      ],
    },
    { type: 'banner', message: message('board.note'), variant: 'info' },
  ],
};

export const accessExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.access-example',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      accessMessagesContribution(),
      accessPtBrContribution(),

      /**
       * The RESOURCE. It exists to give a name to something the permissions talk about when that
       * something is not a screen collection — here, a board that is another way of looking at notes
       * that already exist. Without it the two permissions below would be about nothing.
       */
      accessResourceContribution({ id: 'access-example', name: message('resource.board') }),

      /**
       * Opening the board and reading the notes are ONE capability, not two. A board you may open but
       * whose rows you may not read is an empty screen with no explanation — so reading comes with it,
       * declared in `requires` rather than left to whoever assembles the profile to remember.
       */
      accessPermissionContribution({
        id: 'access-example.view',
        name: message('permission.view'),
        description: message('permission.view.description'),
        requires: ['accessNote.read'],
      }),

      /**
       * A GESTURE, not a screen. Publishing is writing, so its closure carries the update — and this
       * is the shape to copy whenever an extension offers an action that is not simply "open a thing".
       */
      accessPermissionContribution({
        id: 'access-example.publish',
        name: message('permission.publish'),
        description: message('permission.publish.description'),
        requires: ['accessNote.read', 'accessNote.update'],
      }),

      /**
       * Where the permission is ENFORCED in the interface. Absent, the item shows for every member;
       * present, it is a list and holding ONE of them is enough — the same question `canAny` asks.
       *
       * Both the menu item and the page carry it, and that is not redundancy: the menu item is how it
       * is found, the page is how it is reached, and a deep link reaches the page without ever passing
       * through the menu.
       */
      nav({
        key: 'access-example-board',
        label: message('nav.board'),
        icon: 'fileText',
        order: 105,
        requiredPermissions: ['access-example.view'],
      }),
      widgetPage(
        {
          key: 'access-example-board',
          title: message('page.board'),
          icon: 'fileText',
          requiredPermissions: ['access-example.view'],
        },
        BOARD,
      ),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [NOTE_SCREEN],
};
