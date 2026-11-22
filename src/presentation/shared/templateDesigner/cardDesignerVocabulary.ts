import {
  RiApps2Line,
  RiCursorLine,
  RiFontSize,
  RiImageCircleLine,
  RiListCheck2,
  RiListUnordered,
  RiPriceTag3Line,
} from 'react-icons/ri';
import {
  CARD_TEMPLATE_MAX_DEPTH,
  CARD_TEMPLATE_MAX_NODES,
  DEFAULT_CARD_BODY,
} from '../../../domain/schema/ui/cardTemplate';
import type { TemplateVocabulary } from './templateVocabulary';
import {
  PLACEMENT_OPTIONS,
  WIDTH_OPTIONS,
  enumProperty,
  fieldNodeOf,
  hiddenWhenProperty,
  sharedNodeSpecs,
} from './templateDesignerParts';

/**
 * O vocabulário do cartão da listagem (`ScreenDefinition.cardTemplate`) para o designer visual.
 *
 * As listas de opção repetem as de `cardTemplate.ts` em ordem e valor — `cardDesignerVocabulary.test.ts`
 * reprova a divergência, e reprova também um tipo de nó novo na DSL sem descrição aqui. Os padrões
 * (`defaultValue`) são os que `resolveCardNodes` e o estilo do cartão aplicam quando a chave falta.
 */

const HIDDEN_WHEN = hiddenWhenProperty('@core.records/card-template.designer.hidden-when.hint');
const shared = sharedNodeSpecs(HIDDEN_WHEN);

export const CARD_DESIGNER_VOCABULARY: TemplateVocabulary = {
  rootLabel: '@core.records/card-template.designer.root',
  nodes: [
    {
      type: 'avatar',
      label: '@core.records/card-template.designer.node.avatar',
      icon: RiImageCircleLine,
      group: 'record',
      create: () => ({ type: 'avatar' }),
      properties: [enumProperty('size', '@core.records/template-designer.property.size', WIDTH_OPTIONS, 'md'), HIDDEN_WHEN],
    },
    shared.title,
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
    shared.field,
    shared.text,
    shared.icon,
    shared.row,
    shared.stack,
    shared.spacer,
    shared.divider,
  ],
  rootProperties: [
    { kind: 'field', key: 'accent.field', label: '@core.records/card-template.designer.accent', fieldTypes: ['select'] },
  ],
  fieldNode: fieldNodeOf,
  defaultBody: () => JSON.parse(JSON.stringify(DEFAULT_CARD_BODY)) as unknown[],
  rootDepth: 2,
  maxDepth: CARD_TEMPLATE_MAX_DEPTH,
  maxNodes: CARD_TEMPLATE_MAX_NODES,
  issueRoot: 'cardTemplate',
  bodyKey: 'body',
};

/** O ícone genérico do nó que este vocabulário não conhece. */
export const UNKNOWN_NODE_ICON = RiApps2Line;
