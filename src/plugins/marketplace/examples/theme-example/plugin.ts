import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import type { ThemeSpec, ThemeTokenBundle } from '../../../../domain/schema/theme';
import { themeContribution, themeTokensContribution } from '../../../../domain/schema/theme';
import { themeMessagesContribution } from './themeMessages';
import { themePtBrContribution } from './themeMessagesPtBr';

/**
 * **Appearance, by example** — the two points, and why they are two.
 *
 * | Point | What it declares | How they combine |
 * |---|---|---|
 * | `theme.definition` | a whole palette | ONE wins — the one the office chose |
 * | `theme.tokens` | the colours of a vocabulary | ALL of them apply, together |
 *
 * The second is the half nobody demonstrates, and it is the one with a rule worth stating:
 *
 * **A TOKEN HAS ONE OWNER, and the owner is whoever declared the vocabulary.** The colour of "in
 * review" belongs to the package that declares what "in review" means — not to a palette. A theme
 * package that carried it would be opining on somebody else's word, and it would need to win an
 * install-order race to do so. Declaring it here means it holds in every theme, including ones written
 * years from now by people who never heard of this vocabulary.
 *
 * A palette keeps the right to override — it wins over any contributed token — but that is an escape
 * hatch, not the road. The road is that the owner declares.
 *
 * **A theme is PARTIAL.** `extends` names one of the kernel's two bases, and everything left out is
 * inherited. Declaring a whole palette to change three colours is how a theme falls behind the day the
 * kernel adds a token.
 */

const message = (key: string): string => `@com.microteia.theme-example/${key}`;

const ITEM_FIELDS: TemplateField[] = [
  { key: 'title', label: message('field.title'), type: 'text', required: true, order: 0 },
  {
    key: 'stage',
    label: message('field.stage'),
    type: 'select',
    required: true,
    order: 1,
    filterable: true,
    optionsColored: true,
    /**
     * The vocabulary this package owns. The `color` of each option names a TOKEN, and the bundle below
     * is what gives that token a value — which is why the two live in the same package.
     */
    options: [
      { key: 'draft', label: message('field.stage.draft'), color: 'exampleStageDraft' },
      { key: 'review', label: message('field.stage.review'), color: 'exampleStageReview' },
      { key: 'settled', label: message('field.stage.settled'), color: 'exampleStageSettled' },
    ],
  },
];

const ITEM_SCREEN: ScreenModuleTemplate = {
  key: 'themeItem',
  sourceId: 'microteia:theme-example:item',
  sourceRev: 1,
  titleSingular: message('screen.item'),
  titlePlural: message('screen.item.plural'),
  icon: 'fileList',
  fields: ITEM_FIELDS,
  titleFieldKey: 'title',
  eventPrefix: 'themeItem',
};

/**
 * The tokens of THIS package's vocabulary.
 *
 * `light` and `dark` are the two bases, and both are required: a token defined for only one of them
 * disappears on the other, and the symptom is a colourless badge that nobody connects to a theme.
 *
 * `themes` is the per-theme refinement — the same word, tuned for a palette that needs it. Naming a
 * theme that is not installed costs nothing: the entry is simply never read.
 */
const STAGE_TOKENS: ThemeTokenBundle = {
  light: {
    exampleStageDraft: '#6b7280',
    exampleStageReview: '#b45309',
    exampleStageSettled: '#15803d',
  },
  dark: {
    exampleStageDraft: '#9ca3af',
    exampleStageReview: '#f59e0b',
    exampleStageSettled: '#4ade80',
  },
  themes: {
    'theme-example-parchment': {
      exampleStageDraft: '#8a7f6d',
      exampleStageReview: '#a8621b',
      exampleStageSettled: '#4f6b3a',
    },
  },
};

/**
 * The palette. It declares only what differs from `light`, and it declares NO vocabulary of anyone
 * else's — including this package's own tokens above, which belong there and not here.
 */
const PARCHMENT: ThemeSpec = {
  id: 'theme-example-parchment',
  name: message('theme.name'),
  extends: 'light',
  colors: {
    background: '#f7f3e8',
    surface: '#fffdf7',
    surfaceHover: '#f1ead8',
    border: 'rgba(74, 62, 42, 0.16)',
    primary: '#8a6d3b',
    primaryHover: '#6f5730',
  },
};

export const themeExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.theme-example',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    icon: 'palette',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.theme': '^1.0.0' },
    contributes: [
      themeMessagesContribution(),
      themePtBrContribution(),
      themeTokensContribution('theme-example-stages', STAGE_TOKENS),
      themeContribution(PARCHMENT),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [ITEM_SCREEN],
};
