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
import {
  PORTAL_DETAIL_ONLY_NODE_TYPES,
  PORTAL_TEMPLATE_MAX_DEPTH,
  PORTAL_TEMPLATE_MAX_NODES,
  PORTAL_TEMPLATE_NODE_TYPES,
  isPortalContainerType,
} from './portalTemplate';
import type { PortalTemplateNodeType, PortalTemplateSurface } from './portalTemplate';
import type { CardTemplateFieldInfo, CardTemplateIssue } from './cardTemplateIssues';
import { isScreenIconKey } from './screenIconCatalog';
import { extractFieldExpressionPaths, fieldExpressionSyntaxError } from '../fieldExpression';

/**
 * As frases de cada problema — literais, para que `verify-messages` confira que existem. As de forma
 * são as do cartão do escritório, que dizem o mesmo; as do portal são as que só ele tem.
 */
const ISSUE_KEYS = {
  'not-object': '@core.records/portal-template.issue.not-object',
  'option': '@core.records/card-template.issue.option',
  'node-list': '@core.records/card-template.issue.node-list',
  'node-shape': '@core.records/card-template.issue.node-shape',
  'node-type': '@core.records/card-template.issue.node-type',
  'field-missing': '@core.records/card-template.issue.field-missing',
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
  'field-unexposed': '@core.records/portal-template.issue.field-unexposed',
  'expression-unexposed': '@core.records/portal-template.issue.expression-unexposed',
  'detail-only': '@core.records/portal-template.issue.detail-only',
} as const;

type IssueCode = keyof typeof ISSUE_KEYS;

const issue = (code: IssueCode, where: string, params: Record<string, string> = {}): CardTemplateIssue => ({
  message: ISSUE_KEYS[code],
  messageParams: { where, ...params },
});

const ENUM_PROPERTIES: Partial<Record<PortalTemplateNodeType, Record<string, readonly string[]>>> = {
  row: { gap: CARD_GAPS, align: CARD_ALIGNS, justify: CARD_JUSTIFIES },
  stack: { gap: CARD_GAPS },
  section: { gap: CARD_GAPS },
  title: { size: CARD_TEXT_SIZES },
  field: { variant: CARD_FIELD_VARIANTS, size: CARD_TEXT_SIZES },
  text: { tone: CARD_TONES, size: CARD_TEXT_SIZES },
  icon: { tone: CARD_TONES },
};

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const isSet = (value: unknown): boolean => value !== undefined && value !== null;

interface Walk {
  surface: PortalTemplateSurface;
  exposed: Map<string, CardTemplateFieldInfo>;
  issues: CardTemplateIssue[];
  count: number;
}

const enumIssues = (node: Record<string, unknown>, type: PortalTemplateNodeType, where: string): CardTemplateIssue[] =>
  Object.entries(ENUM_PROPERTIES[type] ?? {})
    .filter(([property]) => isSet(node[property]))
    .filter(([property, allowed]) => !allowed.includes(node[property] as string))
    .map(([property, allowed]) => issue('option', `${where}.${property}`, {
      value: String(node[property]),
      allowed: allowed.join(', '),
    }));

const fieldIssues = (field: unknown, where: string, walk: Walk): CardTemplateIssue[] => {
  if (!isText(field)) return [issue('field-missing', where)];
  return walk.exposed.has(field.trim()) ? [] : [issue('field-unexposed', where, { field })];
};

const iconIssues = (icon: unknown, where: string): CardTemplateIssue[] =>
  isText(icon) && !isScreenIconKey(icon) ? [issue('icon-unknown', where, { icon })] : [];

const conditionIssues = (hiddenWhen: unknown, where: string, walk: Walk): CardTemplateIssue[] => {
  if (!isSet(hiddenWhen)) return [];
  if (typeof hiddenWhen !== 'string') return [issue('expression-type', where)];
  const syntax = fieldExpressionSyntaxError(hiddenWhen);
  if (syntax) return [issue('expression', where, { error: syntax })];
  const outside = [...new Set(extractFieldExpressionPaths(hiddenWhen).map((path) => path.split('.')[0]))]
    .filter((root) => !walk.exposed.has(root));
  return outside.map((field) => issue('expression-unexposed', where, { field }));
};

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
  const type = raw.type as PortalTemplateNodeType;
  if (!PORTAL_TEMPLATE_NODE_TYPES.includes(type)) {
    walk.issues.push(issue('node-type', `${where}.type`, { type: raw.type }));
    return;
  }
  if (walk.surface === 'card' && PORTAL_DETAIL_ONLY_NODE_TYPES.includes(type)) {
    walk.issues.push(issue('detail-only', `${where}.type`, { type }));
    return;
  }
  walk.count += 1;
  walk.issues.push(...enumIssues(raw, type, where), ...conditionIssues(raw.hiddenWhen, `${where}.hiddenWhen`, walk));

  switch (type) {
    case 'field':
      walk.issues.push(...fieldIssues(raw.field, `${where}.field`, walk), ...iconIssues(raw.icon, `${where}.icon`));
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
    default:
      break;
  }

  if (isPortalContainerType(type)) {
    if (depth > PORTAL_TEMPLATE_MAX_DEPTH) {
      walk.issues.push(issue('too-deep', where, { max: String(PORTAL_TEMPLATE_MAX_DEPTH) }));
      return;
    }
    walkNodes(raw.children ?? [], `${where}.children`, depth + 1, walk);
  }
};

