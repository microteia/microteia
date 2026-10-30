import {
  CARD_ACTIONS_PLACEMENTS,
  CARD_ALIGNS,
  CARD_FIELD_VARIANTS,
  CARD_GAPS,
  CARD_JUSTIFIES,
  CARD_LAYOUTS,
  CARD_NODE_TYPES,
  CARD_TEMPLATE_MAX_DEPTH,
  CARD_TEMPLATE_MAX_NODES,
  CARD_TEXT_SIZES,
  CARD_TONES,
  CARD_WIDTHS,
  isCardContainerType,
  isPlainCardObject,
} from './cardTemplate';
import type { CardNodeType } from './cardTemplate';
import { isScreenIconKey } from './screenIconCatalog';
import { fieldExpressionSyntaxError } from '../fieldExpression';

/** Um problema do template, já como frase do catálogo. `where` é o caminho dentro da declaração. */
export interface CardTemplateIssue {
  message: string;
  messageParams: Record<string, string>;
}

export interface CardTemplateFieldInfo {
  key: string;
  type: string;
}

/** As frases de cada problema — literais, para que `verify-messages` confira que existem. */
const ISSUE_KEYS = {
  'not-object': '@core.records/card-template.issue.not-object',
  'option': '@core.records/card-template.issue.option',
  'node-list': '@core.records/card-template.issue.node-list',
  'node-shape': '@core.records/card-template.issue.node-shape',
  'node-type': '@core.records/card-template.issue.node-type',
  'field-missing': '@core.records/card-template.issue.field-missing',
  'field-unknown': '@core.records/card-template.issue.field-unknown',
  'accent-field': '@core.records/card-template.issue.accent-field',
  'icon-unknown': '@core.records/card-template.issue.icon-unknown',
  'icon-missing': '@core.records/card-template.issue.icon-missing',
  'text-missing': '@core.records/card-template.issue.text-missing',
  'label': '@core.records/card-template.issue.label',
  'key-list': '@core.records/card-template.issue.key-list',
  'expression': '@core.records/card-template.issue.expression',
  'expression-type': '@core.records/card-template.issue.expression-type',
  'too-deep': '@core.records/card-template.issue.too-deep',
  'too-many': '@core.records/card-template.issue.too-many',
} as const;

type IssueCode = keyof typeof ISSUE_KEYS;

const issue = (code: IssueCode, where: string, params: Record<string, string> = {}): CardTemplateIssue => ({
  message: ISSUE_KEYS[code],
  messageParams: { where, ...params },
});

const ENUM_PROPERTIES: Partial<Record<CardNodeType, Record<string, readonly string[]>>> = {
  row: { gap: CARD_GAPS, align: CARD_ALIGNS, justify: CARD_JUSTIFIES },
  stack: { gap: CARD_GAPS },
  avatar: { size: CARD_WIDTHS },
  title: { size: CARD_TEXT_SIZES },
  field: { variant: CARD_FIELD_VARIANTS, size: CARD_TEXT_SIZES },
  actions: { placement: CARD_ACTIONS_PLACEMENTS },
  text: { tone: CARD_TONES, size: CARD_TEXT_SIZES },
  icon: { tone: CARD_TONES },
};

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

interface Walk {
  fields: Map<string, CardTemplateFieldInfo>;
  issues: CardTemplateIssue[];
  count: number;
}

const enumIssues = (node: Record<string, unknown>, type: CardNodeType, where: string): CardTemplateIssue[] =>
  Object.entries(ENUM_PROPERTIES[type] ?? {})
    .filter(([property]) => node[property] !== undefined && node[property] !== null)
    .filter(([property, allowed]) => !allowed.includes(node[property] as string))
    .map(([property, allowed]) => issue('option', `${where}.${property}`, {
      value: String(node[property]),
      allowed: allowed.join(', '),
    }));

const fieldIssues = (field: unknown, where: string, walk: Walk): CardTemplateIssue[] => {
  if (!isText(field)) return [issue('field-missing', where)];
  return walk.fields.has(field.trim()) ? [] : [issue('field-unknown', where, { field })];
};

const iconIssues = (icon: unknown, where: string): CardTemplateIssue[] =>
  isText(icon) && !isScreenIconKey(icon) ? [issue('icon-unknown', where, { icon })] : [];

const keyListIssues = (value: unknown, where: string): CardTemplateIssue[] =>
  value === undefined || value === null || (Array.isArray(value) && value.every(isText))
    ? []
    : [issue('key-list', where)];

const walkNodes = (raw: unknown, where: string, depth: number, walk: Walk): void => {
  if (!Array.isArray(raw)) {
    walk.issues.push(issue('node-list', where));
    return;
  }
  raw.forEach((entry, index) => walkNode(entry, `${where}[${index}]`, depth, walk));
};

