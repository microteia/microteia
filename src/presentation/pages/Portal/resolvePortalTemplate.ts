import type {
  CardAlign,
  CardFieldVariant,
  CardGap,
  CardJustify,
  CardLayout,
  CardTextSize,
  CardTone,
  CardWidth,
} from '../../../domain/schema/ui/cardTemplate';
import type { PortalTemplate, PortalTemplateNode } from '../../../domain/schema/ui/portalTemplate';
import type { PortalCountNode, PortalRecordsNode, PortalWidgetNode } from '../../../domain/schema/ui/portalWidget';
import type { PortalFieldView, PortalRecordCard } from './Portal.viewmodel';

/** O traço do campo vazio que o template pede para mostrar (`showEmpty`) — o mesmo da listagem. */
const EMPTY_VALUE = '—';

/**
 * Um nó do desenho do portal já respondido para UM registro: o que sobra é só o que desenhar. A view
 * não avalia expressão, não formata valor e não decide nada.
 */
export type ResolvedPortalNode =
  | { kind: 'row'; key: string; children: ResolvedPortalNode[]; gap: CardGap; align?: CardAlign; justify?: CardJustify; wrap: boolean }
  | { kind: 'stack'; key: string; children: ResolvedPortalNode[]; gap: CardGap }
  | { kind: 'section'; key: string; children: ResolvedPortalNode[]; gap: CardGap; title: string }
  | { kind: 'spacer'; key: string }
  | { kind: 'divider'; key: string }
  | { kind: 'title'; key: string; text: string; size?: CardTextSize }
  | { kind: 'field'; key: string; field: PortalFieldView; label?: string; iconKey?: string; variant: CardFieldVariant; size?: CardTextSize }
  | { kind: 'fields'; key: string; fields: PortalFieldView[] }
  | { kind: 'summary'; key: string; text: string }
  | { kind: 'updated'; key: string; text: string }
  | { kind: 'text'; key: string; text: string; tone: CardTone; size?: CardTextSize }
  | { kind: 'icon'; key: string; iconKey: string; tone: CardTone }
  | { kind: 'edit'; key: string; label: string }
  | { kind: 'actions'; key: string }
  | { kind: 'count'; key: string; text: string; size?: CardTextSize; tone: CardTone }
  | { kind: 'records'; key: string; cards: PortalRecordCard[]; arrangement: PortalCardArrangement; empty: string }
  | { kind: 'markdown'; key: string; content: string };

/** Os registros de um nó `records` já escolhidos e desenhados — e o texto de quando não há nenhum. */
export interface PortalWidgetRecords {
  cards: PortalRecordCard[];
  arrangement: PortalCardArrangement;
  empty: string;
}

/**
 * As respostas que o desenho pede sobre UM registro — as mesmas que o cartão e o registro aberto
 * padrão já davam. É o que garante que `title` ou `fields` num template mostrem exatamente o que
 * mostrariam no portal de sempre.
 */
export interface PortalTemplateAnswers {
  title: string;
  /** O campo exposto, formatado; `null` quando a tela não o expõe. */
  field: (fieldKey: string) => PortalFieldView | null;
  /** Os campos expostos com valor, na ordem da tela. */
  fields: PortalFieldView[];
  summary: string;
  updated: string;
  /** O rótulo do botão de alterar — `null` quando este convidado não altera este registro. */
  editLabel: string | null;
  hasActions: boolean;
  isHidden: (hiddenWhen: string | undefined) => boolean;
  /** Só no widget declarado: o número de um `count`, já formatado; `null` quando não há o que contar. */
  count?: (node: PortalCountNode) => string | null;
  /** Só no widget declarado: os registros de um `records`; `null` quando a tela não está no portal. */
  records?: (node: PortalRecordsNode) => PortalWidgetRecords | null;
}

/**
 * As respostas de onde não há registro — o cartão do widget declarado. A leitura já tirou de lá os nós
 * que perguntariam por um.
 */
export const NO_RECORD_ANSWERS: PortalTemplateAnswers = {
  title: '',
  field: () => null,
  fields: [],
  summary: '',
  updated: '',
  editLabel: null,
  hasActions: false,
  isHidden: () => false,
};

const hiddenWhenOf = (node: PortalTemplateNode | PortalWidgetNode): string | undefined =>
  'hiddenWhen' in node ? node.hiddenWhen : undefined;

