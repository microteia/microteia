import {
  RiApps2Line,
  RiCursorLine,
  RiDivideLine,
  RiFontSize,
  RiHeading,
  RiImageCircleLine,
  RiLayoutColumnLine,
  RiLayoutRowLine,
  RiListCheck2,
  RiListUnordered,
  RiPriceTag3Line,
  RiSpace,
  RiStarSmileLine,
  RiText,
  RiInputField,
} from 'react-icons/ri';
import {
  CARD_TEMPLATE_MAX_DEPTH,
  CARD_TEMPLATE_MAX_NODES,
  DEFAULT_CARD_BODY,
} from '../../../domain/schema/ui/cardTemplate';
import type { TemplateNode } from './templateTree';
import type { TemplateOption, TemplatePropertySpec, TemplateVocabulary } from './templateVocabulary';

/**
 * O vocabulário do cartão da listagem (`ScreenDefinition.cardTemplate`) para o designer visual.
 *
 * As listas de opção repetem as de `cardTemplate.ts` em ordem e valor — `cardDesignerVocabulary.test.ts`
 * reprova a divergência, e reprova também um tipo de nó novo na DSL sem descrição aqui. Os padrões
 * (`defaultValue`) são os que `resolveCardNodes` e o estilo do cartão aplicam quando a chave falta.
 */

const option = (value: string, label: string): TemplateOption => ({ value, label });

const SIZE_OPTIONS = {
  xs: option('xs', '@core.records/template-designer.option.size.xs'),
  sm: option('sm', '@core.records/template-designer.option.size.sm'),
  md: option('md', '@core.records/template-designer.option.size.md'),
  lg: option('lg', '@core.records/template-designer.option.size.lg'),
  xl: option('xl', '@core.records/template-designer.option.size.xl'),
};

const GAP_OPTIONS = [SIZE_OPTIONS.xs, SIZE_OPTIONS.sm, SIZE_OPTIONS.md, SIZE_OPTIONS.lg];
const WIDTH_OPTIONS = [SIZE_OPTIONS.sm, SIZE_OPTIONS.md, SIZE_OPTIONS.lg];
const TEXT_SIZE_OPTIONS = [SIZE_OPTIONS.xs, SIZE_OPTIONS.sm, SIZE_OPTIONS.md, SIZE_OPTIONS.lg, SIZE_OPTIONS.xl];

const TONE_OPTIONS = [
  option('default', '@core.records/template-designer.option.tone.default'),
  option('muted', '@core.records/template-designer.option.tone.muted'),
  option('primary', '@core.records/template-designer.option.tone.primary'),
  option('success', '@core.records/template-designer.option.tone.success'),
  option('warning', '@core.records/template-designer.option.tone.warning'),
  option('danger', '@core.records/template-designer.option.tone.danger'),
];

const ALIGN_OPTIONS = [
  option('start', '@core.records/template-designer.option.align.start'),
  option('center', '@core.records/template-designer.option.align.center'),
  option('end', '@core.records/template-designer.option.align.end'),
];

const JUSTIFY_OPTIONS = [
  option('start', '@core.records/template-designer.option.justify.start'),
  option('between', '@core.records/template-designer.option.justify.between'),
  option('end', '@core.records/template-designer.option.justify.end'),
];

const VARIANT_OPTIONS = [
  option('text', '@core.records/template-designer.option.variant.text'),
  option('muted', '@core.records/template-designer.option.variant.muted'),
  option('strong', '@core.records/template-designer.option.variant.strong'),
  option('badge', '@core.records/template-designer.option.variant.badge'),
];

const PLACEMENT_OPTIONS = [
  option('hover', '@core.records/template-designer.option.placement.hover'),
  option('inline', '@core.records/template-designer.option.placement.inline'),
];

const HIDDEN_WHEN: TemplatePropertySpec = {
  kind: 'expression',
  key: 'hiddenWhen',
  label: '@core.records/template-designer.property.hidden-when',
};

const enumProperty = (key: string, label: string, options: readonly TemplateOption[], defaultValue: string): TemplatePropertySpec =>
  ({ kind: 'enum', key, label, options, defaultValue });

const GAP = enumProperty('gap', '@core.records/template-designer.property.gap', GAP_OPTIONS, 'sm');

const summaryOfField = (node: TemplateNode, context: { fieldLabel: (key: string) => string | undefined }) =>
  typeof node.field === 'string' ? context.fieldLabel(node.field) ?? node.field : undefined;

