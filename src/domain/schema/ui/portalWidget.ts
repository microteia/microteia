/**
 * Portal Widget — o cartão da HOME do portal (`portalWidgetSpec`) e a PÁGINA do menu (`portalPageSpec`)
 * declarados em DSL, sem código. As duas superfícies usam esta mesma árvore.
 *
 * A mesma árvore do `portal.template`, mais dois nós de DADOS sobre as projeções que o convidado já lê, e
 * um de CONTEÚDO:
 *
 * - `records`: os registros de uma tela do portal, filtrados (`when`), ordenados (`orderBy`), limitados
 *   e desenhados com o cartão da tela ou com um próprio (`card`);
 * - `count`: quantos registros de uma tela passam no `when`;
 * - `markdown`: um texto longo — referência de mensagem, de qualquer namespace instalado no escritório —
 *   desenhado como Markdown sem HTML. O escritório pode editá-lo (`portalTexts`).
 *
 * Há dois ESCOPOS, e a régua de cada nó depende de onde ele está:
 *
 * - **O cartão do widget** não é de registro nenhum: só arranjo, texto fixo e os nós de dados. `hiddenWhen`
 *   e os nós que leem um registro (`title`, `field`, `fields`, `summary`, `updated`) não têm sobre o que
 *   responder ali.
 * - **O cartão de `records`** é de UM registro: vale o vocabulário do cartão do `portal.template`, e um
 *   `count` com `scope: 'record'` conta só os filhos daquele registro. `records` dentro dele não vale — o
 *   cartão inteiro é um botão.
 *
 * As garantias são as do `portal.template`: só campo exposto, condição avaliada no navegador sobre a
 * projeção, no fuso do escritório, e o texto resolvido pelo servidor no idioma do convidado
 * (`guestPortalWidgetSpec`). Este arquivo é compartilhado com `functions/` (`SHARED_FILES`).
 */

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
import type { CardLayout, CardTextSize, CardTone, CardWidth } from './cardTemplate';
import {
  PORTAL_TEMPLATE_MAX_DEPTH,
  PORTAL_TEMPLATE_MAX_NODES,
  portalConditionReadsOnly,
} from './portalTemplate';
import { isMessageRef } from '../i18n/messageRef';
import type {
  PortalDividerNode,
  PortalFieldNode,
  PortalFieldsNode,
  PortalIconNode,
  PortalRowNode,
  PortalSectionNode,
  PortalSpacerNode,
  PortalStackNode,
  PortalSummaryNode,
  PortalTextNode,
  PortalTitleNode,
  PortalUpdatedNode,
} from './portalTemplate';

export interface PortalWidgetRowNode extends Omit<PortalRowNode, 'children'> { children: PortalWidgetNode[] }
export interface PortalWidgetStackNode extends Omit<PortalStackNode, 'children'> { children: PortalWidgetNode[] }
export interface PortalWidgetSectionNode extends Omit<PortalSectionNode, 'children'> { children: PortalWidgetNode[] }

export type PortalWidgetOrderDirection = 'asc' | 'desc';

/** Quantos registros de uma tela do portal passam no `when` — o número, formatado no idioma de quem lê. */
export interface PortalCountNode {
  type: 'count';
  /** A coleção de uma tela do PORTAL. */
  collection: string;
  /** Expressão de campo sobre a projeção daquela tela. Ausente, todos. */
  when?: string;
  /** Só dentro do cartão de `records`: conta apenas os registros-filhos daquele registro. */
  scope?: 'record';
  size?: CardTextSize;
  tone?: CardTone;
  hiddenWhen?: string;
}

