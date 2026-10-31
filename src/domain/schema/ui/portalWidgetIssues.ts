import {
  CARD_ALIGNS,
  CARD_FIELD_VARIANTS,
  CARD_GAPS,
  CARD_JUSTIFIES,
  CARD_LAYOUTS,
  CARD_TEXT_SIZES,
  CARD_TONES,
  CARD_WIDTHS,
  isPlainCardObject,
} from './cardTemplate';
import { PORTAL_TEMPLATE_MAX_DEPTH, PORTAL_TEMPLATE_MAX_NODES } from './portalTemplate';
import {
  PORTAL_WIDGET_NODE_TYPES,
  PORTAL_WIDGET_ORDER_DIRECTIONS,
  PORTAL_WIDGET_RECORDS_MAX_LIMIT,
  isPortalWidgetContainerType,
  isPortalWidgetNodeAllowed,
} from './portalWidget';
import type { PortalWidgetNodeType, PortalWidgetScope } from './portalWidget';
import type { CardTemplateFieldInfo, CardTemplateIssue } from './cardTemplateIssues';
import { isScreenIconKey } from './screenIconCatalog';
import { extractFieldExpressionPaths, fieldExpressionSyntaxError } from '../fieldExpression';

/**
 * As frases de cada problema — literais, para que `verify-messages` confira que existem. As de forma e de
 * campo são as do cartão e do desenho do portal, que dizem o mesmo; as do widget são as que só ele tem.
 */
const ISSUE_KEYS = {
  'not-object': '@core.records/portal-widget.issue.not-object',
  'body': '@core.records/portal-widget.issue.body',
  'option': '@core.records/card-template.issue.option',
  'node-list': '@core.records/card-template.issue.node-list',
  'node-shape': '@core.records/card-template.issue.node-shape',
  'node-type': '@core.records/card-template.issue.node-type',
  'field-missing': '@core.records/card-template.issue.field-missing',
  'icon-unknown': '@core.records/card-template.issue.icon-unknown',
  'icon-missing': '@core.records/card-template.issue.icon-missing',
  'text-missing': '@core.records/card-template.issue.text-missing',
  'label': '@core.records/card-template.issue.label',
  'key-list': '@core.records/card-template.issue.key-list',
  'expression': '@core.records/card-template.issue.expression',
  'expression-type': '@core.records/card-template.issue.expression-type',
  'too-deep': '@core.records/card-template.issue.too-deep',
  'too-many': '@core.records/card-template.issue.too-many',
  'field-unexposed': '@core.records/portal-template.issue.field-unexposed',
  'expression-unexposed': '@core.records/portal-template.issue.expression-unexposed',
  'record-only': '@core.records/portal-widget.issue.record-only',
  'nested-records': '@core.records/portal-widget.issue.nested-records',
  'condition-outside': '@core.records/portal-widget.issue.condition-outside',
  'scope': '@core.records/portal-widget.issue.scope',
  'collection-missing': '@core.records/portal-widget.issue.collection-missing',
  'collection-unexposed': '@core.records/portal-widget.issue.collection-unexposed',
  'limit': '@core.records/portal-widget.issue.limit',
} as const;

type IssueCode = keyof typeof ISSUE_KEYS;

const issue = (code: IssueCode, where: string, params: Record<string, string> = {}): CardTemplateIssue => ({
  message: ISSUE_KEYS[code],
  messageParams: { where, ...params },
});

const ENUM_PROPERTIES: Partial<Record<PortalWidgetNodeType, Record<string, readonly string[]>>> = {
  row: { gap: CARD_GAPS, align: CARD_ALIGNS, justify: CARD_JUSTIFIES },
  stack: { gap: CARD_GAPS },
  section: { gap: CARD_GAPS },
  title: { size: CARD_TEXT_SIZES },
  field: { variant: CARD_FIELD_VARIANTS, size: CARD_TEXT_SIZES },
  text: { tone: CARD_TONES, size: CARD_TEXT_SIZES },
  icon: { tone: CARD_TONES },
  count: { size: CARD_TEXT_SIZES, tone: CARD_TONES },
  records: { layout: CARD_LAYOUTS, minWidth: CARD_WIDTHS },
};

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const isSet = (value: unknown): boolean => value !== undefined && value !== null;

/**
 * Os campos expostos de uma coleção, como quem confere os conhece:
 *
 * - a lista — a coleção é de uma tela do portal, e a lista são os campos que saem dela;
 * - `null` — a tela é conhecida e NÃO está no portal: o nó nunca mostraria nada;
 * - `undefined` — a tela não é conhecida aqui (a de uma dependência, no `check` do pacote): a forma é
 *   conferida, e os campos ficam para o servidor, que descarta o nó que ler o que não sai.
 */
