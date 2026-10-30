/**
 * Portal Template — o DESENHO do portal declarado pela tela (`portal.template`): o cartão da lista (a
 * de topo e a aba de filhos dentro do pai) e o registro aberto.
 *
 * Mesmo molde do `cardTemplate` do escritório: árvore serializável de nós discriminados por `type`,
 * cor e tamanho só por token do tema, zero HTML do autor, e os "placeholders" são NÓS. O vocabulário é
 * outro porque o convidado vê outra coisa — só a PROJEÇÃO: não há avatar, etiqueta nem ação de cartão,
 * e há o que só o portal tem (o botão de alterar, as ações do registro aberto, a data da atualização).
 *
 * Três diferenças de fundo, todas por o convidado não ser membro:
 *
 * - **O texto chega pronto.** `text`, `section.title` e o rótulo de `field` são resolvidos pelo SERVIDOR
 *   no idioma do convidado (`guestPortalTemplate`) — o catálogo do escritório não chega ao portal.
 * - **Só o que saiu do escritório.** O nó que nomeia campo não exposto, e o `hiddenWhen` que lê um,
 *   não chegam ao navegador do convidado: a expressão citaria um nome e um limiar internos.
 * - **O template arranja, não desliga.** `edit` e `actions` posicionam o que `portal.edit` e
 *   `portal.actions` já decidiram; o registro aberto que não os posiciona os mostra no lugar de sempre.
 *
 * Ausente, o portal é o de sempre. Este arquivo é compartilhado com `functions/` (`SHARED_FILES`).
 */

import {
  CARD_ALIGNS,
  CARD_FIELD_VARIANTS,
  CARD_GAPS,
  CARD_JUSTIFIES,
  CARD_LAYOUTS,
  CARD_TEMPLATE_MAX_DEPTH,
  CARD_TEMPLATE_MAX_NODES,
  CARD_TEXT_SIZES,
  CARD_TONES,
  CARD_WIDTHS,
  isPlainCardObject,
} from './cardTemplate';
import type {
  CardAlign,
  CardFieldVariant,
  CardGap,
  CardJustify,
  CardLayout,
  CardTextSize,
  CardTone,
  CardWidth,
} from './cardTemplate';
import { extractFieldExpressionPaths, fieldExpressionSyntaxError } from '../fieldExpression';

interface PortalNodeBase {
  /**
   * Expressão de campo sobre a PROJEÇÃO — só os campos expostos. Verdadeira, o nó (e o que ele contém)
   * não aparece neste registro.
   */
  hiddenWhen?: string;
}

export interface PortalRowNode extends PortalNodeBase {
  type: 'row';
  children: PortalTemplateNode[];
  gap?: CardGap;
  align?: CardAlign;
  justify?: CardJustify;
  wrap?: boolean;
}

export interface PortalStackNode extends PortalNodeBase {
  type: 'stack';
  children: PortalTemplateNode[];
  gap?: CardGap;
}

/** Um bloco emoldurado, com título opcional — o agrupamento do registro aberto. */
export interface PortalSectionNode extends PortalNodeBase {
  type: 'section';
  children: PortalTemplateNode[];
  title?: string;
  gap?: CardGap;
}

export interface PortalSpacerNode extends PortalNodeBase { type: 'spacer' }
export interface PortalDividerNode extends PortalNodeBase { type: 'divider' }

/** O título do registro, como o portal o mostra. */
export interface PortalTitleNode extends PortalNodeBase {
  type: 'title';
  size?: CardTextSize;
}

/** Um campo exposto, formatado pelo tipo dele. `label: true` usa o rótulo do campo. */
export interface PortalFieldNode extends PortalNodeBase {
  type: 'field';
  field: string;
  label?: boolean | string;
  icon?: string;
  variant?: CardFieldVariant;
  size?: CardTextSize;
  /** Mostra o campo mesmo vazio. Ausente, campo vazio não ocupa espaço. */
  showEmpty?: boolean;
}

/**
 * Os campos expostos, rótulo e valor, na ordem da tela — a grade do registro aberto padrão.
 * `exclude` tira os que o template já mostrou em destaque.
 */
export interface PortalFieldsNode extends PortalNodeBase {
  type: 'fields';
  exclude?: string[];
}

/** A linha do cartão padrão: os primeiros campos, "Rótulo: valor". */
export interface PortalSummaryNode extends PortalNodeBase { type: 'summary' }

/** "Atualizado em …". */
export interface PortalUpdatedNode extends PortalNodeBase { type: 'updated' }

