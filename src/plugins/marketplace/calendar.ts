import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import type { ExtensionPointDefinition } from '../../domain/schema/plugin/extensionPoint';
import { nav, navGroup, page, settingsSection } from '../contributionBuilders';
import { calendarMessagesContribution } from './calendarMessages';
import { calendarPtBrContribution } from './calendarMessagesPtBr';
import { mergeViewSources } from '../../sdk/mergeSources';
import CALENDAR_VIEW from './views/calendar/Calendar.view.tsx?raw';
import CALENDAR_VIEWMODEL from './views/calendar/Calendar.viewmodel.tsx?raw';
import CALENDAR_STYLES from './views/calendar/Calendar.styles.tsx?raw';
import CALENDAR_RULES from './views/calendar/Calendar.rules.ts?raw';

/**
 * A view em QUATRO arquivos, fundidos num módulo só — a mesma fusão que o compilador do SDK faz por uma
 * lista de `sourceFile`, aqui feita na declaração porque o catálogo embutido entrega o pacote direto ao
 * runtime do browser.
 *
 * A agenda cabia num arquivo de 784 linhas, e o que isso custava não era estética: a regra de que dia um
 * cartão ocupa vivia dentro de um `useMemo`, e conferi-la exigia abrir a tela e olhar. Agora
 * `Calendar.rules.ts` não importa nada, e `Calendar.rules.test.ts` a exercita em um segundo.
 */
const CALENDAR_SOURCE = mergeViewSources({
  'Calendar.view.tsx': CALENDAR_VIEW,
  'Calendar.viewmodel.tsx': CALENDAR_VIEWMODEL,
  'Calendar.styles.tsx': CALENDAR_STYLES,
  'Calendar.rules.ts': CALENDAR_RULES,
});

/**
 * **Calendar** — the office agenda, agnostic. It was the last screen of kernel code that knew a
 * business entity: it read deadlines, wrote deadlines, and knew what "overdue", "done" and "critical
 * priority" meant. Here it does not know what it shows.
 *
 * What it does know is ONE entity of its own — `calendar` — whose only purpose is to appear on the
 * agenda. Whoever has a date to show (a deadline, a hearing, an instalment) keeps an item here and
 * answers for it: creating, updating and deleting it as the origin record changes. The calendar never
 * writes to the origin record, and so it does not need to know it exists — it keeps only `origem`
 * (the COLLECTION) and `origemId`, and it is that pair that makes clicking a card open the right
 * record.
 *
 * **The card gestures are configuration of the SCREEN, not of this code.** They come from "Card
 * actions in the list" in the Form Design of the Calendar entity — the same list every list in the
 * system uses, and the one the office edits freely. An extension that wants to offer a gesture adds
 * its Action to that list through the screen patch; there is no extension point of its own for it,
 * because there would then be two sources for the same question ("what appears on this card?") and
 * the user could only reach one of them.
 *
 * The only point of its own is the DRAG one — `calendar.moveaction` — and it is its own because it
 * has no equivalent anywhere else: no list has a "change day" gesture, so there is no Form Design
 * list where it would fit. The contribution points at an office Action through `sourceId` (the
 * `templateId` of the package that installed it), the stable address given that the real id is born
 * at install time. Dragging writes nothing on its own: what "change day" means is decided by the
 * origin, which may postpone the deadline, move the hearing or refuse the move.
 *
 * An agenda serves every kind of business, so the extension is written in the source language and
 * carries its own Portuguese translation. Nothing below is a phrase: every label is a reference into
 * `calendarMessages.ts`, resolved at render time by whoever reads it.
 */
const SOURCE_ID = 'microteia:calendar';

const CALENDAR_MOVE_POINT = 'calendar.moveaction';