/** Os registros de uma tela do portal que passam no `when`, cada um como um cartão que abre o registro. */
export interface PortalRecordsNode {
  type: 'records';
  collection: string;
  when?: string;
  /** Um campo EXPOSTO daquela tela. Ausente, os atualizados mais recentemente primeiro. */
  orderBy?: { field: string; direction?: PortalWidgetOrderDirection };
  /** Quantos, no máximo. Ausente, `PORTAL_WIDGET_RECORDS_DEFAULT_LIMIT`. */
  limit?: number;
  /** O cartão de cada registro. Ausente, o cartão que a tela usa no portal (`portal.template.card`, ou o padrão). */
  card?: PortalWidgetNode[];
  layout?: CardLayout;
  minWidth?: CardWidth;
  /** O texto quando nenhum registro passa. Ausente, o nó some — e o widget sem nada a mostrar também. */
  empty?: string;
}

/**
 * Um texto longo em Markdown. `content` é uma REFERÊNCIA de mensagem (`@ns/chave`), e pode ser de outro
 * namespace: o texto chega pelo bundle de quem o instala no escritório — um pacote só de texto, como um de
 * tradução. Na saída para o convidado, `content` já é o texto, no idioma dele; sem texto, o nó some.
 */
export interface PortalMarkdownNode {
  type: 'markdown';
  content: string;
}

export type PortalWidgetNode =
  | PortalWidgetRowNode
  | PortalWidgetStackNode
  | PortalWidgetSectionNode
  | PortalSpacerNode
  | PortalDividerNode
  | PortalTitleNode
  | PortalFieldNode
  | PortalFieldsNode
  | PortalSummaryNode
  | PortalUpdatedNode
  | PortalTextNode
  | PortalIconNode
  | PortalCountNode
  | PortalRecordsNode
  | PortalMarkdownNode;

export type PortalWidgetNodeType = PortalWidgetNode['type'];

export interface PortalWidgetSpec {
  body: PortalWidgetNode[];
}

/** A página declarada do menu do portal: a MESMA árvore do cartão da home, numa página inteira. */
export type PortalPageSpec = PortalWidgetSpec;

/** Onde o nó está: no cartão do widget, ou no cartão de um registro de `records`. */
export type PortalWidgetScope = 'widget' | 'record';

export const PORTAL_WIDGET_NODE_TYPES: readonly PortalWidgetNodeType[] = [
  'row', 'stack', 'section', 'spacer', 'divider', 'title', 'field', 'fields', 'summary', 'updated', 'text',
  'icon', 'count', 'records', 'markdown',
] as const;

/** Os nós que respondem sobre UM registro — só no cartão de `records`. */
export const PORTAL_WIDGET_RECORD_NODE_TYPES: readonly PortalWidgetNodeType[] = ['title', 'field', 'fields', 'summary', 'updated'];

export const PORTAL_WIDGET_ORDER_DIRECTIONS: readonly PortalWidgetOrderDirection[] = ['asc', 'desc'];

export const PORTAL_WIDGET_RECORDS_DEFAULT_LIMIT = 5;
export const PORTAL_WIDGET_RECORDS_MAX_LIMIT = 20;

/** O primeiro kernel que desenha o widget declarado. Um anterior descarta a contribuição. */
export const PORTAL_WIDGET_SPEC_SINCE_KERNEL = '2.90.0';

/**
 * O primeiro kernel que desenha a PÁGINA declarada e o nó `markdown`. Um anterior descarta a página (o
 * `impl` não vale em `page`) e o nó (tipo desconhecido) — calado para quem declarou.
 */
export const PORTAL_PAGE_SPEC_SINCE_KERNEL = '2.92.0';

const CONTAINER_TYPES: ReadonlySet<PortalWidgetNodeType> = new Set(['row', 'stack', 'section']);

export const isPortalWidgetContainerType = (type: unknown): boolean =>
  typeof type === 'string' && CONTAINER_TYPES.has(type as PortalWidgetNodeType);

/** Os nós que só valem fora de um registro: o cartão inteiro de `records` é um botão. */
const OUTSIDE_RECORD_NODE_TYPES: readonly PortalWidgetNodeType[] = ['records', 'markdown'];

/**
 * O nó vale neste escopo: os de registro só no cartão de `records`; `records` e `markdown` só fora dele —
 * um texto longo, com links, dentro de um cartão que inteiro é um botão não teria onde ser lido.
 */