export interface PortalTextNode extends PortalNodeBase {
  type: 'text';
  text: string;
  tone?: CardTone;
  size?: CardTextSize;
}

export interface PortalIconNode extends PortalNodeBase {
  type: 'icon';
  icon: string;
  tone?: CardTone;
}

/** O botão de alterar — só existe quando `portal.edit` deixa este convidado alterar este registro. */
export interface PortalEditNode extends PortalNodeBase { type: 'edit' }

/** As ações do escritório no registro (`portal.actions`), com as condições avaliadas no servidor. */
export interface PortalActionsNode extends PortalNodeBase { type: 'actions' }

export type PortalTemplateNode =
  | PortalRowNode
  | PortalStackNode
  | PortalSectionNode
  | PortalSpacerNode
  | PortalDividerNode
  | PortalTitleNode
  | PortalFieldNode
  | PortalFieldsNode
  | PortalSummaryNode
  | PortalUpdatedNode
  | PortalTextNode
  | PortalIconNode
  | PortalEditNode
  | PortalActionsNode;

export type PortalTemplateNodeType = PortalTemplateNode['type'];

/** Onde o template desenha: o cartão de uma lista, ou o registro aberto. */
export type PortalTemplateSurface = 'card' | 'detail';

export interface PortalCardTemplate {
  /** Um cartão por linha (o padrão no portal, que é usado primeiro no celular) ou grade. */
  layout?: CardLayout;
  /** Largura mínima da coluna na grade. */
  minWidth?: CardWidth;
  /** Faixa colorida no topo: a cor da opção escolhida num campo de seleção EXPOSTO. */
  accent?: { field: string };
  /** O conteúdo do cartão. Ausente = o cartão padrão do portal. */
  body?: PortalTemplateNode[];
}

export interface PortalDetailTemplate {
  /** O conteúdo do registro aberto, acima das abas. Ausente = o registro aberto padrão. */
  body?: PortalTemplateNode[];
}

export interface PortalTemplate {
  card?: PortalCardTemplate;
  detail?: PortalDetailTemplate;
}

export const PORTAL_TEMPLATE_NODE_TYPES: readonly PortalTemplateNodeType[] = [
  'row', 'stack', 'section', 'spacer', 'divider', 'title', 'field', 'fields', 'summary', 'updated', 'text',
  'icon', 'edit', 'actions',
] as const;

/** Os nós que só fazem sentido no registro aberto: no cartão, o toque abre o registro. */
export const PORTAL_DETAIL_ONLY_NODE_TYPES: readonly PortalTemplateNodeType[] = ['edit', 'actions'];

/** O primeiro kernel que desenha o portal declarado. Um anterior descarta a chave e mostra o padrão. */
export const PORTAL_TEMPLATE_SINCE_KERNEL = '2.88.0';

export const PORTAL_TEMPLATE_MAX_DEPTH = CARD_TEMPLATE_MAX_DEPTH;
export const PORTAL_TEMPLATE_MAX_NODES = CARD_TEMPLATE_MAX_NODES;

const CONTAINER_TYPES: ReadonlySet<PortalTemplateNodeType> = new Set(['row', 'stack', 'section']);

export const isPortalContainerType = (type: unknown): boolean =>
  typeof type === 'string' && CONTAINER_TYPES.has(type as PortalTemplateNodeType);

const nonEmptyText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

const keyList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const keys = value.map(nonEmptyText).filter((key): key is string => key !== undefined);
  return keys.length > 0 ? keys : undefined;
};

const compact = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

interface Budget { remaining: number }