const bodyIssues = (
  raw: unknown,
  surface: PortalTemplateSurface,
  where: string,
  exposed: Map<string, CardTemplateFieldInfo>,
): CardTemplateIssue[] => {
  const walk: Walk = { surface, exposed, issues: [], count: 0 };
  walkNodes(raw, where, 2, walk);
  if (walk.count > PORTAL_TEMPLATE_MAX_NODES) {
    walk.issues.push(issue('too-many', where, { max: String(PORTAL_TEMPLATE_MAX_NODES) }));
  }
  return walk.issues;
};

const cardIssues = (raw: unknown, where: string, exposed: Map<string, CardTemplateFieldInfo>): CardTemplateIssue[] => {
  if (!isPlainCardObject(raw)) return [issue('not-object', where)];
  const issues: CardTemplateIssue[] = [];
  if (isSet(raw.layout) && !CARD_LAYOUTS.includes(raw.layout as never)) {
    issues.push(issue('option', `${where}.layout`, { value: String(raw.layout), allowed: CARD_LAYOUTS.join(', ') }));
  }
  if (isSet(raw.minWidth) && !CARD_WIDTHS.includes(raw.minWidth as never)) {
    issues.push(issue('option', `${where}.minWidth`, { value: String(raw.minWidth), allowed: CARD_WIDTHS.join(', ') }));
  }
  if (isSet(raw.accent)) {
    const accentField = isPlainCardObject(raw.accent) ? raw.accent.field : undefined;
    const walk: Walk = { surface: 'card', exposed, issues: [], count: 0 };
    const problems = fieldIssues(accentField, `${where}.accent.field`, walk);
    issues.push(...problems);
    const declared = isText(accentField) ? exposed.get(accentField.trim()) : undefined;
    if (problems.length === 0 && declared && declared.type !== 'select') {
      issues.push(issue('accent-field', `${where}.accent.field`, { field: String(accentField) }));
    }
  }
  if (isSet(raw.body)) issues.push(...bodyIssues(raw.body, 'card', `${where}.body`, exposed));
  return issues;
};

const detailIssues = (raw: unknown, where: string, exposed: Map<string, CardTemplateFieldInfo>): CardTemplateIssue[] => {
  if (!isPlainCardObject(raw)) return [issue('not-object', where)];
  return isSet(raw.body) ? bodyIssues(raw.body, 'detail', `${where}.body`, exposed) : [];
};

/**
 * O que está ERRADO num desenho do portal, para quem ainda pode corrigir: a aba Portal do Form Design
 * antes de gravar e o `check` do pacote. A leitura (`readPortalTemplate`) é tolerante; este é o portão.
 *
 * Além da forma — a régua do cartão do escritório —, cobra o que é do portal: todo campo nomeado, e
 * todo campo que um `hiddenWhen` lê, precisa estar EXPOSTO (`exposedFields`). O servidor descartaria
 * o nó de qualquer jeito; aqui o autor fica sabendo por quê, em vez de ver um pedaço faltar.
 */
export const portalTemplateIssues = (
  raw: unknown,
  exposedFields: readonly CardTemplateFieldInfo[],
  where = 'portal.template',
): CardTemplateIssue[] => {
  if (!isSet(raw)) return [];
  if (!isPlainCardObject(raw)) return [issue('not-object', where)];
  const exposed = new Map(exposedFields.map((field) => [field.key, field]));
  return [
    ...(isSet(raw.card) ? cardIssues(raw.card, `${where}.card`, exposed) : []),
    ...(isSet(raw.detail) ? detailIssues(raw.detail, `${where}.detail`, exposed) : []),
  ];
};
