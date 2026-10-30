import { readValueByPath } from '../../../domain/services/customFieldValues';
import type {
  CardActionsPlacement,
  CardAlign,
  CardFieldVariant,
  CardGap,
  CardJustify,
  CardNode,
  CardTextSize,
  CardTone,
  CardWidth,
} from '../../../domain/schema/ui/cardTemplate';
import type { EntityRecord } from '../../../domain/entities';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import type { RecordCardAction } from './useRecordListViewModel';

export interface CardMetaRowValue {
  key: string;
  iconKey?: string;
  value: string;
}

export interface CardTagValue {
  id: string;
  name: string;
  color: string;
}

/**
 * Um nó do cartão já respondido para UM registro: o que sobra é só o que desenhar. A view não
 * avalia expressão, não formata valor e não decide nada.
 */
export type ResolvedCardNode =
  | { kind: 'row'; key: string; children: ResolvedCardNode[]; gap: CardGap; align?: CardAlign; justify?: CardJustify; wrap: boolean }
  | { kind: 'stack'; key: string; children: ResolvedCardNode[]; gap: CardGap }
  | { kind: 'spacer'; key: string }
  | { kind: 'divider'; key: string }
  | { kind: 'avatar'; key: string; size: CardWidth; imageUrl: string | null; name: string }
  | { kind: 'title'; key: string; text: string; size?: CardTextSize }
  | { kind: 'subtitle'; key: string; text: string; iconKey: string | null }
  | { kind: 'field'; key: string; item: CustomFieldCardItem; label?: string; iconKey?: string; variant: CardFieldVariant; size?: CardTextSize }
  | { kind: 'fields'; key: string; items: CustomFieldCardItem[] }
  | { kind: 'metaRows'; key: string; rows: CardMetaRowValue[] }
  | { kind: 'tags'; key: string; tags: CardTagValue[] }
  | { kind: 'actions'; key: string; placement: CardActionsPlacement; actions: RecordCardAction[] }
  | { kind: 'text'; key: string; text: string; tone: CardTone; size?: CardTextSize }
  | { kind: 'icon'; key: string; iconKey: string; tone: CardTone };

/**
 * As perguntas que o cartão faz sobre um registro — todas já existentes na listagem. É o mesmo cartão
 * padrão, respondido pelas mesmas funções, só que arranjado pela declaração.
 */
export interface CardTemplateResolvers {
  title: (record: EntityRecord) => string;
  subtitle: (record: EntityRecord) => string;
  subtitleIconKey: string | null;
  imageUrl: (record: EntityRecord) => string | null;
  fieldItem: (record: EntityRecord, fieldKey: string, options?: { badges?: boolean }) => CustomFieldCardItem | null;
  /** O rótulo resolvido do campo — `label: true` num nó `field` sem rótulo de listagem. */
  fieldLabel: (fieldKey: string) => string | undefined;
  fields: (record: EntityRecord) => CustomFieldCardItem[];
  metaRows: (record: EntityRecord) => CardMetaRowValue[];
  tags: (record: EntityRecord) => CardTagValue[];
  actions: (record: EntityRecord) => RecordCardAction[];
  isHidden: (record: EntityRecord, hiddenWhen: string | undefined) => boolean;
  /** Texto declarativo: referência `@ns/chave` traduzida, texto do escritório intacto. */
  label: (text: string) => string;
}

const isEmptyValue = (value: unknown): boolean =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

const pickActions = (actions: RecordCardAction[], include?: string[], exclude?: string[]): RecordCardAction[] => {
  const matches = (action: RecordCardAction, keys: string[]) => action.refs.some((ref) => keys.includes(ref));
  const included = include
    ? include.flatMap((key) => actions.filter((action) => action.refs.includes(key)))
      .filter((action, index, all) => all.indexOf(action) === index)
    : actions;
  return exclude ? included.filter((action) => !matches(action, exclude)) : included;
};

const resolveNode = (
  node: CardNode,
  key: string,
  record: EntityRecord,
  resolvers: CardTemplateResolvers,
): ResolvedCardNode | null => {
  if (resolvers.isHidden(record, node.hiddenWhen)) return null;
  switch (node.type) {
    case 'row':
    case 'stack': {
      const children = resolveCardNodes(node.children, record, resolvers, key);
      if (children.length === 0) return null;
      return node.type === 'row'
        ? { kind: 'row', key, children, gap: node.gap ?? 'sm', align: node.align, justify: node.justify, wrap: !!node.wrap }
        : { kind: 'stack', key, children, gap: node.gap ?? 'sm' };
    }
    case 'spacer':
      return { kind: 'spacer', key };
    case 'divider':
      return { kind: 'divider', key };
    case 'avatar':
      return { kind: 'avatar', key, size: node.size ?? 'md', imageUrl: resolvers.imageUrl(record), name: resolvers.title(record) };
    case 'title':
      return { kind: 'title', key, text: resolvers.title(record), size: node.size };
    case 'subtitle': {
      const text = resolvers.subtitle(record);
      return text ? { kind: 'subtitle', key, text, iconKey: resolvers.subtitleIconKey } : null;
    }
    case 'field': {
      const variant = node.variant ?? 'text';
      const item = resolvers.fieldItem(record, node.field, { badges: variant === 'badge' });
      if (!item) return null;
      if (!node.showEmpty && isEmptyValue(readValueByPath(record, node.field))) return null;
      const label = node.label === true
        ? item.label ?? resolvers.fieldLabel(node.field)
        : node.label ? resolvers.label(node.label) : undefined;
      return { kind: 'field', key, item, label, iconKey: node.icon, variant, size: node.size };
    }
    case 'fields': {
      const items = resolvers.fields(record);
      return items.length > 0 ? { kind: 'fields', key, items } : null;
    }
    case 'metaRows': {
      const rows = resolvers.metaRows(record);
      return rows.length > 0 ? { kind: 'metaRows', key, rows } : null;
    }
    case 'tags': {
      const tags = resolvers.tags(record);
      return tags.length > 0 ? { kind: 'tags', key, tags } : null;
    }
    case 'actions': {
      const actions = pickActions(resolvers.actions(record), node.include, node.exclude);
      return actions.length > 0 ? { kind: 'actions', key, placement: node.placement ?? 'inline', actions } : null;
    }
    case 'text':
      return { kind: 'text', key, text: resolvers.label(node.text), tone: node.tone ?? 'default', size: node.size };
    case 'icon':
      return { kind: 'icon', key, iconKey: node.icon, tone: node.tone ?? 'muted' };
    default:
      return null;
  }
};

/**
 * Responde a árvore declarada para um registro. Some o que o `hiddenWhen` esconde (com tudo o que
 * contém), o campo vazio (salvo `showEmpty`), o bloco sem conteúdo e o contêiner que ficou sem
 * filhos — um cartão declarado não mostra moldura vazia. Nó que este kernel não conhece é ignorado.
 */
export const resolveCardNodes = (
  nodes: readonly CardNode[],
  record: EntityRecord,
  resolvers: CardTemplateResolvers,
  parentKey = '',
): ResolvedCardNode[] =>
  nodes
    .map((node, index) => resolveNode(node, parentKey ? `${parentKey}.${index}` : String(index), record, resolvers))
    .filter((node): node is ResolvedCardNode => node !== null);