export type PortalWidgetFieldsOf = (collection: string) => readonly CardTemplateFieldInfo[] | null | undefined;

interface Walk {
  fieldsOf: PortalWidgetFieldsOf;
  issues: CardTemplateIssue[];
  count: number;
}

/** O que um nó pode ler: os campos expostos da tela do registro em volta, quando há registro e ela é conhecida. */
type RecordFields = Map<string, CardTemplateFieldInfo> | undefined;

interface Place {
  scope: PortalWidgetScope;
  fields: RecordFields;
}

const enumIssues = (node: Record<string, unknown>, type: PortalWidgetNodeType, where: string): CardTemplateIssue[] =>
  Object.entries(ENUM_PROPERTIES[type] ?? {})
    .filter(([property]) => isSet(node[property]))
    .filter(([property, allowed]) => !allowed.includes(node[property] as string))
    .map(([property, allowed]) => issue('option', `${where}.${property}`, {
      value: String(node[property]),
      allowed: allowed.join(', '),
    }));

const iconIssues = (icon: unknown, where: string): CardTemplateIssue[] =>
  isText(icon) && !isScreenIconKey(icon) ? [issue('icon-unknown', where, { icon })] : [];

const fieldIssues = (field: unknown, where: string, fields: RecordFields): CardTemplateIssue[] => {
  if (!isText(field)) return [issue('field-missing', where)];
  return fields && !fields.has(field.trim()) ? [issue('field-unexposed', where, { field })] : [];
};

const expressionIssues = (expression: unknown, where: string, fields: RecordFields): CardTemplateIssue[] => {
  if (!isSet(expression)) return [];
  if (typeof expression !== 'string') return [issue('expression-type', where)];
  const syntax = fieldExpressionSyntaxError(expression);
  if (syntax) return [issue('expression', where, { error: syntax })];
  if (!fields) return [];
  return [...new Set(extractFieldExpressionPaths(expression).map((path) => path.split('.')[0]))]
    .filter((root) => !fields.has(root))
    .map((field) => issue('expression-unexposed', where, { field }));
};

/** A coleção do nó de dados e os campos expostos dela — `undefined` quando quem confere não a conhece. */
const collectionOf = (raw: Record<string, unknown>, where: string, walk: Walk): RecordFields => {
  if (!isText(raw.collection)) {
    walk.issues.push(issue('collection-missing', `${where}.collection`));
    return undefined;
  }
  const declared = walk.fieldsOf(raw.collection.trim());
  if (declared === null) {
    walk.issues.push(issue('collection-unexposed', `${where}.collection`, { collection: raw.collection }));
    return undefined;
  }
  return declared ? new Map(declared.map((field) => [field.key, field])) : undefined;
};

const walkNodes = (raw: unknown, where: string, depth: number, place: Place, walk: Walk): void => {
  if (!Array.isArray(raw)) {
    walk.issues.push(issue('node-list', where));
    return;
  }
  raw.forEach((entry, index) => walkNode(entry, `${where}[${index}]`, depth, place, walk));
};

