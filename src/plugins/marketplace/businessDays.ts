import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../domain/entities/MarketplacePlugin';
import { businessCalendarContribution } from '../../domain/schema/time/extensionPoints';
import { nav, page } from '../contributionBuilders';
import { businessDaysMessagesContribution } from './businessDaysMessages';
import { businessDaysPtBrContribution } from './businessDaysMessagesPtBr';
import { mergeViewSources } from '../../sdk/mergeSources';
import BUSINESS_DAYS_VIEW from './views/businessDays/BusinessDays.view.tsx?raw';
import BUSINESS_DAYS_VIEWMODEL from './views/businessDays/BusinessDays.viewmodel.tsx?raw';
import BUSINESS_DAYS_STYLES from './views/businessDays/BusinessDays.styles.tsx?raw';
import BUSINESS_DAYS_RULES from './views/businessDays/BusinessDays.rules.ts?raw';

/**
 * The grid in four files, merged into one module — the same merge the SDK compiler does for a list of
 * `sourceFile`s, done here because the built-in catalog hands the package straight to the browser.
 */
const BUSINESS_DAYS_SOURCE = mergeViewSources({
  'BusinessDays.view.tsx': BUSINESS_DAYS_VIEW,
  'BusinessDays.viewmodel.tsx': BUSINESS_DAYS_VIEWMODEL,
  'BusinessDays.styles.tsx': BUSINESS_DAYS_STYLES,
  'BusinessDays.rules.ts': BUSINESS_DAYS_RULES,
});

/**
 * **Business days** — where an office keeps its business-day calendars.
 *
 * The kernel already knows how to COUNT business days: `addBusinessDays`, `businessDaysBetween`,
 * `isBusinessDay` and `nextBusinessDay` are formula functions, the same in a form, in an automation and
 * in a report. What the kernel does not know is where the calendars live — and it must not, because a
 * collection name written in the kernel is exactly the coupling this platform exists to avoid. This
 * extension answers that through the `time.business.calendar` point: "my calendars are in
 * `businessCalendars`".
 *
 * A calendar is one document: a `name`, a `key` a formula writes to name it, the `weekend` (weekdays
 * that are never business days) and `years` — year → the days of that year that are not business
 * days. The last two are not form fields: no field type describes a map of years, and the grid is the
 * only place that edits them. The kernel reads them by the contract of `BUSINESS_CALENDAR_FIELDS`.
 *
 * Nothing here knows what a marked day MEANS. A holiday, a court recess, a warehouse inventory day —
 * that is the office's word, written in the calendar's name. A formula combines calendars by naming
 * several: the union wins, and a day that is not a business day in any of them is skipped.
 *
 * This extension does not depend on the Calendar (the agenda). They are different things: one shows
 * appointments, the other is a rule for counting days.
 */
const SOURCE_ID = 'microteia:business-calendars';

const COLLECTION = 'businessCalendars';

/** A reference into this extension's own catalog, written out so `verify-messages` can read it. */
const message = (key: string): string => `@com.microteia.business-days/${key}`;

const SECTION = message('section.calendar');

const FIELDS: TemplateField[] = [
  { key: 'name', label: message('field.name'), type: 'text', required: true, order: 0, section: SECTION, placeholder: message('field.name.placeholder') },
  { key: 'key', label: message('field.key'), type: 'text', required: true, order: 1, section: SECTION, placeholder: message('field.key.placeholder') },
];

const BUSINESS_CALENDAR_SCREEN: ScreenModuleTemplate = {
  key: 'businessCalendars',
  sourceId: SOURCE_ID,
  sourceRev: 1,
  dataCollection: COLLECTION,
  titleSingular: message('screen.singular'),
  titlePlural: message('screen.plural'),
  icon: 'calendar',
  fields: FIELDS,
  titleFieldKey: 'name',
  subtitleFieldKey: 'key',
  /**
   * The key is what a formula writes. Two calendars with the same key would make
   * `addBusinessDays(d, 15, "national")` count with whichever one came first — a wrong date nobody
   * notices. The key is unique, and case does not tell two keys apart.
   */
  keys: [{ name: 'key', kind: 'unique', fields: ['key'], normalize: { caseInsensitive: true } }],
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  eventPrefix: 'businessCalendar',
  listActions: [],
  sidebarOrder: 0,
  hideFromSidebar: true,
};

export const businessDaysPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.business-days',
    version: '1.0.0',
    kernel: '^2.37.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0', 'core.data': '^1.0.0' },
    contributes: [
      businessDaysMessagesContribution(),
      businessDaysPtBrContribution(),
      businessCalendarContribution({ collection: COLLECTION }),
      nav({ key: 'business-days', label: message('nav.business-days'), icon: 'calendar', order: 21 }),
      page({ key: 'business-days', title: message('page.business-days'), icon: 'calendar' }, 'business-days'),
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
          { label: message('overview.formulas'), value: message('overview.formulas.value') },
          { label: message('overview.years'), value: message('overview.years.value') },
        ],
      },
      { type: 'banner', message: message('overview.banner'), variant: 'info' },
    ],
  },
  workflows: [],
  screens: [BUSINESS_CALENDAR_SCREEN],
  views: [
    { key: 'business-days', title: message('page.business-days'), icon: 'calendar', source: BUSINESS_DAYS_SOURCE },
  ],
};
