import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import type { IconType } from 'react-icons';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { getScreenIconOptions } from '../../../shared/screenIcons';
import {
  childrenOf,
  countNodes,
  duplicateNode,
  fitsDepth,
  getIn,
  insertNode,
  isTemplateObject,
  isWithin,
  issueTarget,
  moveNode,
  nodeAt,
  parentOf,
  parsePathKey,
  pathKey,
  removeNode,
  setIn,
  unwrapNode,
  updateNode,
  wrapNode,
} from '../../../shared/templateDesigner/templateTree';
import type { PlacementLimits, TemplateNode, TreePath } from '../../../shared/templateDesigner/templateTree';
import { isVocabularyContainer, vocabularyNode } from '../../../shared/templateDesigner/templateVocabulary';
import type {
  TemplateNodeSpec,
  TemplatePropertySpec,
  TemplateVocabulary,
} from '../../../shared/templateDesigner/templateVocabulary';
import { UNKNOWN_NODE_ICON } from '../../../shared/templateDesigner/cardDesignerVocabulary';
import type { SearchSelectOption } from '../SearchSelect';

export interface TemplateDesignerField {
  key: string;
  /** Rótulo declarativo do campo — resolvido aqui, como em qualquer ponto de render. */
  label: string;
  type: string;
}

export interface TemplateDesignerOption {
  value: string;
  label: string;
}

/** Um problema do portão de autoria, ainda como chave do catálogo e com o `where` dele. */
export interface TemplateDesignerIssue {
  message: string;
  messageParams: Record<string, string>;
}

export interface TemplateDesignerProps {
  vocabulary: TemplateVocabulary;
  /** O template já parseado (`{ body, accent… }`) — o designer só o edita quando o JSON é válido. */
  design: TemplateNode;
  onChange: (design: TemplateNode) => void;
  issues: readonly TemplateDesignerIssue[];
  fields: readonly TemplateDesignerField[];
  /** As ações que a tela oferece, pela chave estável — para `include`/`exclude`. */
  actionOptions?: readonly TemplateDesignerOption[];
  onUndo?: () => void;
  onRedo?: () => void;
  /** O que aparece abaixo do canvas — a pré-visualização sobre um registro de verdade. */
  preview?: React.ReactNode;
}

export interface DesignerSlot {
  id: string;
  allowed: boolean;
  active: boolean;
}

export interface DesignerCanvasNode {
  key: string;
  label: string;
  /** O nome do tipo, quando `label` mostra o detalhe (o campo, o texto). */
  caption?: string;
  icon: IconType;
  container?: 'row' | 'column';
  selected: boolean;
  invalid: boolean;
  hidden: boolean;
  dragging: boolean;
  children: DesignerCanvasNode[];
  /** Os pontos de soltura entre os filhos — um a mais que os filhos. Só em contêiner. */
  slots: DesignerSlot[];
}

export interface DesignerPaletteItem {
  id: string;
  label: string;
  icon: IconType;
  disabled: boolean;
}

export interface DesignerPaletteGroup {
  key: string;
  label: string;
  items: DesignerPaletteItem[];
}

interface DesignerChoice {
  value: string;
  label: string;
  active: boolean;
}

interface DesignerPropertyBase {
  key: string;
  label: string;
  errors: string[];
}

export type DesignerProperty =
  | DesignerPropertyBase & { kind: 'enum'; choices: DesignerChoice[] }
  | DesignerPropertyBase & { kind: 'boolean'; checked: boolean }
  | DesignerPropertyBase & { kind: 'field' | 'icon'; value: string; options: SearchSelectOption[] }
  | DesignerPropertyBase & { kind: 'text' | 'expression'; value: string }
  | DesignerPropertyBase & { kind: 'fieldLabel'; choices: DesignerChoice[]; custom: boolean; text: string }
  | DesignerPropertyBase & { kind: 'actionKeys'; values: string[]; options: TemplateDesignerOption[] };

export interface DesignerWrapOption {
  type: string;
  label: string;
  icon: IconType;
  disabled: boolean;
}

export interface DesignerInspector {
  title: string;
  icon: IconType | null;
  isRoot: boolean;
  /** Os problemas do nó que não são de uma propriedade editável. */
  issues: string[];
  properties: DesignerProperty[];
  tools: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    canUnwrap: boolean;
    canDuplicate: boolean;
    wrapOptions: DesignerWrapOption[];
  } | null;
}

