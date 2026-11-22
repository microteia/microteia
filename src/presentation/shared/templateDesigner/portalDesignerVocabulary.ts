import { RiCursorLine, RiEditLine, RiHistoryLine, RiLayoutTopLine, RiListCheck2, RiTextWrap } from 'react-icons/ri';
import {
  DEFAULT_PORTAL_CARD_BODY,
  DEFAULT_PORTAL_DETAIL_BODY,
  PORTAL_TEMPLATE_MAX_DEPTH,
  PORTAL_TEMPLATE_MAX_NODES,
} from '../../../domain/schema/ui/portalTemplate';
import type { TemplateNodeSpec, TemplateVocabulary } from './templateVocabulary';
import { fieldNodeOf, gapProperty, hiddenWhenProperty, sharedNodeSpecs } from './templateDesignerParts';

/**
 * Os vocabulários dos desenhos do portal (`portal.template.card` e `portal.template.detail`) para o
 * designer visual. O convidado vê só a PROJEÇÃO: não há avatar, etiqueta nem ação de cartão, e há o
 * que só o portal tem — a linha de resumo, a data da atualização, a seção com título e, no registro
 * aberto, o botão de alterar e as ações.
 *
 * Os campos que o designer oferece são os EXPOSTOS (quem monta o painel filtra); a condição de
 * esconder também só lê o que o convidado vê, e a dica dela diz isso.
 * `portalDesignerVocabulary.test.ts` confere cada vocabulário contra a DSL do portal.
 */

const HIDDEN_WHEN = hiddenWhenProperty('@core.records/portal-template.designer.hidden-when.hint');
const shared = sharedNodeSpecs(HIDDEN_WHEN);

const SUMMARY: TemplateNodeSpec = {
  type: 'summary',
  label: '@core.records/portal-template.designer.node.summary',
  icon: RiTextWrap,
  group: 'record',
  create: () => ({ type: 'summary' }),
  properties: [HIDDEN_WHEN],
};

const UPDATED: TemplateNodeSpec = {
  type: 'updated',
  label: '@core.records/portal-template.designer.node.updated',
  icon: RiHistoryLine,
  group: 'record',
  create: () => ({ type: 'updated' }),
  properties: [HIDDEN_WHEN],
};

const FIELDS: TemplateNodeSpec = {
  type: 'fields',
  label: '@core.records/portal-template.designer.node.fields',
  icon: RiListCheck2,
  group: 'record',
  create: () => ({ type: 'fields' }),
  properties: [
    { kind: 'fieldKeys', key: 'exclude', label: '@core.records/portal-template.designer.fields-exclude' },
    HIDDEN_WHEN,
  ],
};

const SECTION: TemplateNodeSpec = {
  type: 'section',
  label: '@core.records/portal-template.designer.node.section',
  icon: RiLayoutTopLine,
  group: 'structure',
  container: 'column',
  create: () => ({ type: 'section', children: [] }),
  properties: [
    { kind: 'text', key: 'title', label: '@core.records/template-designer.property.title' },
    gapProperty('md'),
    HIDDEN_WHEN,
  ],
  summary: (node, context) => (typeof node.title === 'string' && node.title.trim() ? context.label(node.title) : undefined),
};

const EDIT: TemplateNodeSpec = {
  type: 'edit',
  label: '@core.records/portal-template.designer.node.edit',
  icon: RiEditLine,
  group: 'record',
  create: () => ({ type: 'edit' }),
  properties: [HIDDEN_WHEN],
};

const ACTIONS: TemplateNodeSpec = {
  type: 'actions',
  label: '@core.records/card-template.designer.node.actions',
  icon: RiCursorLine,
  group: 'record',
  create: () => ({ type: 'actions' }),
  properties: [HIDDEN_WHEN],
};

const COMMON_NODES: readonly TemplateNodeSpec[] = [
  shared.title,
  SUMMARY,
  UPDATED,
  FIELDS,
  shared.field,
  shared.text,
  shared.icon,
  shared.row,
  shared.stack,
  SECTION,
  shared.spacer,
  shared.divider,
];

const copy = (body: readonly unknown[]): unknown[] => JSON.parse(JSON.stringify(body)) as unknown[];

const base = {
  fieldNode: fieldNodeOf,
  rootDepth: 2,
  maxDepth: PORTAL_TEMPLATE_MAX_DEPTH,
  maxNodes: PORTAL_TEMPLATE_MAX_NODES,
  bodyKey: 'body',
};

/** O cartão das listas do portal — sem `edit`/`actions`: no cartão, o toque abre o registro. */
export const PORTAL_CARD_DESIGNER_VOCABULARY: TemplateVocabulary = {
  ...base,
  rootLabel: '@core.records/portal-template.designer.root.card',
  nodes: COMMON_NODES,
  rootProperties: [
    { kind: 'field', key: 'accent.field', label: '@core.records/card-template.designer.accent', fieldTypes: ['select'] },
  ],
  defaultBody: () => copy(DEFAULT_PORTAL_CARD_BODY),
  issueRoot: 'portal.template.card',
};

/** O registro aberto no portal — o que o cartão tem, mais o botão de alterar e as ações. */
export const PORTAL_DETAIL_DESIGNER_VOCABULARY: TemplateVocabulary = {
  ...base,
  rootLabel: '@core.records/portal-template.designer.root.detail',
  nodes: [...COMMON_NODES, EDIT, ACTIONS],
  rootProperties: [],
  defaultBody: () => copy(DEFAULT_PORTAL_DETAIL_BODY),
  issueRoot: 'portal.template.detail',
};