const walkNode = (raw: unknown, where: string, depth: number, walk: Walk): void => {
  if (!isPlainCardObject(raw) || !isText(raw.type)) {
    walk.issues.push(issue('node-shape', where));
    return;
  }
  const type = raw.type as CardNodeType;
  if (!CARD_NODE_TYPES.includes(type)) {
    walk.issues.push(issue('node-type', `${where}.type`, { type: raw.type }));
    return;
  }
  walk.count += 1;
  walk.issues.push(...enumIssues(raw, type, where));

  const syntax = isText(raw.hiddenWhen) ? fieldExpressionSyntaxError(raw.hiddenWhen) : null;
  if (syntax) walk.issues.push(issue('expression', `${where}.hiddenWhen`, { error: syntax }));
  if (raw.hiddenWhen !== undefined && raw.hiddenWhen !== null && typeof raw.hiddenWhen !== 'string') {
    walk.issues.push(issue('expression-type', `${where}.hiddenWhen`));
  }

  switch (type) {
    case 'field':
      walk.issues.push(...fieldIssues(raw.field, `${where}.field`, walk), ...iconIssues(raw.icon, `${where}.icon`));
      if (raw.label !== undefined && raw.label !== true && raw.label !== false && !isText(raw.label)) {
        walk.issues.push(issue('label', `${where}.label`));
      }
      break;
    case 'text':
      if (!isText(raw.text)) walk.issues.push(issue('text-missing', `${where}.text`));
      break;
    case 'icon':
      if (!isText(raw.icon)) walk.issues.push(issue('icon-missing', `${where}.icon`));
      walk.issues.push(...iconIssues(raw.icon, `${where}.icon`));
      break;
    case 'actions':
      walk.issues.push(...keyListIssues(raw.include, `${where}.include`), ...keyListIssues(raw.exclude, `${where}.exclude`));
      break;
    default:
      break;
  }

  if (isCardContainerType(type)) {
    if (depth > CARD_TEMPLATE_MAX_DEPTH) {
      walk.issues.push(issue('too-deep', where, { max: String(CARD_TEMPLATE_MAX_DEPTH) }));
      return;
    }
    walkNodes(raw.children ?? [], `${where}.children`, depth + 1, walk);
  }
};

/**
 * O que está ERRADO num template, para quem ainda pode corrigir: o Form Design antes de gravar e o
 * `check` do pacote. A leitura (`readCardTemplate`) é tolerante e nunca recusa — ela serve a lista que
 * já está no ar; este é o portão da autoria, e por isso aponta cada problema com o caminho dele.
 *
 * Confere a FORMA e o que a tela consegue responder daqui: tipo de nó, opções, campo da tela, ícone do
 * catálogo, sintaxe da expressão e os tetos. Chave de ação não é conferida — a ação do escritório pode
 * ser ligada depois, e uma chave que não casa só não desenha nada.
 */
export const cardTemplateIssues = (
  raw: unknown,
  fields: readonly CardTemplateFieldInfo[],
  where = 'cardTemplate',
): CardTemplateIssue[] => {
  if (raw === undefined || raw === null) return [];
  if (!isPlainCardObject(raw)) return [issue('not-object', where)];

  const walk: Walk = { fields: new Map(fields.map((field) => [field.key, field])), issues: [], count: 0 };

  if (raw.layout !== undefined && raw.layout !== null && !CARD_LAYOUTS.includes(raw.layout as never)) {
    walk.issues.push(issue('option', `${where}.layout`, { value: String(raw.layout), allowed: CARD_LAYOUTS.join(', ') }));
  }
  if (raw.minWidth !== undefined && raw.minWidth !== null && !CARD_WIDTHS.includes(raw.minWidth as never)) {
    walk.issues.push(issue('option', `${where}.minWidth`, { value: String(raw.minWidth), allowed: CARD_WIDTHS.join(', ') }));
  }
  if (raw.accent !== undefined && raw.accent !== null) {
    const accentField = isPlainCardObject(raw.accent) ? raw.accent.field : undefined;
    const fieldProblems = fieldIssues(accentField, `${where}.accent.field`, walk);
    walk.issues.push(...fieldProblems);
    const declared = isText(accentField) ? walk.fields.get(accentField.trim()) : undefined;
    if (fieldProblems.length === 0 && declared && declared.type !== 'select') {
      walk.issues.push(issue('accent-field', `${where}.accent.field`, { field: String(accentField) }));
    }
  }
  if (raw.body !== undefined && raw.body !== null) walkNodes(raw.body, `${where}.body`, 2, walk);

  if (walk.count > CARD_TEMPLATE_MAX_NODES) {
    walk.issues.push(issue('too-many', where, { max: String(CARD_TEMPLATE_MAX_NODES) }));
  }
  return walk.issues;
};
