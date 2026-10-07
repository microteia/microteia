import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import type { WidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import { recordSurface } from '../../../../domain/schema/ui/uiExtensionPoints';
import { surfaceTab, surfaceTabSpec } from '../../../contributionBuilders';
import { mergeViewSources } from '../../../../sdk/mergeSources';
import TIMELINE_VIEW from './views/Timeline.view.tsx?raw';
import TIMELINE_VIEWMODEL from './views/Timeline.viewmodel.tsx?raw';
import TIMELINE_STYLES from './views/Timeline.styles.tsx?raw';
import { recordTabMessagesContribution } from './recordTabMessages';
import { recordTabPtBrContribution } from './recordTabMessagesPtBr';

/**
 * **Record tabs, by example** — showing something INSIDE a record of a screen.
 *
 * | What | How |
 * |---|---|
 * | where the tab goes | `recordSurface(<screen sourceId>)` — the record detail of THAT screen |
 * | a tab with its own look | `surfaceTab(metadata, viewKey)` + a view that receives `RecordTabProps` |
 * | a tab with no code | `surfaceTabSpec(metadata, spec)` — a Widget DSL tree, which receives no data |
 * | the children of the open record | `useEntityList(sourceId, { parent: { fieldKey, recordId } })` |
 *
 * The tab is addressed by the screen's `sourceId`, never by its installed key: the key may be
 * disambiguated on install, the `sourceId` does not change. That is also what lets a tab go on a screen
 * of ANOTHER extension — declare that extension in `dependencies`, and `check` will confirm it can see
 * the screen (it warns, never refuses, when it cannot).
 *
 * Both screens are this package's here only so the example installs on its own. Milestone is NOT a
 * child of Project (`parentEntity` is absent): a child screen would get the generic embedded list as a
 * tab, and the point of this example is the tab that draws whatever it wants.
 */

const message = (key: string): string => `@com.microteia.record-tab-example/${key}`;

const PROJECT_SOURCE_ID = 'microteia:record-tab-example:project';
const PROJECT_SURFACE = recordSurface(PROJECT_SOURCE_ID);

const PROJECT_FIELDS: TemplateField[] = [
  { key: 'name', label: message('field.name'), type: 'text', required: true, order: 0 },
  { key: 'description', label: message('field.description'), type: 'textarea', required: false, order: 1 },
];

const PROJECT_SCREEN: ScreenModuleTemplate = {
  key: 'recordTabProject',
  sourceId: PROJECT_SOURCE_ID,
  sourceRev: 1,
  titleSingular: message('screen.project'),
  titlePlural: message('screen.project.plural'),
  icon: 'briefcase',
  fields: PROJECT_FIELDS,
  titleFieldKey: 'name',
  eventPrefix: 'recordTabProject',
};

/**
 * `project` is a plain reference — the field the timeline locks its list to. `refEntity` names the
 * collection pointed at, which for a screen of this package is its template key.
 */
const MILESTONE_FIELDS: TemplateField[] = [
  { key: 'title', label: message('field.title'), type: 'text', required: true, order: 0 },
  { key: 'project', label: message('field.project'), type: 'reference', required: true, order: 1, refEntity: 'recordTabProject' },
  { key: 'dueDate', label: message('field.dueDate'), type: 'date', required: false, order: 2, filterable: true },
  {
    key: 'priority',
    label: message('field.priority'),
    type: 'select',
    required: false,
    order: 3,
    filterable: true,
    optionsColored: true,
    options: [
      { key: 'high', label: message('field.priority.high'), color: 'danger' },
      { key: 'medium', label: message('field.priority.medium'), color: 'warning' },
      { key: 'low', label: message('field.priority.low'), color: 'success' },
    ],
  },
  { key: 'done', label: message('field.done'), type: 'checkbox', required: false, order: 4 },
];

const MILESTONE_SCREEN: ScreenModuleTemplate = {
  key: 'recordTabMilestone',
  sourceId: 'microteia:record-tab-example:milestone',
  sourceRev: 1,
  titleSingular: message('screen.milestone'),
  titlePlural: message('screen.milestone.plural'),
  icon: 'flag',
  fields: MILESTONE_FIELDS,
  titleFieldKey: 'title',
  eventPrefix: 'recordTabMilestone',
};

const ABOUT: WidgetSpec = {
  type: 'stack',
  gap: 'lg',
  children: [
    { type: 'heading', text: message('about.heading') },
    { type: 'markdown', content: message('about.body') },
  ],
};

/**
 * The view in three files, merged into the one module the runtime evaluates. From the office you write
 * `sourceFile: ['./views/Timeline.view.tsx', ...]` and the compiler does the same merge.
 */
const TIMELINE_SOURCE = mergeViewSources({
  'Timeline.view.tsx': TIMELINE_VIEW,
  'Timeline.viewmodel.tsx': TIMELINE_VIEWMODEL,
  'Timeline.styles.tsx': TIMELINE_STYLES,
});

export const recordTabExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.record-tab-example',
    version: '1.0.0',
    kernel: '^2.19.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      recordTabMessagesContribution(),
      recordTabPtBrContribution(),

      /**
       * The code tab. `'timeline'` is the key of the view below; the host renders it with
       * `RecordTabProps` — the open record, its collection and the screen's sourceId — and only for a
       * saved record. The organization turns it on and off, and orders it, in Settings > Record tabs.
       */
      surfaceTab(
        {
          surface: PROJECT_SURFACE,
          key: 'record-tab-example.timeline',
          title: message('tab.timeline'),
          description: message('tab.timeline.description'),
          icon: 'calendarSchedule',
          order: 10,
        },
        'timeline',
      ),

      /** The declarative tab: no code, no trust gesture, and no data either. */
      surfaceTabSpec(
        {
          surface: PROJECT_SURFACE,
          key: 'record-tab-example.about',
          title: message('tab.about'),
          description: message('tab.about.description'),
          icon: 'information',
          order: 20,
        },
        ABOUT,
      ),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [PROJECT_SCREEN, MILESTONE_SCREEN],
  views: [
    { key: 'timeline', title: message('tab.timeline'), icon: 'calendarSchedule', source: TIMELINE_SOURCE },
  ],
};