const walkNode = (raw: unknown, where: string, depth: number, place: Place, walk: Walk): void => {
  if (!isPlainCardObject(raw) || !isText(raw.type)) {
    walk.issues.push(issue('node-shape', where));
    return;
  }
  const type = raw.type as PortalWidgetNodeType;
  if (!PORTAL_WIDGET_NODE_TYPES.includes(type)) {
    walk.issues.push(issue('node-type', `${where}.type`, { type: raw.type }));
    return;
  }
  if (!isPortalWidgetNodeAllowed(type, place.scope)) {
    walk.issues.push(issue(type === 'records' ? 'nested-records' : 'record-only', `${where}.type`, { type }));
    return;
  }
  walk.count += 1;
  walk.issues.push(...enumIssues(raw, type, where));
  if (isSet(raw.hiddenWhen)) {
    walk.issues.push(...(place.scope === 'record'
      ? expressionIssues(raw.hiddenWhen, `${where}.hiddenWhen`, place.fields)
      : [issue('condition-outside', `${where}.hiddenWhen`)]));
  }

  switch (type) {
    case 'field':
      walk.issues.push(...fieldIssues(raw.field, `${where}.field`, place.fields), ...iconIssues(raw.icon, `${where}.icon`));
      if (raw.label !== undefined && raw.label !== true && raw.label !== false && !isText(raw.label)) {
        walk.issues.push(issue('label', `${where}.label`));
      }
      break;
    case 'fields':
      if (isSet(raw.exclude) && !(Array.isArray(raw.exclude) && raw.exclude.every(isText))) {
        walk.issues.push(issue('key-list', `${where}.exclude`));
      }
      break;
    case 'section':
      if (isSet(raw.title) && !isText(raw.title)) walk.issues.push(issue('text-missing', `${where}.title`));
      break;
    case 'text':
      if (!isText(raw.text)) walk.issues.push(issue('text-missing', `${where}.text`));
      break;
    case 'icon':
      if (!isText(raw.icon)) walk.issues.push(issue('icon-missing', `${where}.icon`));
      walk.issues.push(...iconIssues(raw.icon, `${where}.icon`));
      break;
    case 'count': {
      const target = collectionOf(raw, where, walk);
      walk.issues.push(...expressionIssues(raw.when, `${where}.when`, target));
      if (isSet(raw.scope) && (raw.scope !== 'record' || place.scope !== 'record')) {
        walk.issues.push(issue('scope', `${where}.scope`));
      }
      break;
    }
    case 'records': {
      const target = collectionOf(raw, where, walk);
      walk.issues.push(...expressionIssues(raw.when, `${where}.when`, target));
      if (isSet(raw.limit) && !(Number.isInteger(raw.limit) && (raw.limit as number) >= 1 && (raw.limit as number) <= PORTAL_WIDGET_RECORDS_MAX_LIMIT)) {
        walk.issues.push(issue('limit', `${where}.limit`, { max: String(PORTAL_WIDGET_RECORDS_MAX_LIMIT) }));
      }
      if (isSet(raw.orderBy)) {
        const orderBy = isPlainCardObject(raw.orderBy) ? raw.orderBy : {};
        walk.issues.push(...fieldIssues(orderBy.field, `${where}.orderBy.field`, target));
        if (isSet(orderBy.direction) && !PORTAL_WIDGET_ORDER_DIRECTIONS.includes(orderBy.direction as never)) {
          walk.issues.push(issue('option', `${where}.orderBy.direction`, {
            value: String(orderBy.direction),
            allowed: PORTAL_WIDGET_ORDER_DIRECTIONS.join(', '),
          }));
        }
      }
      if (isSet(raw.empty) && !isText(raw.empty)) walk.issues.push(issue('text-missing', `${where}.empty`));
      if (isSet(raw.card)) {
        if (depth > PORTAL_TEMPLATE_MAX_DEPTH) {
          walk.issues.push(issue('too-deep', where, { max: String(PORTAL_TEMPLATE_MAX_DEPTH) }));
          return;
        }
        walkNodes(raw.card, `${where}.card`, depth + 1, { scope: 'record', fields: target }, walk);
      }
      break;
    }
    default:
      break;
  }

  if (isPortalWidgetContainerType(type)) {
    if (depth > PORTAL_TEMPLATE_MAX_DEPTH) {
      walk.issues.push(issue('too-deep', where, { max: String(PORTAL_TEMPLATE_MAX_DEPTH) }));
      return;
    }
    walkNodes(raw.children ?? [], `${where}.children`, depth + 1, place, walk);
  }
};

/**
 * O que está ERRADO num widget declarado do portal, para quem ainda pode corrigir — o `check` do pacote.
 * A leitura (`readPortalWidgetSpec`) é tolerante; este é o portão.
 *
 * Além da forma, cobra o que é do portal: a coleção de `count` e de `records` precisa ser de uma tela DO
 * portal, e todo campo que o widget nomeia ou que uma condição lê — `when`, `orderBy`, e no cartão de
 * `records` os nós de registro e o `hiddenWhen` — precisa estar EXPOSTO. E cobra o escopo: o nó de
 * registro só dentro do cartão de `records`, `records` nunca dentro de outro.
 */
export const portalWidgetSpecIssues = (
  raw: unknown,
  fieldsOf: PortalWidgetFieldsOf,
  where = 'spec',
): CardTemplateIssue[] => {
  if (!isPlainCardObject(raw)) return [issue('not-object', where)];
  if (!Array.isArray(raw.body) || raw.body.length === 0) return [issue('body', `${where}.body`)];
  const walk: Walk = { fieldsOf, issues: [], count: 0 };
  walkNodes(raw.body, `${where}.body`, 2, { scope: 'widget', fields: undefined }, walk);
  if (walk.count > PORTAL_TEMPLATE_MAX_NODES) {
    walk.issues.push(issue('too-many', `${where}.body`, { max: String(PORTAL_TEMPLATE_MAX_NODES) }));
  }
  return walk.issues;
};