export const CARD_DESIGNER_VOCABULARY: TemplateVocabulary = {
  nodes: [
    {
      type: 'avatar',
      label: '@core.records/card-template.designer.node.avatar',
      icon: RiImageCircleLine,
      group: 'record',
      create: () => ({ type: 'avatar' }),
      properties: [enumProperty('size', '@core.records/template-designer.property.size', WIDTH_OPTIONS, 'md'), HIDDEN_WHEN],
    },
    {
      type: 'title',
      label: '@core.records/card-template.designer.node.title',
      icon: RiHeading,
      group: 'record',
      create: () => ({ type: 'title' }),
      properties: [enumProperty('size', '@core.records/template-designer.property.size', TEXT_SIZE_OPTIONS, 'md'), HIDDEN_WHEN],
    },
    {
      type: 'subtitle',
      label: '@core.records/card-template.designer.node.subtitle',
      icon: RiFontSize,
      group: 'record',
      create: () => ({ type: 'subtitle' }),
      properties: [HIDDEN_WHEN],
    },
    {
      type: 'metaRows',
      label: '@core.records/card-template.designer.node.meta-rows',
      icon: RiListUnordered,
      group: 'record',
      create: () => ({ type: 'metaRows' }),
      properties: [HIDDEN_WHEN],
    },
    {
      type: 'fields',
      label: '@core.records/card-template.designer.node.fields',
      icon: RiListCheck2,
      group: 'record',
      create: () => ({ type: 'fields' }),
      properties: [HIDDEN_WHEN],
    },
    {
      type: 'tags',
      label: '@core.records/card-template.designer.node.tags',
      icon: RiPriceTag3Line,
      group: 'record',
      create: () => ({ type: 'tags' }),
      properties: [HIDDEN_WHEN],
    },
    {
      type: 'actions',
      label: '@core.records/card-template.designer.node.actions',
      icon: RiCursorLine,
      group: 'record',
      create: () => ({ type: 'actions', placement: 'hover' }),
      properties: [
        enumProperty('placement', '@core.records/template-designer.property.placement', PLACEMENT_OPTIONS, 'inline'),
        { kind: 'actionKeys', key: 'include', label: '@core.records/template-designer.property.include' },
        { kind: 'actionKeys', key: 'exclude', label: '@core.records/template-designer.property.exclude' },
        HIDDEN_WHEN,
      ],
    },
    {
      type: 'field',
      label: '@core.records/card-template.designer.node.field',
      icon: RiInputField,
      group: 'content',
      create: () => ({ type: 'field', field: '' }),
      properties: [
        { kind: 'field', key: 'field', label: '@core.records/template-designer.property.field', required: true },
        { kind: 'fieldLabel', key: 'label', label: '@core.records/template-designer.property.label' },
        enumProperty('variant', '@core.records/template-designer.property.variant', VARIANT_OPTIONS, 'text'),
        enumProperty('size', '@core.records/template-designer.property.size', TEXT_SIZE_OPTIONS, 'sm'),
        { kind: 'icon', key: 'icon', label: '@core.records/template-designer.property.icon' },
        { kind: 'boolean', key: 'showEmpty', label: '@core.records/template-designer.property.show-empty' },
        HIDDEN_WHEN,
      ],
      summary: summaryOfField,
    },
    {
      type: 'text',
      label: '@core.records/card-template.designer.node.text',
      icon: RiText,
      group: 'content',
      create: () => ({ type: 'text', text: '' }),
      properties: [
        { kind: 'text', key: 'text', label: '@core.records/template-designer.property.text', required: true },
        enumProperty('tone', '@core.records/template-designer.property.tone', TONE_OPTIONS, 'default'),
        enumProperty('size', '@core.records/template-designer.property.size', TEXT_SIZE_OPTIONS, 'sm'),
        HIDDEN_WHEN,
      ],
      summary: (node, context) => (typeof node.text === 'string' && node.text.trim() ? context.label(node.text) : undefined),
    },
    {
      type: 'icon',
      label: '@core.records/card-template.designer.node.icon',
      icon: RiStarSmileLine,
      group: 'content',
      create: () => ({ type: 'icon', icon: 'star' }),
      properties: [
        { kind: 'icon', key: 'icon', label: '@core.records/template-designer.property.icon', required: true },
        enumProperty('tone', '@core.records/template-designer.property.tone', TONE_OPTIONS, 'muted'),
        HIDDEN_WHEN,
      ],
    },
    {
      type: 'row',
      label: '@core.records/card-template.designer.node.row',
      icon: RiLayoutColumnLine,
      group: 'structure',
      container: 'row',
      create: () => ({ type: 'row', gap: 'sm', children: [] }),
      properties: [
        GAP,
        enumProperty('align', '@core.records/template-designer.property.align', ALIGN_OPTIONS, 'center'),
        enumProperty('justify', '@core.records/template-designer.property.justify', JUSTIFY_OPTIONS, 'start'),
        { kind: 'boolean', key: 'wrap', label: '@core.records/template-designer.property.wrap' },
        HIDDEN_WHEN,
      ],
    },
    {
      type: 'stack',
      label: '@core.records/card-template.designer.node.stack',
      icon: RiLayoutRowLine,
      group: 'structure',
      container: 'column',
      create: () => ({ type: 'stack', gap: 'xs', children: [] }),
      properties: [GAP, HIDDEN_WHEN],
    },
    {
      type: 'spacer',
      label: '@core.records/card-template.designer.node.spacer',
      icon: RiSpace,
      group: 'structure',
      create: () => ({ type: 'spacer' }),
      properties: [HIDDEN_WHEN],
    },
    {
      type: 'divider',
      label: '@core.records/card-template.designer.node.divider',
      icon: RiDivideLine,
      group: 'structure',
      create: () => ({ type: 'divider' }),
      properties: [HIDDEN_WHEN],
    },
  ],
  rootProperties: [
    { kind: 'field', key: 'accent.field', label: '@core.records/card-template.designer.accent', fieldTypes: ['select'] },
  ],
  fieldNode: (fieldKey) => ({ type: 'field', field: fieldKey }),
  defaultBody: () => JSON.parse(JSON.stringify(DEFAULT_CARD_BODY)) as unknown[],
  rootDepth: 2,
  maxDepth: CARD_TEMPLATE_MAX_DEPTH,
  maxNodes: CARD_TEMPLATE_MAX_NODES,
  issueRoot: 'cardTemplate',
  bodyKey: 'body',
};

/** O ícone genérico do nó que este vocabulário não conhece. */
export const UNKNOWN_NODE_ICON = RiApps2Line;
