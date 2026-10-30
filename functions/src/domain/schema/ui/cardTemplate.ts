// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/ui/cardTemplate.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Card Template — o CARTÃO da listagem declarado pela tela (`ScreenDefinition.cardTemplate`).
 *
 * Mesmo molde do Widget DSL: uma árvore serializável de nós discriminados por `type`, que o kernel
 * desenha com os próprios componentes — cor e tamanho só por token do tema, zero HTML do autor.
 * Os "placeholders" são NÓS (`title`, `field`, `actions`, `tags`…), e não marcações dentro de uma
 * frase: um template de texto traria palavras que nenhum catálogo traduz. Texto fixo só entra por
 * `text`, resolvido por `useLabel()` — referência `@ns/chave` ou o que o escritório digitou.
 *
 * Valor composto não ganha linguagem própria: declara-se um campo `derive` e o template o posiciona
 * com `field`. O `hiddenWhen` de cada nó é a MESMA expressão, com o MESMO escopo, do `hiddenWhen` das
 * ações do cartão.
 *
 * Ausente, o cartão é o de sempre. Presente sem `body`, só o arranjo da listagem muda.
 *
 * Este arquivo é compartilhado com `functions/` (`SHARED_FILES`) e por isso não importa nada.
 */

export type CardLayout = 'grid' | 'list';
export type CardWidth = 'sm' | 'md' | 'lg';
export type CardGap = 'xs' | 'sm' | 'md' | 'lg';
export type CardTextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type CardTone = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'danger';
export type CardAlign = 'start' | 'center' | 'end';
export type CardJustify = 'start' | 'between' | 'end';
export type CardFieldVariant = 'text' | 'muted' | 'strong' | 'badge';
export type CardActionsPlacement = 'hover' | 'inline';

interface CardNodeBase {
  /** Expressão de campo: verdadeira, o nó (e o que ele contém) não aparece neste registro. */
  hiddenWhen?: string;
}

export interface CardRowNode extends CardNodeBase {
  type: 'row';
  children: CardNode[];
  gap?: CardGap;
  align?: CardAlign;
  justify?: CardJustify;
  wrap?: boolean;
}

export interface CardStackNode extends CardNodeBase {
  type: 'stack';
  children: CardNode[];
  gap?: CardGap;
}

export interface CardSpacerNode extends CardNodeBase { type: 'spacer' }
export interface CardDividerNode extends CardNodeBase { type: 'divider' }

/** A imagem do registro (`imageFieldKey`) ou, sem ela, o ícone da tela. */
export interface CardAvatarNode extends CardNodeBase {
  type: 'avatar';
  size?: CardWidth;
}

/** O nome do registro (`titleFieldKey`). */
export interface CardTitleNode extends CardNodeBase {
  type: 'title';
  size?: CardTextSize;
}

/** O campo declarado como subtítulo (`subtitleFieldKey`). */
export interface CardSubtitleNode extends CardNodeBase { type: 'subtitle' }

/**
 * Um campo da tela, formatado pelo tipo dele. `label: true` usa o rótulo de listagem do campo (ou o
 * rótulo dele); um texto usa o texto, resolvido como qualquer rótulo declarativo.
 */
export interface CardFieldNode extends CardNodeBase {
  type: 'field';
  field: string;
  label?: boolean | string;
  icon?: string;
  variant?: CardFieldVariant;
  size?: CardTextSize;
  /** Mostra o campo mesmo vazio (com o traço). Ausente, campo vazio não ocupa espaço. */
  showEmpty?: boolean;
}

/** O bloco "exibir na listagem" do cartão padrão. */
export interface CardFieldsNode extends CardNodeBase { type: 'fields' }

/** As meta-linhas com ícone (`listIcon`) do cartão padrão. */
export interface CardMetaRowsNode extends CardNodeBase { type: 'metaRows' }

/** As etiquetas do registro — só numa tela com etiquetas. */
export interface CardTagsNode extends CardNodeBase { type: 'tags' }

/**
 * As ações do cartão — as mesmas, na mesma ordem e com as mesmas regras do cartão padrão.
 * `include`/`exclude` escolhem por chave: a da ação da plataforma (`copyLink`, `delete`…) ou, numa
 * ação do escritório, a `key` ou o `sourceId` dela — o id instalado muda de escritório para escritório.
 */