export type DesignerSideTab = 'palette' | 'properties';

export interface TemplateDesignerViewModel {
  nodes: DesignerCanvasNode[];
  rootSlots: DesignerSlot[];
  empty: boolean;
  dragging: boolean;
  globalIssues: string[];
  palette: DesignerPaletteGroup[];
  paletteFull: boolean;
  inspector: DesignerInspector;
  sideTab: DesignerSideTab;
  preview?: React.ReactNode;
  setSideTab: (tab: DesignerSideTab) => void;
  select: (key: string, event: React.MouseEvent) => void;
  clearSelection: () => void;
  addFromPalette: (itemId: string) => void;
  setProperty: (key: string, value: unknown) => void;
  setEnum: (key: string, value: string) => void;
  setFieldLabelMode: (key: string, mode: string) => void;
  setFieldLabelText: (key: string, text: string) => void;
  moveSelected: (delta: -1 | 1) => void;
  duplicateSelected: () => void;
  wrapSelected: (type: string) => void;
  unwrapSelected: () => void;
  removeSelected: () => void;
  startPaletteDrag: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  startNodeDrag: (key: string, event: React.DragEvent<HTMLElement>) => void;
  dragOverNode: (key: string, event: React.DragEvent<HTMLElement>) => void;
  dragOverSlot: (slotId: string, event: React.DragEvent<HTMLElement>) => void;
  dragOverCanvas: (event: React.DragEvent<HTMLElement>) => void;
  drop: (event: React.DragEvent<HTMLElement>) => void;
  endDrag: () => void;
  keyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

type DragSource = { kind: 'palette'; node: TemplateNode } | { kind: 'node'; path: TreePath };

interface DropTarget {
  parentPath: TreePath;
  index: number;
}

interface DragState {
  source: DragSource;
  over: DropTarget | null;
}

const slotId = (parentPath: TreePath, index: number): string => `${pathKey(parentPath)}|${index}`;

const parseSlotId = (id: string): DropTarget => {
  const [parent, index] = id.split('|');
  return { parentPath: parsePathKey(parent), index: Number(index) };
};

const sameTarget = (a: DropTarget | null, b: DropTarget | null): boolean =>
  !!a && !!b && a.index === b.index && pathKey(a.parentPath) === pathKey(b.parentPath);

const onCanvas = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && !!target.closest('[data-designer-canvas]');

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]');

interface NodeIssues {
  general: string[];
  byProperty: Map<string, string[]>;
}

/**
 * O designer visual de um template declarativo. Edita a árvore CRUA do JSON — o mesmo valor que o
 * modo JSON mostra e que é gravado —, e por isso nunca perde o nó que não reconhece: ele aparece como
 * "elemento desconhecido", com o problema que o portão apontou.
 */