const readNode = (
  raw: unknown,
  surface: PortalTemplateSurface,
  depth: number,
  budget: Budget,
): PortalTemplateNode | null => {
  if (!isPlainCardObject(raw) || budget.remaining <= 0) return null;
  const type = oneOf(PORTAL_TEMPLATE_NODE_TYPES, raw.type);
  if (!type) return null;
  if (surface === 'card' && PORTAL_DETAIL_ONLY_NODE_TYPES.includes(type)) return null;
  if (isPortalContainerType(type) && depth > PORTAL_TEMPLATE_MAX_DEPTH) return null;
  const hiddenWhen = nonEmptyText(raw.hiddenWhen);
  if (isPortalContainerType(type)) budget.remaining -= 1;

  const node = ((): PortalTemplateNode | null => {
    switch (type) {
      case 'row':
        return compact<PortalRowNode>({
          type,
          children: readNodes(raw.children, surface, depth + 1, budget),
          gap: oneOf(CARD_GAPS, raw.gap),
          align: oneOf(CARD_ALIGNS, raw.align),
          justify: oneOf(CARD_JUSTIFIES, raw.justify),
          wrap: raw.wrap === true ? true : undefined,
          hiddenWhen,
        });
      case 'stack':
        return compact<PortalStackNode>({
          type,
          children: readNodes(raw.children, surface, depth + 1, budget),
          gap: oneOf(CARD_GAPS, raw.gap),
          hiddenWhen,
        });
      case 'section':
        return compact<PortalSectionNode>({
          type,
          children: readNodes(raw.children, surface, depth + 1, budget),
          title: nonEmptyText(raw.title),
          gap: oneOf(CARD_GAPS, raw.gap),
          hiddenWhen,
        });
      case 'title':
        return compact<PortalTitleNode>({ type, size: oneOf(CARD_TEXT_SIZES, raw.size), hiddenWhen });
      case 'field': {
        const field = nonEmptyText(raw.field);
        if (!field) return null;
        return compact<PortalFieldNode>({
          type,
          field,
          label: raw.label === true ? true : nonEmptyText(raw.label),
          icon: nonEmptyText(raw.icon),
          variant: oneOf(CARD_FIELD_VARIANTS, raw.variant),
          size: oneOf(CARD_TEXT_SIZES, raw.size),
          showEmpty: raw.showEmpty === true ? true : undefined,
          hiddenWhen,
        });
      }
      case 'fields':
        return compact<PortalFieldsNode>({ type, exclude: keyList(raw.exclude), hiddenWhen });
      case 'text': {
        const text = nonEmptyText(raw.text);
        if (!text) return null;
        return compact<PortalTextNode>({
          type,
          text,
          tone: oneOf(CARD_TONES, raw.tone),
          size: oneOf(CARD_TEXT_SIZES, raw.size),
          hiddenWhen,
        });
      }
      case 'icon': {
        const icon = nonEmptyText(raw.icon);
        if (!icon) return null;
        return compact<PortalIconNode>({ type, icon, tone: oneOf(CARD_TONES, raw.tone), hiddenWhen });
      }
      default:
        return compact({ type, hiddenWhen }) as PortalTemplateNode;
    }
  })();
  if (node && !isPortalContainerType(type)) budget.remaining -= 1;
  return node;
};

const readNodes = (raw: unknown, surface: PortalTemplateSurface, depth: number, budget: Budget): PortalTemplateNode[] =>
  Array.isArray(raw)
    ? raw.map((entry) => readNode(entry, surface, depth, budget)).filter((node): node is PortalTemplateNode => node !== null)
    : [];

const readBody = (raw: unknown, surface: PortalTemplateSurface): PortalTemplateNode[] | undefined => {
  const body = readNodes(raw, surface, 2, { remaining: PORTAL_TEMPLATE_MAX_NODES });
  return body.length > 0 ? body : undefined;
};

const readCard = (raw: unknown): PortalCardTemplate | undefined => {
  if (!isPlainCardObject(raw)) return undefined;
  const accentField = isPlainCardObject(raw.accent) ? nonEmptyText(raw.accent.field) : undefined;
  const card = compact<PortalCardTemplate>({
    layout: oneOf(CARD_LAYOUTS, raw.layout),
    minWidth: oneOf(CARD_WIDTHS, raw.minWidth),
    accent: accentField ? { field: accentField } : undefined,
    body: readBody(raw.body, 'card'),
  });
  return Object.keys(card).length > 0 ? card : undefined;
};

const readDetail = (raw: unknown): PortalDetailTemplate | undefined => {
  if (!isPlainCardObject(raw)) return undefined;
  const body = readBody(raw.body, 'detail');
  return body ? { body } : undefined;
};

/**
 * A declaração GRAVADA lida com tolerância — a mesma régua de `readCardTemplate`: nó desconhecido ou
 * malformado é descartado, opção fora da lista vira ausente, `edit`/`actions` no cartão são
 * descartados, e os tetos cortam o excesso. Nada aproveitável = `null`: o portal de sempre.
 *
 * Quem RECUSA é `portalTemplateIssues`, na autoria.
 */
export const readPortalTemplate = (raw: unknown): PortalTemplate | null => {
  if (!isPlainCardObject(raw)) return null;
  const template = compact<PortalTemplate>({ card: readCard(raw.card), detail: readDetail(raw.detail) });
  return Object.keys(template).length > 0 ? template : null;
};