export interface CardActionsNode extends CardNodeBase {
  type: 'actions';
  placement?: CardActionsPlacement;
  include?: string[];
  exclude?: string[];
}

export interface CardTextNode extends CardNodeBase {
  type: 'text';
  text: string;
  tone?: CardTone;
  size?: CardTextSize;
}

export interface CardIconNode extends CardNodeBase {
  type: 'icon';
  icon: string;
  tone?: CardTone;
}

export type CardNode =
  | CardRowNode
  | CardStackNode
  | CardSpacerNode
  | CardDividerNode
  | CardAvatarNode
  | CardTitleNode
  | CardSubtitleNode
  | CardFieldNode
  | CardFieldsNode
  | CardMetaRowsNode
  | CardTagsNode
  | CardActionsNode
  | CardTextNode
  | CardIconNode;

export type CardNodeType = CardNode['type'];

export interface CardTemplate {
  /** Grade de cartões (o padrão) ou um cartão por linha. */
  layout?: CardLayout;
  /** Largura mínima da coluna na grade. Ausente = a de sempre (`md`). */
  minWidth?: CardWidth;
  /** Faixa colorida no topo: a cor da opção escolhida num campo de seleção do registro. */
  accent?: { field: string };
  /** O conteúdo do cartão. Ausente = o cartão padrão. */
  body?: CardNode[];
}

export const CARD_NODE_TYPES: readonly CardNodeType[] = [
  'row', 'stack', 'spacer', 'divider', 'avatar', 'title', 'subtitle', 'field', 'fields', 'metaRows',
  'tags', 'actions', 'text', 'icon',
] as const;

export const CARD_LAYOUTS: readonly CardLayout[] = ['grid', 'list'];
export const CARD_WIDTHS: readonly CardWidth[] = ['sm', 'md', 'lg'];
export const CARD_GAPS: readonly CardGap[] = ['xs', 'sm', 'md', 'lg'];
export const CARD_TEXT_SIZES: readonly CardTextSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
export const CARD_TONES: readonly CardTone[] = ['default', 'muted', 'primary', 'success', 'warning', 'danger'];
export const CARD_ALIGNS: readonly CardAlign[] = ['start', 'center', 'end'];
export const CARD_JUSTIFIES: readonly CardJustify[] = ['start', 'between', 'end'];
export const CARD_FIELD_VARIANTS: readonly CardFieldVariant[] = ['text', 'muted', 'strong', 'badge'];
export const CARD_ACTIONS_PLACEMENTS: readonly CardActionsPlacement[] = ['hover', 'inline'];

/** O primeiro kernel que desenha o cartão declarado. Um anterior ignora a chave e mostra o padrão. */
export const CARD_TEMPLATE_SINCE_KERNEL = '2.86.0';

/** Profundidade máxima de aninhamento: o cartão raiz conta como nível 1. */
export const CARD_TEMPLATE_MAX_DEPTH = 6;
/** Nós no cartão inteiro. É um cartão, desenhado uma vez por registro da lista. */
export const CARD_TEMPLATE_MAX_NODES = 80;

const CONTAINER_TYPES: ReadonlySet<CardNodeType> = new Set(['row', 'stack']);

export const isCardContainerType = (type: unknown): boolean =>
  typeof type === 'string' && CONTAINER_TYPES.has(type as CardNodeType);

export const isPlainCardObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

const keyList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const keys = value.map(nonEmptyText).filter((key): key is string => key !== undefined);
  return keys.length > 0 ? keys : undefined;
};

/** Tira as propriedades `undefined` — o que se grava é só o que foi declarado. */
const compact = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

interface Budget { remaining: number }