const resolveNode = (
  node: PortalTemplateNode | PortalWidgetNode,
  key: string,
  answers: PortalTemplateAnswers,
): ResolvedPortalNode | null => {
  if (answers.isHidden(hiddenWhenOf(node))) return null;
  switch (node.type) {
    case 'row':
    case 'stack':
    case 'section': {
      const children = resolvePortalNodes(node.children, answers, key);
      if (children.length === 0) return null;
      if (node.type === 'row') {
        return { kind: 'row', key, children, gap: node.gap ?? 'sm', align: node.align, justify: node.justify, wrap: !!node.wrap };
      }
      return node.type === 'stack'
        ? { kind: 'stack', key, children, gap: node.gap ?? 'sm' }
        : { kind: 'section', key, children, gap: node.gap ?? 'md', title: node.title ?? '' };
    }
    case 'spacer':
      return { kind: 'spacer', key };
    case 'divider':
      return { kind: 'divider', key };
    case 'title':
      return { kind: 'title', key, text: answers.title, size: node.size };
    case 'field': {
      const field = answers.field(node.field);
      if (!field || (field.value === '' && !node.showEmpty)) return null;
      const label = node.label === true ? field.label : typeof node.label === 'string' ? node.label : undefined;
      return {
        kind: 'field',
        key,
        field: field.value === '' ? { ...field, value: EMPTY_VALUE } : field,
        label,
        iconKey: node.icon,
        variant: node.variant ?? 'text',
        size: node.size,
      };
    }
    case 'fields': {
      const fields = answers.fields.filter((field) => !node.exclude?.includes(field.key));
      return fields.length > 0 ? { kind: 'fields', key, fields } : null;
    }
    case 'summary':
      return answers.summary ? { kind: 'summary', key, text: answers.summary } : null;
    case 'updated':
      return answers.updated ? { kind: 'updated', key, text: answers.updated } : null;
    case 'text':
      return { kind: 'text', key, text: node.text, tone: node.tone ?? 'default', size: node.size };
    case 'icon':
      return { kind: 'icon', key, iconKey: node.icon, tone: node.tone ?? 'muted' };
    case 'edit':
      return answers.editLabel ? { kind: 'edit', key, label: answers.editLabel } : null;
    case 'actions':
      return answers.hasActions ? { kind: 'actions', key } : null;
    case 'count': {
      const text = answers.count?.(node) ?? null;
      return text === null ? null : { kind: 'count', key, text, size: node.size, tone: node.tone ?? 'default' };
    }
    case 'records': {
      const records = answers.records?.(node) ?? null;
      if (!records || (records.cards.length === 0 && !records.empty)) return null;
      return { kind: 'records', key, ...records };
    }
    case 'markdown':
      return { kind: 'markdown', key, content: node.content };
    default:
      return null;
  }
};

/**
 * Responde a árvore declarada para um registro — ou, no widget declarado, para nenhum. Some o que o
 * `hiddenWhen` esconde (com tudo o que contém), o campo vazio (salvo `showEmpty`), o bloco sem conteúdo,
 * o botão que este convidado não tem, a lista sem registro nem texto de vazio e o contêiner que ficou
 * sem filhos — o portal não mostra moldura vazia.
 */
export const resolvePortalNodes = (
  nodes: readonly (PortalTemplateNode | PortalWidgetNode)[],
  answers: PortalTemplateAnswers,
  parentKey = '',
): ResolvedPortalNode[] =>
  nodes
    .map((node, index) => resolveNode(node, parentKey ? `${parentKey}.${index}` : String(index), answers))
    .filter((node): node is ResolvedPortalNode => node !== null);

/** Como a lista arranja os cartões. No portal — usado primeiro no celular — o padrão é um por linha. */
export interface PortalCardArrangement {
  layout: CardLayout;
  minWidth: CardWidth;
}

/**
 * O arranjo da lista quando a tela declara o cartão (`portal.template.card`); `null` quando não declara,
 * e então a lista é a de sempre, sem um pixel de diferença.
 */
export const portalCardArrangement = (
  screen: { template?: PortalTemplate | null } | null | undefined,
): PortalCardArrangement | null => {
  const card = screen?.template?.card;
  return card ? { layout: card.layout ?? 'list', minWidth: card.minWidth ?? 'md' } : null;
};