export const isPortalWidgetNodeAllowed = (type: PortalWidgetNodeType, scope: PortalWidgetScope): boolean =>
  scope === 'record' ? !OUTSIDE_RECORD_NODE_TYPES.includes(type) : !PORTAL_WIDGET_RECORD_NODE_TYPES.includes(type);

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

const readLimit = (value: unknown): number | undefined =>
  Number.isInteger(value) && (value as number) >= 1 ? Math.min(value as number, PORTAL_WIDGET_RECORDS_MAX_LIMIT) : undefined;

const readOrderBy = (value: unknown): PortalRecordsNode['orderBy'] => {
  if (!isPlainCardObject(value)) return undefined;
  const field = nonEmptyText(value.field);
  return field ? compact({ field, direction: oneOf(PORTAL_WIDGET_ORDER_DIRECTIONS, value.direction) }) : undefined;
};

interface Budget { remaining: number }

const readNode = (raw: unknown, scope: PortalWidgetScope, depth: number, budget: Budget): PortalWidgetNode | null => {
  if (!isPlainCardObject(raw) || budget.remaining <= 0) return null;
  const type = oneOf(PORTAL_WIDGET_NODE_TYPES, raw.type);
  if (!type || !isPortalWidgetNodeAllowed(type, scope)) return null;
  if ((isPortalWidgetContainerType(type) || type === 'records') && depth > PORTAL_TEMPLATE_MAX_DEPTH) return null;
  // Fora de um registro, a condição não tem sobre o que responder.
  const hiddenWhen = scope === 'record' ? nonEmptyText(raw.hiddenWhen) : undefined;
  budget.remaining -= 1;

  switch (type) {
    case 'row':
      return compact<PortalWidgetRowNode>({
        type,
        children: readNodes(raw.children, scope, depth + 1, budget),
        gap: oneOf(CARD_GAPS, raw.gap),
        align: oneOf(CARD_ALIGNS, raw.align),
        justify: oneOf(CARD_JUSTIFIES, raw.justify),
        wrap: raw.wrap === true ? true : undefined,
        hiddenWhen,
      });
    case 'stack':
      return compact<PortalWidgetStackNode>({
        type,
        children: readNodes(raw.children, scope, depth + 1, budget),
        gap: oneOf(CARD_GAPS, raw.gap),
        hiddenWhen,
      });
    case 'section':
      return compact<PortalWidgetSectionNode>({
        type,
        children: readNodes(raw.children, scope, depth + 1, budget),
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
      return compact<PortalTextNode>({ type, text, tone: oneOf(CARD_TONES, raw.tone), size: oneOf(CARD_TEXT_SIZES, raw.size), hiddenWhen });
    }
    case 'icon': {
      const icon = nonEmptyText(raw.icon);
      if (!icon) return null;
      return compact<PortalIconNode>({ type, icon, tone: oneOf(CARD_TONES, raw.tone), hiddenWhen });
    }
    case 'count': {
      const collection = nonEmptyText(raw.collection);
      if (!collection) return null;
      return compact<PortalCountNode>({
        type,
        collection,
        when: nonEmptyText(raw.when),
        scope: scope === 'record' && raw.scope === 'record' ? 'record' : undefined,
        size: oneOf(CARD_TEXT_SIZES, raw.size),
        tone: oneOf(CARD_TONES, raw.tone),
        hiddenWhen,
      });
    }
    case 'records': {
      const collection = nonEmptyText(raw.collection);
      if (!collection) return null;
      const card = readNodes(raw.card, 'record', depth + 1, budget);
      return compact<PortalRecordsNode>({
        type,
        collection,
        when: nonEmptyText(raw.when),
        orderBy: readOrderBy(raw.orderBy),
        limit: readLimit(raw.limit),
        card: card.length > 0 ? card : undefined,
        layout: oneOf(CARD_LAYOUTS, raw.layout),
        minWidth: oneOf(CARD_WIDTHS, raw.minWidth),
        empty: nonEmptyText(raw.empty),
      });
    }
    case 'markdown': {
      // Sem `trim`: o espaço do fim de uma linha é quebra no Markdown.
      const content = typeof raw.content === 'string' && raw.content.trim() !== '' ? raw.content : undefined;
      return content ? { type, content } : null;
    }
    default:
      return compact({ type, hiddenWhen }) as PortalWidgetNode;
  }
};

const readNodes = (raw: unknown, scope: PortalWidgetScope, depth: number, budget: Budget): PortalWidgetNode[] =>
  Array.isArray(raw)
    ? raw.map((entry) => readNode(entry, scope, depth, budget)).filter((node): node is PortalWidgetNode => node !== null)
    : [];

/**
 * A declaração lida com tolerância — a régua de `readPortalTemplate`: nó desconhecido, malformado ou fora
 * do escopo dele é descartado, opção fora da lista vira ausente, o `limit` é cortado no teto, e os tetos
 * de profundidade e de nós cortam o excesso. Nada aproveitável = `null`: não há widget.
 *
 * Quem RECUSA é `portalWidgetSpecIssues`, na autoria.
 */
export const readPortalWidgetSpec = (raw: unknown): PortalWidgetSpec | null => {
  if (!isPlainCardObject(raw)) return null;
  const body = readNodes(raw.body, 'widget', 2, { remaining: PORTAL_TEMPLATE_MAX_NODES });
  return body.length > 0 ? { body } : null;
};

export const portalWidgetNodeChildren = (node: PortalWidgetNode): PortalWidgetNode[] => {
  switch (node.type) {
    case 'row':
    case 'stack':
    case 'section':
      return node.children;
    case 'records':
      return node.card ?? [];
    default:
      return [];
  }
};

/** As coleções que o widget lê — as que precisam ter chegado para ele dizer alguma coisa. */
export const portalWidgetCollections = (nodes: readonly PortalWidgetNode[]): string[] => [
  ...new Set(nodes.flatMap((node) => [
    ...(node.type === 'count' || node.type === 'records' ? [node.collection] : []),
    ...portalWidgetCollections(portalWidgetNodeChildren(node)),
  ])),
];

/** As referências que os nós `markdown` da árvore citam — o que o escritório pode editar. */
export const portalWidgetMarkdownRefs = (nodes: readonly PortalWidgetNode[]): string[] => [
  ...new Set(nodes.flatMap((node) => [
    ...(node.type === 'markdown' ? [node.content] : []),
    ...portalWidgetMarkdownRefs(portalWidgetNodeChildren(node)),
  ])),
];

/**
 * A árvore carrega SUBSTÂNCIA: dados (`count`, `records`) ou conteúdo (`markdown`). O resto é moldura —
 * título de seção, ícone, texto curto em volta.
 */
const hasSubstance = (nodes: readonly PortalWidgetNode[]): boolean =>
  nodes.some((node) => node.type === 'count' || node.type === 'records' || node.type === 'markdown'
    || hasSubstance(portalWidgetNodeChildren(node)));

/** Os campos que o convidado tem de cada tela do portal; `null` quando a coleção não está no portal. */
export type PortalExposedFieldsOf = (collection: string) => ReadonlySet<string> | null;

/**
 * O texto de uma referência de conteúdo no idioma do convidado — o editado pelo escritório, senão o do
 * bundle instalado; `null` quando nenhum dos dois o tem.
 */
export type PortalContentOf = (ref: string) => string | null;

const NO_CONTENT: PortalContentOf = () => null;

interface GuestWalk {
  exposedOf: PortalExposedFieldsOf;
  resolve: (text: string) => string;
  content: PortalContentOf;
}

const hiddenWhenOf = (node: PortalWidgetNode): string | undefined => ('hiddenWhen' in node ? node.hiddenWhen : undefined);

const guestNodes = (
  nodes: readonly PortalWidgetNode[],
  recordFields: ReadonlySet<string> | null,
  walk: GuestWalk,
): PortalWidgetNode[] =>
  nodes.flatMap((node): PortalWidgetNode[] => {
    const hiddenWhen = hiddenWhenOf(node);
    if (hiddenWhen !== undefined && !(recordFields && portalConditionReadsOnly(hiddenWhen, recordFields))) return [];
    switch (node.type) {
      case 'row':
      case 'stack':
        return [{ ...node, children: guestNodes(node.children, recordFields, walk) }];
      case 'section':
        return [compact<PortalWidgetSectionNode>({
          ...node,
          title: node.title ? walk.resolve(node.title) : undefined,
          children: guestNodes(node.children, recordFields, walk),
        })];
      case 'field':
        if (!recordFields?.has(node.field)) return [];
        return [typeof node.label === 'string' ? { ...node, label: walk.resolve(node.label) } : node];
      case 'fields': {
        const exclude = node.exclude?.filter((key) => recordFields?.has(key));
        return [compact<PortalFieldsNode>({ ...node, exclude: exclude && exclude.length > 0 ? exclude : undefined })];
      }
      case 'text':
        return [{ ...node, text: walk.resolve(node.text) }];
      case 'count': {
        const target = walk.exposedOf(node.collection);
        if (!target || (node.when !== undefined && !portalConditionReadsOnly(node.when, target))) return [];
        return [node];
      }
      case 'records': {
        const target = walk.exposedOf(node.collection);
        if (!target || (node.when !== undefined && !portalConditionReadsOnly(node.when, target))) return [];
        if (node.orderBy && !target.has(node.orderBy.field)) return [];
        return [compact<PortalRecordsNode>({
          ...node,
          card: node.card ? guestNodes(node.card, target, walk) : undefined,
          empty: node.empty ? walk.resolve(node.empty) : undefined,
        })];
      }
      case 'markdown': {
        // Só referência: o texto literal de um pacote não traduz, e o escritório não teria o que editar.
        const text = isMessageRef(node.content) ? walk.content(node.content) : null;
        return text && text.trim() !== '' ? [{ type: 'markdown', content: text }] : [];
      }
      default:
        return [node];
    }
  });

/**
 * O widget como ele sai para o CONVIDADO — a régua da projeção: só o que foi exposto.
 *
 * - O `count` ou o `records` de coleção que não está no portal some.
 * - O que tem `when` que lê campo não exposto (ou que não parseia) some INTEIRO, e não só o filtro:
 *   sem o filtro, o nó mostraria registros que o autor quis deixar de fora. Vale igual para o `orderBy`
 *   por campo de fora — o nome dele é interno, e a projeção não tem o valor para ordenar.
 * - No cartão de `records`, `field`, `fields.exclude` e `hiddenWhen` respondem aos campos expostos DAQUELA
 *   tela, como no cartão do `portal.template`.
 * - Todo texto — `text`, `section.title`, o rótulo escrito de `field`, `records.empty` — vai no idioma do
 *   convidado.
 * - O `markdown` sai com o TEXTO no lugar da referência (`content`): o editado pelo escritório, senão o do
 *   bundle. Sem texto naquele idioma — nenhum pacote instalado traz a chave —, o nó some, em vez de
 *   mostrar a referência crua.
 *
 * A árvore que tinha substância — dados ou conteúdo — e perdeu toda some inteira (`null`): sobraria a
 * moldura — "A vencer" sobre nada, a página "Legislação" sem lei —, e o convidado leria o vazio como
 * resposta.
 */
export const guestPortalWidgetSpec = (
  spec: PortalWidgetSpec | null | undefined,
  exposedOf: PortalExposedFieldsOf,
  resolve: (text: string) => string,
  content: PortalContentOf = NO_CONTENT,
): PortalWidgetSpec | null => {
  if (!spec) return null;
  const guest = readPortalWidgetSpec({ body: guestNodes(spec.body, null, { exposedOf, resolve, content }) });
  if (!guest) return null;
  return hasSubstance(spec.body) && !hasSubstance(guest.body) ? null : guest;
};