const readNode = (raw: unknown, depth: number, budget: Budget): CardNode | null => {
  if (!isPlainCardObject(raw) || budget.remaining <= 0) return null;
  const type = oneOf(CARD_NODE_TYPES, raw.type);
  if (!type) return null;
  if (isCardContainerType(type) && depth > CARD_TEMPLATE_MAX_DEPTH) return null;
  const hiddenWhen = nonEmptyText(raw.hiddenWhen);

  const node = ((): CardNode | null => {
    switch (type) {
      case 'row':
        budget.remaining -= 1;
        return compact<CardRowNode>({
          type,
          children: readNodes(raw.children, depth + 1, budget),
          gap: oneOf(CARD_GAPS, raw.gap),
          align: oneOf(CARD_ALIGNS, raw.align),
          justify: oneOf(CARD_JUSTIFIES, raw.justify),
          wrap: raw.wrap === true ? true : undefined,
          hiddenWhen,
        });
      case 'stack':
        budget.remaining -= 1;
        return compact<CardStackNode>({
          type,
          children: readNodes(raw.children, depth + 1, budget),
          gap: oneOf(CARD_GAPS, raw.gap),
          hiddenWhen,
        });
      case 'avatar':
        return compact<CardAvatarNode>({ type, size: oneOf(CARD_WIDTHS, raw.size), hiddenWhen });
      case 'title':
        return compact<CardTitleNode>({ type, size: oneOf(CARD_TEXT_SIZES, raw.size), hiddenWhen });
      case 'field': {
        const field = nonEmptyText(raw.field);
        if (!field) return null;
        const label = raw.label === true ? true : nonEmptyText(raw.label);
        return compact<CardFieldNode>({
          type,
          field,
          label,
          icon: nonEmptyText(raw.icon),
          variant: oneOf(CARD_FIELD_VARIANTS, raw.variant),
          size: oneOf(CARD_TEXT_SIZES, raw.size),
          showEmpty: raw.showEmpty === true ? true : undefined,
          hiddenWhen,
        });
      }
      case 'actions':
        return compact<CardActionsNode>({
          type,
          placement: oneOf(CARD_ACTIONS_PLACEMENTS, raw.placement),
          include: keyList(raw.include),
          exclude: keyList(raw.exclude),
          hiddenWhen,
        });
      case 'text': {
        const text = nonEmptyText(raw.text);
        if (!text) return null;
        return compact<CardTextNode>({
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
        return compact<CardIconNode>({ type, icon, tone: oneOf(CARD_TONES, raw.tone), hiddenWhen });
      }
      default:
        return compact({ type, hiddenWhen }) as CardNode;
    }
  })();
  if (node && !isCardContainerType(type)) budget.remaining -= 1;
  return node;
};

const readNodes = (raw: unknown, depth: number, budget: Budget): CardNode[] =>
  Array.isArray(raw)
    ? raw.map((entry) => readNode(entry, depth, budget)).filter((node): node is CardNode => node !== null)
    : [];

/**
 * A declaração GRAVADA lida com tolerância: nó desconhecido ou malformado é descartado (um template
 * escrito para um kernel mais novo degrada em vez de quebrar a lista), opção fora da lista vira
 * ausente, e os tetos de profundidade e de nós cortam o excesso. Nada aproveitável = `null`, e quem
 * desenha volta ao cartão padrão.
 *
 * Quem RECUSA é `cardTemplateIssues`, na autoria: aqui só se lê.
 */
export const readCardTemplate = (raw: unknown): CardTemplate | null => {
  if (!isPlainCardObject(raw)) return null;
  const accentField = isPlainCardObject(raw.accent) ? nonEmptyText(raw.accent.field) : undefined;
  const body = readNodes(raw.body, 2, { remaining: CARD_TEMPLATE_MAX_NODES });
  const template = compact<CardTemplate>({
    layout: oneOf(CARD_LAYOUTS, raw.layout),
    minWidth: oneOf(CARD_WIDTHS, raw.minWidth),
    accent: accentField ? { field: accentField } : undefined,
    body: body.length > 0 ? body : undefined,
  });
  return Object.keys(template).length > 0 ? template : null;
};

/**
 * O cartão padrão escrito na DSL — o ponto de partida do Form Design. Que ele exista é também a
 * prova de que a DSL alcança tudo o que o cartão fixo desenha.
 */
export const DEFAULT_CARD_BODY: readonly CardNode[] = [
  { type: 'actions', placement: 'hover' },
  {
    type: 'row',
    gap: 'sm',
    align: 'start',
    children: [
      { type: 'avatar' },
      { type: 'stack', gap: 'xs', children: [{ type: 'title' }, { type: 'subtitle' }] },
    ],
  },
  { type: 'metaRows' },
  { type: 'fields' },
  { type: 'tags' },
];

/** Os filhos de um nó de layout — sempre um array. */
export const cardNodeChildren = (node: CardNode): CardNode[] =>
  node.type === 'row' || node.type === 'stack' ? node.children : [];
