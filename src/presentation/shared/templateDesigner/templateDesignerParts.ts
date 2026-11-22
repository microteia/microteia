import {
  RiDivideLine,
  RiHeading,
  RiInputField,
  RiLayoutColumnLine,
  RiLayoutRowLine,
  RiSpace,
  RiStarSmileLine,
  RiText,
} from 'react-icons/ri';
import type { TemplateNode } from './templateTree';
import type { TemplateNodeSpec, TemplateOption, TemplatePropertySpec } from './templateVocabulary';

/**
 * As peças que o cartão da listagem e os desenhos do portal dividem: as listas de opção (os tokens são
 * os mesmos nas duas DSLs) e os nós que as duas declaram do mesmo jeito. Cada vocabulário compõe as
 * suas e acrescenta o que só ele tem — e o teste de cada um confere contra a própria DSL.
 */

const option = (value: string, label: string): TemplateOption => ({ value, label });

const SIZE = {
  xs: option('xs', '@core.records/template-designer.option.size.xs'),
  sm: option('sm', '@core.records/template-designer.option.size.sm'),
  md: option('md', '@core.records/template-designer.option.size.md'),
  lg: option('lg', '@core.records/template-designer.option.size.lg'),
  xl: option('xl', '@core.records/template-designer.option.size.xl'),
};

export const GAP_OPTIONS = [SIZE.xs, SIZE.sm, SIZE.md, SIZE.lg];
export const WIDTH_OPTIONS = [SIZE.sm, SIZE.md, SIZE.lg];
export const TEXT_SIZE_OPTIONS = [SIZE.xs, SIZE.sm, SIZE.md, SIZE.lg, SIZE.xl];

export const TONE_OPTIONS = [
  option('default', '@core.records/template-designer.option.tone.default'),
  option('muted', '@core.records/template-designer.option.tone.muted'),
  option('primary', '@core.records/template-designer.option.tone.primary'),
  option('success', '@core.records/template-designer.option.tone.success'),
  option('warning', '@core.records/template-designer.option.tone.warning'),
  option('danger', '@core.records/template-designer.option.tone.danger'),
];

export const ALIGN_OPTIONS = [
  option('start', '@core.records/template-designer.option.align.start'),
  option('center', '@core.records/template-designer.option.align.center'),
  option('end', '@core.records/template-designer.option.align.end'),
];

export const JUSTIFY_OPTIONS = [
  option('start', '@core.records/template-designer.option.justify.start'),
  option('between', '@core.records/template-designer.option.justify.between'),
  option('end', '@core.records/template-designer.option.justify.end'),
];

export const VARIANT_OPTIONS = [
  option('text', '@core.records/template-designer.option.variant.text'),
  option('muted', '@core.records/template-designer.option.variant.muted'),
  option('strong', '@core.records/template-designer.option.variant.strong'),
  option('badge', '@core.records/template-designer.option.variant.badge'),
];

export const PLACEMENT_OPTIONS = [
  option('hover', '@core.records/template-designer.option.placement.hover'),
  option('inline', '@core.records/template-designer.option.placement.inline'),
];

export const enumProperty = (
  key: string,
  label: string,
  options: readonly TemplateOption[],
  defaultValue: string,
): TemplatePropertySpec => ({ kind: 'enum', key, label, options, defaultValue });

/** O `hiddenWhen`, com a explicação de cada DSL — no portal a condição só lê o que o convidado vê. */
export const hiddenWhenProperty = (hint: string): TemplatePropertySpec => ({
  kind: 'expression',
  key: 'hiddenWhen',
  label: '@core.records/template-designer.property.hidden-when',
  hint,
});

export const gapProperty = (defaultValue: string): TemplatePropertySpec =>
  enumProperty('gap', '@core.records/template-designer.property.gap', GAP_OPTIONS, defaultValue);

const summaryOfField = (node: TemplateNode, context: { fieldLabel: (key: string) => string | undefined }) =>
  typeof node.field === 'string' ? context.fieldLabel(node.field) ?? node.field : undefined;

/** O nó que posiciona um campo — a entrada de cada campo na paleta. */
export const fieldNodeOf = (fieldKey: string): TemplateNode => ({ type: 'field', field: fieldKey });

/**
 * Os nós que as duas DSLs declaram igual, já com a condição de esconder de quem os usa. Os padrões são
 * os que o desenho aplica quando a chave falta — iguais no cartão e no portal.
 */
export const sharedNodeSpecs = (hiddenWhen: TemplatePropertySpec) => ({
  title: {
    type: 'title',
    label: '@core.records/card-template.designer.node.title',
    icon: RiHeading,
    group: 'record',
    create: () => ({ type: 'title' }),
    properties: [enumProperty('size', '@core.records/template-designer.property.size', TEXT_SIZE_OPTIONS, 'md'), hiddenWhen],
  },
  field: {
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
      hiddenWhen,
    ],
    summary: summaryOfField,
  },
  text: {
    type: 'text',
    label: '@core.records/card-template.designer.node.text',
    icon: RiText,
    group: 'content',
    create: () => ({ type: 'text', text: '' }),
    properties: [
      { kind: 'text', key: 'text', label: '@core.records/template-designer.property.text', required: true },
      enumProperty('tone', '@core.records/template-designer.property.tone', TONE_OPTIONS, 'default'),
      enumProperty('size', '@core.records/template-designer.property.size', TEXT_SIZE_OPTIONS, 'sm'),
      hiddenWhen,
    ],
    summary: (node, context) => (typeof node.text === 'string' && node.text.trim() ? context.label(node.text) : undefined),
  },
  icon: {
    type: 'icon',
    label: '@core.records/card-template.designer.node.icon',
    icon: RiStarSmileLine,
    group: 'content',
    create: () => ({ type: 'icon', icon: 'star' }),
    properties: [
      { kind: 'icon', key: 'icon', label: '@core.records/template-designer.property.icon', required: true },
      enumProperty('tone', '@core.records/template-designer.property.tone', TONE_OPTIONS, 'muted'),
      hiddenWhen,
    ],
  },
  row: {
    type: 'row',
    label: '@core.records/card-template.designer.node.row',
    icon: RiLayoutColumnLine,
    group: 'structure',
    container: 'row',
    create: () => ({ type: 'row', gap: 'sm', children: [] }),
    properties: [
      gapProperty('sm'),
      enumProperty('align', '@core.records/template-designer.property.align', ALIGN_OPTIONS, 'center'),
      enumProperty('justify', '@core.records/template-designer.property.justify', JUSTIFY_OPTIONS, 'start'),
      { kind: 'boolean', key: 'wrap', label: '@core.records/template-designer.property.wrap' },
      hiddenWhen,
    ],
  },
  stack: {
    type: 'stack',
    label: '@core.records/card-template.designer.node.stack',
    icon: RiLayoutRowLine,
    group: 'structure',
    container: 'column',
    create: () => ({ type: 'stack', gap: 'xs', children: [] }),
    properties: [gapProperty('sm'), hiddenWhen],
  },
  spacer: {
    type: 'spacer',
    label: '@core.records/card-template.designer.node.spacer',
    icon: RiSpace,
    group: 'structure',
    create: () => ({ type: 'spacer' }),
    properties: [hiddenWhen],
  },
  divider: {
    type: 'divider',
    label: '@core.records/card-template.designer.node.divider',
    icon: RiDivideLine,
    group: 'structure',
    create: () => ({ type: 'divider' }),
    properties: [hiddenWhen],
  },
}) satisfies Record<string, TemplateNodeSpec>;