/**
 * O cartão padrão do portal escrito na DSL — o ponto de partida do Form Design, e a prova de que a DSL
 * alcança o cartão fixo inteiro.
 */
export const DEFAULT_PORTAL_CARD_BODY: readonly PortalTemplateNode[] = [
  { type: 'title' },
  { type: 'summary' },
  { type: 'updated' },
];

/** O registro aberto padrão escrito na DSL — título e alterar, as ações, a grade de campos. */
export const DEFAULT_PORTAL_DETAIL_BODY: readonly PortalTemplateNode[] = [
  { type: 'row', justify: 'between', align: 'start', children: [{ type: 'title', size: 'xl' }, { type: 'edit' }] },
  { type: 'actions' },
  { type: 'fields' },
];

export const portalTemplateNodeChildren = (node: PortalTemplateNode): PortalTemplateNode[] =>
  node.type === 'row' || node.type === 'stack' || node.type === 'section' ? node.children : [];

/** O template POSICIONA este tipo de nó em algum ponto da árvore — escondido por condição ou não. */
export const portalTemplatePlaces = (
  nodes: readonly PortalTemplateNode[] | undefined,
  type: PortalTemplateNodeType,
): boolean =>
  (nodes ?? []).some((node) => node.type === type || portalTemplatePlaces(portalTemplateNodeChildren(node), type));

/**
 * A condição só lê o que o convidado tem. A raiz de cada caminho citado precisa ser um campo exposto;
 * expressão que não parseia não passa — o convidado não recebe o que nem o autor conseguiria avaliar.
 */
export const portalConditionReadsOnly = (expression: string, exposed: ReadonlySet<string>): boolean =>
  fieldExpressionSyntaxError(expression) === null
  && extractFieldExpressionPaths(expression).every((path) => exposed.has(path.split('.')[0]));

const guestNodes = (
  nodes: readonly PortalTemplateNode[],
  exposed: ReadonlySet<string>,
  resolve: (text: string) => string,
): PortalTemplateNode[] =>
  nodes.flatMap((node): PortalTemplateNode[] => {
    if (node.hiddenWhen && !portalConditionReadsOnly(node.hiddenWhen, exposed)) return [];
    switch (node.type) {
      case 'row':
      case 'stack':
        return [{ ...node, children: guestNodes(node.children, exposed, resolve) }];
      case 'section':
        return [compact<PortalSectionNode>({
          ...node,
          title: node.title ? resolve(node.title) : undefined,
          children: guestNodes(node.children, exposed, resolve),
        })];
      case 'field':
        if (!exposed.has(node.field)) return [];
        return [typeof node.label === 'string' ? { ...node, label: resolve(node.label) } : node];
      case 'fields': {
        const exclude = node.exclude?.filter((key) => exposed.has(key));
        return [compact<PortalFieldsNode>({ ...node, exclude: exclude && exclude.length > 0 ? exclude : undefined })];
      }
      case 'text':
        return [{ ...node, text: resolve(node.text) }];
      default:
        return [node];
    }
  });

/**
 * O template como ele sai para o CONVIDADO — a mesma régua da projeção: só o que foi exposto.
 *
 * - O nó `field` de campo não exposto some, e `fields.exclude` perde as chaves de fora: nenhum nome de
 *   campo interno chega ao navegador.
 * - O nó cujo `hiddenWhen` lê o que não saiu (ou não parseia) some INTEIRO, com o que contém: a
 *   expressão citaria um campo e um limiar internos, e avaliada sobre a projeção daria outro resultado.
 *   Na dúvida, o pedaço não aparece.
 * - A faixa (`accent`) por campo não exposto some.
 * - Todo texto — `text`, `section.title`, o rótulo escrito de `field` — vai no idioma do convidado.
 */
export const guestPortalTemplate = (
  template: PortalTemplate | null | undefined,
  exposed: ReadonlySet<string>,
  resolve: (text: string) => string,
): PortalTemplate | null => {
  if (!template) return null;
  const card = template.card
    ? compact<PortalCardTemplate>({
      ...template.card,
      accent: template.card.accent && exposed.has(template.card.accent.field) ? template.card.accent : undefined,
      body: template.card.body ? guestNodes(template.card.body, exposed, resolve) : undefined,
    })
    : undefined;
  const detail = template.detail?.body ? { body: guestNodes(template.detail.body, exposed, resolve) } : undefined;
  return readPortalTemplate(compact<PortalTemplate>({ card, detail }));
};