/**
 * How an origin presents ITSELF on the agenda. Metadata only, like the drag point, and for the same
 * reason: a third party that cannot ship code dresses its cards through the same door as a first-party
 * extension. Every key is optional except `origem` (the collection, matched exactly):
 *
 * - `label`, `icon`, `color`: the tag at the top of the card. Without them the tag is DERIVED from the
 *   screen that presents the collection — its name and icon —, so an origin that declares nothing is
 *   still told apart.
 * - `subtitleFields`: item fields whose text, formatted by the field's type, makes the line under the
 *   title. Fields, never a template: words in a template would be a phrase no catalog translates.
 * - `metaFields`: the lines this origin's cards show, replacing the screen's list fields — which on a
 *   shared agenda belong to every origin at once.
 *
 * It is read at render time and never written on the item: changing the declaration reaches the
 * items already on the agenda. The office switches an origin off in Settings › Calendar, which hides
 * its items without stopping the origin from keeping them current.
 */
const CALENDAR_SOURCE_POINT = 'calendar.source';

/**
 * A reference into this extension's own catalog. The namespace is written out, not composed:
 * `npm run verify-messages` reads these calls and fails on a key that does not exist, and it can
 * only do that if the namespace is there to be read.
 */
const message = (key: string): string => `@com.microteia.calendar/${key}`;

const ITEM = message('section.item');
const DATES = message('section.dates');
const ORIGIN = message('section.origin');

const FIELDS: TemplateField[] = [
  { key: 'title', label: message('field.title'), type: 'text', required: true, order: 0, section: ITEM, placeholder: message('field.title.placeholder') },
  { key: 'status', label: message('field.status'), type: 'select', required: true, order: 1, section: ITEM, lookupCollection: 'calendarStatuses', optionsColored: true, filterable: true, placeholder: message('field.status.placeholder') },
  { key: 'priority', label: message('field.priority'), type: 'select', required: true, order: 2, section: ITEM, lookupCollection: 'calendarPriorities', optionsColored: true, filterable: true, placeholder: message('field.priority.placeholder') },
  { key: 'description', label: message('field.description'), type: 'textarea', required: false, order: 3, section: ITEM, placeholder: message('field.description.placeholder') },
  { key: 'date', label: message('field.date'), type: 'date', required: true, order: 4, section: DATES, filterable: true },
  { key: 'hour', label: message('field.hour'), type: 'time', required: false, order: 5, section: DATES },
  { key: 'finishDate', label: message('field.finish-date'), type: 'date', required: false, order: 6, section: DATES, filterable: true },
  { key: 'finishHour', label: message('field.finish-hour'), type: 'time', required: false, order: 7, section: DATES },
  // The pair that addresses the record which sent the item here. `origem` is the name of the
  // COLLECTION, not a label: it is what clicking the card uses to open the record on whichever
  // screen presents it today.
  { key: 'origem', label: message('field.origin'), type: 'text', required: true, order: 8, section: ORIGIN, filterable: true, placeholder: message('field.origin.placeholder') },
  { key: 'origemId', label: message('field.origin-id'), type: 'text', required: true, order: 9, section: ORIGIN },
];

const colored = (entries: [string, string, string][]): CustomFieldOption[] =>
  entries.map(([key, label, color]) => ({ key, label, color }));