export const useTemplateDesignerViewModel = ({
  vocabulary,
  design,
  onChange,
  issues,
  fields,
  actionOptions = [],
  onUndo,
  onRedo,
  preview,
}: TemplateDesignerProps): TemplateDesignerViewModel => {
  const t = useT('core.records');
  const label = useLabel();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<DesignerSideTab>('palette');
  const [drag, setDrag] = useState<DragState | null>(null);

  const body = useMemo<readonly unknown[]>(() => {
    const raw = design[vocabulary.bodyKey];
    return Array.isArray(raw) ? raw : [];
  }, [design, vocabulary.bodyKey]);

  const isContainer = useMemo(() => isVocabularyContainer(vocabulary), [vocabulary]);
  const limits = useMemo<PlacementLimits>(
    () => ({ isContainer, rootDepth: vocabulary.rootDepth, maxDepth: vocabulary.maxDepth }),
    [isContainer, vocabulary.rootDepth, vocabulary.maxDepth],
  );
  const nodeCount = useMemo(() => countNodes(body), [body]);
  const paletteFull = nodeCount >= vocabulary.maxNodes;

  // A seleção é DERIVADA: um nó que deixou de existir (o JSON mudou) simplesmente não está escolhido.
  const selectedPath = useMemo<TreePath | null>(() => {
    if (selectedKey === null) return null;
    const path = parsePathKey(selectedKey);
    return nodeAt(body, path) === undefined ? null : path;
  }, [selectedKey, body]);

  const fieldLabelOf = useCallback(
    (key: string) => {
      const field = fields.find((candidate) => candidate.key === key);
      return field ? label(field.label) : undefined;
    },
    [fields, label],
  );

  const specOf = useCallback((node: unknown): TemplateNodeSpec | undefined =>
    (isTemplateObject(node) ? vocabularyNode(vocabulary, node.type) : undefined), [vocabulary]);

  const typeLabelOf = useCallback((node: unknown): string => {
    const spec = specOf(node);
    if (spec) return label(spec.label);
    const type = isTemplateObject(node) && typeof node.type === 'string' ? node.type : '?';
    return t('template-designer.unknown-node', { type });
  }, [specOf, label, t]);

  const propertyLabelOf = useCallback((specs: readonly TemplatePropertySpec[], key: string | null): string | undefined => {
    const spec = key ? specs.find((candidate) => candidate.key === key) : undefined;
    return spec ? label(spec.label) : undefined;
  }, [label]);

  /** Os problemas do portão, cada um no nó e na propriedade que o causa — com o nome legível no lugar do caminho. */
  const issueIndex = useMemo(() => {
    const byNode = new Map<string, NodeIssues>();
    const byRootProperty = new Map<string, string[]>();
    const global: string[] = [];
    for (const issue of issues) {
      const target = issueTarget(issue.messageParams.where ?? '', vocabulary.issueRoot, vocabulary.bodyKey);
      if (target.scope === 'node') {
        const node = nodeAt(body, target.path);
        const spec = specOf(node);
        const propertyLabel = spec ? propertyLabelOf(spec.properties, target.property) : undefined;
        const where = propertyLabel ?? typeLabelOf(node);
        const text = label(issue.message, { ...issue.messageParams, where });
        const entry = byNode.get(pathKey(target.path)) ?? { general: [], byProperty: new Map<string, string[]>() };
        if (propertyLabel && target.property) {
          entry.byProperty.set(target.property, [...(entry.byProperty.get(target.property) ?? []), text]);
        } else {
          entry.general.push(text);
        }
        byNode.set(pathKey(target.path), entry);
      } else if (target.scope === 'root' && propertyLabelOf(vocabulary.rootProperties, target.property)) {
        const where = propertyLabelOf(vocabulary.rootProperties, target.property) ?? '';
        byRootProperty.set(target.property, [
          ...(byRootProperty.get(target.property) ?? []),
          label(issue.message, { ...issue.messageParams, where }),
        ]);
      } else {
        global.push(label(issue.message, { ...issue.messageParams, where: t('template-designer.root') }));
      }
    }
    return { byNode, byRootProperty, global };
  }, [issues, vocabulary, body, specOf, propertyLabelOf, typeLabelOf, label, t]);

  const canPlace = useCallback((source: DragSource, parentPath: TreePath): boolean => {
    if (parentPath.length > 0) {
      const parent = nodeAt(body, parentPath);
      if (!isTemplateObject(parent) || !isContainer(parent.type)) return false;
    }
    if (source.kind === 'node') {
      if (isWithin(parentPath, source.path)) return false;
      return fitsDepth(nodeAt(body, source.path), parentPath, limits);
    }
    return !paletteFull && fitsDepth(source.node, parentPath, limits);
  }, [body, isContainer, limits, paletteFull]);

  const slotsFor = useCallback((parentPath: TreePath, count: number): DesignerSlot[] => {
    const allowed = drag ? canPlace(drag.source, parentPath) : false;
    return Array.from({ length: count + 1 }, (_, index) => ({
      id: slotId(parentPath, index),
      allowed,
      active: allowed && sameTarget(drag?.over ?? null, { parentPath, index }),
    }));
  }, [drag, canPlace]);

  const nodes = useMemo<DesignerCanvasNode[]>(() => {
    const build = (list: readonly unknown[], parentPath: TreePath): DesignerCanvasNode[] =>
      list.map((node, index) => {
        const path = [...parentPath, index];
        const key = pathKey(path);
        const spec = specOf(node);
        const typeLabel = typeLabelOf(node);
        const summary = spec?.summary && isTemplateObject(node)
          ? spec.summary(node, { fieldLabel: fieldLabelOf, label: (text) => label(text) })
          : undefined;
        const children = spec?.container ? childrenOf(node) ?? [] : [];
        return {
          key,
          label: summary ?? typeLabel,
          caption: summary ? typeLabel : undefined,
          icon: spec?.icon ?? UNKNOWN_NODE_ICON,
          container: spec?.container,
          selected: selectedKey !== null && key === pathKey(selectedPath ?? [-1]),
          invalid: !spec || issueIndex.byNode.has(key),
          hidden: isTemplateObject(node) && typeof node.hiddenWhen === 'string' && node.hiddenWhen.trim() !== '',
          dragging: drag?.source.kind === 'node' && pathKey(drag.source.path) === key,
          children: build(children, path),
          slots: spec?.container ? slotsFor(path, children.length) : [],
        };
      });
    return build(body, []);
  }, [body, specOf, typeLabelOf, fieldLabelOf, label, selectedKey, selectedPath, issueIndex, drag, slotsFor]);

  const rootSlots = useMemo(() => slotsFor([], body.length), [slotsFor, body.length]);

  const fieldNodeType = useMemo(() => {
    const sample = vocabulary.fieldNode?.('');
    return sample && typeof sample.type === 'string' ? sample.type : null;
  }, [vocabulary]);

  const palette = useMemo<DesignerPaletteGroup[]>(() => {
    const byGroup = (group: TemplateNodeSpec['group']): DesignerPaletteItem[] =>
      vocabulary.nodes
        .filter((spec) => spec.group === group && spec.type !== fieldNodeType)
        .map((spec) => ({ id: `node:${spec.type}`, label: label(spec.label), icon: spec.icon, disabled: paletteFull }));
    const fieldSpec = fieldNodeType ? vocabularyNode(vocabulary, fieldNodeType) : undefined;
    const fieldItems = vocabulary.fieldNode
      ? fields.map((field) => ({
        id: `field:${field.key}`,
        label: label(field.label),
        icon: fieldSpec?.icon ?? UNKNOWN_NODE_ICON,
        disabled: paletteFull,
      }))
      : [];
    return [
      { key: 'record', label: t('template-designer.group.record'), items: byGroup('record') },
      { key: 'fields', label: t('template-designer.group.fields'), items: fieldItems },
      { key: 'content', label: t('template-designer.group.content'), items: byGroup('content') },
      { key: 'structure', label: t('template-designer.group.structure'), items: byGroup('structure') },
    ].filter((group) => group.items.length > 0);
  }, [vocabulary, fieldNodeType, fields, paletteFull, label, t]);

  const paletteNode = useCallback((itemId: string): TemplateNode | null => {
    const [kind, ...rest] = itemId.split(':');
    const value = rest.join(':');
    if (kind === 'field') return vocabulary.fieldNode?.(value) ?? null;
    return vocabularyNode(vocabulary, value)?.create() ?? null;
  }, [vocabulary]);

  const commitBody = useCallback((nextBody: unknown[], nextSelected: TreePath | null) => {
    onChange(setIn(design, vocabulary.bodyKey, nextBody));
    setSelectedKey(nextSelected ? pathKey(nextSelected) : null);
  }, [onChange, design, vocabulary.bodyKey]);

  /** Onde o clique na paleta acrescenta: dentro do contêiner escolhido, depois da folha escolhida, ou no fim. */
  const clickTarget = useCallback((node: TemplateNode): DropTarget => {
    const candidates: DropTarget[] = [];
    if (selectedPath) {
      const selected = nodeAt(body, selectedPath);
      if (isTemplateObject(selected) && isContainer(selected.type)) {
        candidates.push({ parentPath: selectedPath, index: childrenOf(selected)?.length ?? 0 });
      } else {
        candidates.push({ parentPath: parentOf(selectedPath), index: selectedPath[selectedPath.length - 1] + 1 });
      }
    }
    candidates.push({ parentPath: [], index: body.length });
    return candidates.find((candidate) => canPlace({ kind: 'palette', node }, candidate.parentPath)) ?? candidates[candidates.length - 1];
  }, [selectedPath, body, isContainer, canPlace]);

  const addFromPalette = useCallback((itemId: string) => {
    const node = paletteNode(itemId);
    if (!node || paletteFull) return;
    const target = clickTarget(node);
    const edit = insertNode(body, target.parentPath, target.index, node);
    commitBody(edit.body, edit.path);
  }, [paletteNode, paletteFull, clickTarget, body, commitBody]);

  const selectedNode = selectedPath ? nodeAt(body, selectedPath) : undefined;
  const selectedSpec = specOf(selectedNode);

  const setProperty = useCallback((key: string, value: unknown) => {
    const cleared = value === '' || (Array.isArray(value) && value.length === 0) || value === false ? undefined : value;
    if (selectedPath) {
      commitBody(updateNode(body, selectedPath, key, cleared), selectedPath);
    } else {
      onChange(setIn(design, key, cleared));
    }
  }, [selectedPath, body, commitBody, onChange, design]);

  const propertySpecs = useMemo(
    () => (selectedPath ? selectedSpec?.properties ?? [] : vocabulary.rootProperties),
    [selectedPath, selectedSpec, vocabulary.rootProperties],
  );

  const setEnum = useCallback((key: string, value: string) => {
    const spec = propertySpecs.find((candidate) => candidate.key === key);
    setProperty(key, spec?.kind === 'enum' && spec.defaultValue === value ? undefined : value);
  }, [propertySpecs, setProperty]);

  // O rótulo próprio ainda sem texto é um espaço: a chave precisa existir para o modo continuar
  // "texto", e o portão aponta o rótulo vazio até a pessoa escrever.
  const setFieldLabelMode = useCallback((key: string, mode: string) => {
    setProperty(key, mode === 'field' ? true : mode === 'custom' ? ' ' : undefined);
  }, [setProperty]);

  const setFieldLabelText = useCallback((key: string, text: string) => {
    setProperty(key, text === '' ? ' ' : text);
  }, [setProperty]);

  const iconOptions = useMemo<SearchSelectOption[]>(
    () => getScreenIconOptions().map((entry) => ({ value: entry.key, label: label(entry.label), icon: entry.Icon })),
    [label],
  );

  const inspector = useMemo<DesignerInspector>(() => {
    const owner: unknown = selectedPath ? selectedNode : design;
    const nodeIssues = selectedPath ? issueIndex.byNode.get(pathKey(selectedPath)) : undefined;
    const errorsOf = (key: string): string[] =>
      selectedPath ? nodeIssues?.byProperty.get(key) ?? [] : issueIndex.byRootProperty.get(key) ?? [];
    const noneOption = { value: '', label: t('template-designer.none') };

    const properties = propertySpecs.map((spec): DesignerProperty => {
      const raw = getIn(owner, spec.key);
      const base = { key: spec.key, label: label(spec.label), errors: errorsOf(spec.key) };
      switch (spec.kind) {
        case 'enum': {
          const current = typeof raw === 'string' ? raw : spec.defaultValue;
          return { ...base, kind: 'enum', choices: spec.options.map((entry) => ({ value: entry.value, label: label(entry.label), active: entry.value === current })) };
        }
        case 'boolean':
          return { ...base, kind: 'boolean', checked: raw === true };
        case 'field': {
          const value = typeof raw === 'string' ? raw : '';
          const allowed = fields.filter((field) => !spec.fieldTypes || spec.fieldTypes.includes(field.type));
          const options = allowed.map((field) => ({ value: field.key, label: label(field.label), meta: field.key }));
          const orphan = value && !options.some((entry) => entry.value === value) ? [{ value, label: value }] : [];
          return { ...base, kind: 'field', value, options: [...(spec.required ? [] : [noneOption]), ...options, ...orphan] };
        }
        case 'icon': {
          const value = typeof raw === 'string' ? raw : '';
          return { ...base, kind: 'icon', value, options: spec.required ? iconOptions : [noneOption, ...iconOptions] };
        }
        case 'text':
        case 'expression':
          return { ...base, kind: spec.kind, value: typeof raw === 'string' ? raw : '' };
        case 'fieldLabel': {
          const mode = raw === true ? 'field' : typeof raw === 'string' ? 'custom' : 'none';
          return {
            ...base,
            kind: 'fieldLabel',
            choices: [
              { value: 'none', label: t('template-designer.label.none'), active: mode === 'none' },
              { value: 'field', label: t('template-designer.label.field'), active: mode === 'field' },
              { value: 'custom', label: t('template-designer.label.custom'), active: mode === 'custom' },
            ],
            custom: mode === 'custom',
            text: typeof raw === 'string' ? raw.trim() : '',
          };
        }
        case 'actionKeys': {
          const values = Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
          const unknown = values.filter((value) => !actionOptions.some((entry) => entry.value === value)).map((value) => ({ value, label: value }));
          return { ...base, kind: 'actionKeys', values, options: [...actionOptions, ...unknown] };
        }
        default:
          return { ...base, kind: 'text', value: '' };
      }
    });

    if (!selectedPath) {
      // Os problemas globais já aparecem acima do designer; repeti-los aqui seria ruído.
      return { title: t('template-designer.root'), icon: null, isRoot: true, issues: [], properties, tools: null };
    }
    const siblings = selectedPath.length > 1 ? childrenOf(nodeAt(body, parentOf(selectedPath))) ?? [] : body;
    const index = selectedPath[selectedPath.length - 1];
    const known = new Set(propertySpecs.map((spec) => spec.key));
    const stray = [...(nodeIssues?.byProperty.entries() ?? [])].filter(([key]) => !known.has(key)).flatMap(([, texts]) => texts);
    return {
      title: typeLabelOf(selectedNode),
      icon: selectedSpec?.icon ?? UNKNOWN_NODE_ICON,
      isRoot: false,
      issues: [...(nodeIssues?.general ?? []), ...stray],
      properties,
      tools: {
        canMoveUp: index > 0,
        canMoveDown: index < siblings.length - 1,
        canUnwrap: !!selectedSpec?.container,
        canDuplicate: !paletteFull && fitsDepth(selectedNode, parentOf(selectedPath), limits)
          && nodeCount + countNodes([selectedNode]) <= vocabulary.maxNodes,
        wrapOptions: vocabulary.nodes.filter((spec) => spec.container).map((spec) => ({
          type: spec.type,
          label: label(spec.label),
          icon: spec.icon,
          disabled: paletteFull || !fitsDepth({ type: spec.type, children: [selectedNode] }, parentOf(selectedPath), limits),
        })),
      },
    };
  }, [selectedPath, selectedNode, selectedSpec, design, issueIndex, propertySpecs, label, t, fields, iconOptions, actionOptions, body, typeLabelOf, paletteFull, limits, nodeCount, vocabulary]);

  const select = useCallback((key: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedKey(key);
    setSideTab('properties');
  }, []);

  const clearSelection = useCallback(() => setSelectedKey(null), []);

  const moveSelected = useCallback((delta: -1 | 1) => {
    if (!selectedPath) return;
    const index = selectedPath[selectedPath.length - 1];
    const edit = moveNode(body, selectedPath, parentOf(selectedPath), delta < 0 ? index - 1 : index + 2);
    if (edit) commitBody(edit.body, edit.path);
  }, [selectedPath, body, commitBody]);

  const duplicateSelected = useCallback(() => {
    if (!selectedPath) return;
    const edit = duplicateNode(body, selectedPath);
    if (edit) commitBody(edit.body, edit.path);
  }, [selectedPath, body, commitBody]);

  const wrapSelected = useCallback((type: string) => {
    const spec = vocabularyNode(vocabulary, type);
    if (!selectedPath || !spec) return;
    const edit = wrapNode(body, selectedPath, spec.create());
    if (edit) commitBody(edit.body, edit.path);
  }, [vocabulary, selectedPath, body, commitBody]);

  const unwrapSelected = useCallback(() => {
    if (!selectedPath) return;
    const edit = unwrapNode(body, selectedPath);
    if (edit) commitBody(edit.body, (childrenOf(nodeAt(body, selectedPath))?.length ?? 0) > 0 ? edit.path : null);
  }, [selectedPath, body, commitBody]);

  const removeSelected = useCallback(() => {
    if (!selectedPath) return;
    commitBody(removeNode(body, selectedPath), null);
  }, [selectedPath, body, commitBody]);

  const startPaletteDrag = useCallback((itemId: string, event: React.DragEvent<HTMLElement>) => {
    const node = paletteNode(itemId);
    if (!node || paletteFull) {
      event.preventDefault();
      return;
    }
    // Sem dado nenhum, o Firefox não começa o arrasto.
    event.dataTransfer.setData('text/plain', itemId);
    event.dataTransfer.effectAllowed = 'copy';
    setDrag({ source: { kind: 'palette', node }, over: null });
  }, [paletteNode, paletteFull]);

  const startNodeDrag = useCallback((key: string, event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    event.dataTransfer.setData('text/plain', key);
    event.dataTransfer.effectAllowed = 'move';
    setDrag({ source: { kind: 'node', path: parsePathKey(key) }, over: null });
  }, []);

  const hover = useCallback((target: DropTarget, event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!drag || !canPlace(drag.source, target.parentPath)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = drag.source.kind === 'palette' ? 'copy' : 'move';
    if (!sameTarget(drag.over, target)) setDrag({ ...drag, over: target });
  }, [drag, canPlace]);

  /**
   * Sobre uma folha, ou sobre o cabeçalho de um contêiner, a metade em que o ponteiro está decide antes
   * ou depois — na direção do contêiner que guarda o nó. Sobre o corpo de um contêiner (fora dos filhos,
   * que tratam o próprio arrasto), o nó entra no fim dele.
   */
  const dragOverNode = useCallback((key: string, event: React.DragEvent<HTMLElement>) => {
    if (!drag) return;
    const path = parsePathKey(key);
    const node = nodeAt(body, path);
    const onEdge = event.target instanceof HTMLElement && !!event.target.closest('[data-designer-edge]');
    if (isTemplateObject(node) && isContainer(node.type) && !onEdge && canPlace(drag.source, path)) {
      hover({ parentPath: path, index: childrenOf(node)?.length ?? 0 }, event);
      return;
    }
    const parentPath = parentOf(path);
    const parent = parentPath.length > 0 ? nodeAt(body, parentPath) : null;
    const horizontal = specOf(parent)?.container === 'row';
    const rect = event.currentTarget.getBoundingClientRect();
    const after = horizontal ? event.clientX > rect.left + rect.width / 2 : event.clientY > rect.top + rect.height / 2;
    hover({ parentPath, index: path[path.length - 1] + (after ? 1 : 0) }, event);
  }, [drag, body, isContainer, canPlace, hover, specOf]);

  const dragOverSlot = useCallback((id: string, event: React.DragEvent<HTMLElement>) => {
    hover(parseSlotId(id), event);
  }, [hover]);

  const dragOverCanvas = useCallback((event: React.DragEvent<HTMLElement>) => {
    hover({ parentPath: [], index: body.length }, event);
  }, [hover, body.length]);

  const drop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const state = drag;
    setDrag(null);
    if (!state?.over || !canPlace(state.source, state.over.parentPath)) return;
    if (state.source.kind === 'palette') {
      const edit = insertNode(body, state.over.parentPath, state.over.index, state.source.node);
      commitBody(edit.body, edit.path);
      return;
    }
    const edit = moveNode(body, state.source.path, state.over.parentPath, state.over.index);
    if (edit) commitBody(edit.body, edit.path);
  }, [drag, canPlace, body, commitBody]);

  const endDrag = useCallback(() => setDrag(null), []);

  const keyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (isEditableTarget(event.target)) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) onRedo?.(); else onUndo?.();
    } else if (mod && key === 'y') {
      event.preventDefault();
      onRedo?.();
    } else if (!onCanvas(event.target)) {
      // Apagar e soltar a seleção pelo teclado só valem com o foco no canvas: no painel de
      // propriedades, um Backspace num botão apagaria o nó que a pessoa está editando.
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedPath) {
      event.preventDefault();
      removeSelected();
    } else if (event.key === 'Escape' && selectedPath) {
      event.preventDefault();
      setSelectedKey(null);
    }
  }, [onUndo, onRedo, selectedPath, removeSelected]);

  return {
    nodes,
    rootSlots,
    empty: body.length === 0,
    dragging: drag !== null,
    globalIssues: issueIndex.global,
    palette,
    paletteFull,
    inspector,
    sideTab,
    preview,
    setSideTab,
    select,
    clearSelection,
    addFromPalette,
    setProperty,
    setEnum,
    setFieldLabelMode,
    setFieldLabelText,
    moveSelected,
    duplicateSelected,
    wrapSelected,
    unwrapSelected,
    removeSelected,
    startPaletteDrag,
    startNodeDrag,
    dragOverNode,
    dragOverSlot,
    dragOverCanvas,
    drop,
    endDrag,
    keyDown,
  };
};