/**
 * The two starting lists. The KEYS are stable and in English because what writes an item is an
 * automation from another extension — it needs a value that does not change when the office renames
 * the label. What the user reads is the `label`, and from install time on it belongs to the office.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'calendarStatuses',
    label: message('lookup.statuses'),
    options: colored([
      ['pending', message('status.pending'), 'warning'],
      ['closed', message('status.closed'), 'success'],
    ]),
  },
  {
    collection: 'calendarPriorities',
    label: message('lookup.priorities'),
    options: colored([
      ['low', message('priority.low'), 'success'],
      ['medium', message('priority.medium'), 'warning'],
      ['high', message('priority.high'), 'secondary'],
      ['critical', message('priority.critical'), 'danger'],
    ]),
  },
];

const CALENDAR_SCREEN: ScreenModuleTemplate = {
  key: 'calendar',
  sourceId: SOURCE_ID,
  sourceRev: 1,
  titleSingular: message('screen.singular'),
  titlePlural: message('screen.plural'),
  icon: 'calendar',
  fields: FIELDS,
  titleFieldKey: 'title',
  subtitleFieldKey: 'status',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  eventPrefix: 'calendar',
  /**
   * A calendar item is a MIRROR: the origin record is in charge of it, and editing it by hand would
   * create a parallel truth that the next write from the origin erases. That is why the card offers
   * no edit gesture and the raw list stays out of the menu.
   *
   * The wildcard rule guards it by the collection's own permission, and the real writer is the
   * origin automation, on the server, which does not go through it. Someone still has to be able to
   * clear an orphan item left by a broken sync, and that is what the delete permission is for.
   */
  listActions: [],
  sidebarOrder: 0,
  hideFromSidebar: true,
};

const EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: CALENDAR_MOVE_POINT,
    apiVersion: '1.0.0',
    title: message('point.move.title'),
    description: message('point.move.description'),
    ownerPluginId: 'com.microteia.calendar',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: CALENDAR_SOURCE_POINT,
    apiVersion: '1.0.0',
    title: message('point.source.title'),
    description: message('point.source.description'),
    ownerPluginId: 'com.microteia.calendar',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

/**
 * The agenda. Faithful to the one that lived in the kernel — the number bar, month navigation, day
 * columns with horizontal scrolling that opens on today, the card coloured by priority, dragging
 * between days and the legend that filters by priority — with three differences that make it
 * agnostic: the data comes from the `calendar` entity, the filter is the `CompositeFilter` over the
 * fields the screen declares (including the ones another extension added), and every gesture is a
 * third-party Action.
 */

export const calendarPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.calendar',
    version: '1.5.0',
    kernel: '^2.40.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    extensionPoints: EXTENSION_POINTS,
    contributes: [
      calendarMessagesContribution(),
      calendarPtBrContribution(),
      /**
       * The sidebar group this entry joins. The group key is universal: Business days declares the
       * same `schedule`, so either extension alone gets its entry in place, and both together share
       * one group — the first one loaded names it. A group with a single entry draws no header.
       */
      navGroup({ key: 'schedule', label: message('nav.group.schedule'), order: 20 }),
      nav({ key: 'calendar', label: message('nav.calendar'), icon: 'calendar', order: 20, group: 'schedule' }),
      page({ key: 'calendar', title: message('page.calendar'), icon: 'calendar' }, 'calendar'),
      settingsSection({
        key: 'calendar',
        title: message('settings.section.title'),
        description: message('settings.section.description'),
        icon: 'calendar',
        order: 30,
        properties: [
          {
            key: 'calendar.moveActions',
            label: message('settings.move-actions'),
            description: message('settings.move-actions.description'),
            type: 'contributions',
            point: CALENDAR_MOVE_POINT,
            default: [],
            scopes: ['tenant'],
          },
          {
            key: 'calendar.sources',
            label: message('settings.sources'),
            description: message('settings.sources.description'),
            type: 'contributions',
            point: CALENDAR_SOURCE_POINT,
            default: [],
            scopes: ['tenant'],
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
          { label: message('overview.shows'), value: message('overview.shows.value') },
          { label: message('overview.filter'), value: message('overview.filter.value') },
          { label: message('overview.drag'), value: message('overview.drag.value') },
          { label: message('overview.origin'), value: message('overview.origin.value') },
        ],
      },
      { type: 'banner', message: message('overview.banner'), variant: 'info' },
    ],
  },
  workflows: [],
  screens: [CALENDAR_SCREEN],
  lookups: LOOKUPS,
  views: [
    { key: 'calendar', title: message('page.calendar'), icon: 'calendar', source: CALENDAR_SOURCE },
  ],
};
