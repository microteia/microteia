import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Condition, FieldComparisonCondition, WorkflowParameter } from '../../../../domain/entities/Workflow';
import type { WorkflowEventFieldOption } from '../../../../domain/services/workflowEventCatalog';
import { eventNameToRoot, WORKFLOW_CALLED_EVENT, workflowParametersToRoot } from '../../../../domain/services/workflowEventCatalog';
import type { PathRoot } from '../../../../domain/schema/pathResolver';
import { resolvePath, stripEventPrefix } from '../../../../domain/schema/pathResolver';
import type { StepOutputField, WorkflowVariable } from '../ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../SearchSelect';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { useSchemaContext } from '../../../shared/useSchemaContext';
import { useLookupValues } from '../../../shared/useLookupValues';
import {
  CONDITION_OPERATOR_LABELS,
  EVENT_FIELD_PATH_PREFIX,
  buildConditionEventFields,
} from '../../../shared/conditionHelpers';

export type ConditionMode = 'always' | 'custom';
export type GroupOperator = 'and' | 'or';

export interface BuilderComparisonNode {
  id: string;
  type: 'comparison';
  negated: boolean;
  fieldPath: string;
  operator: FieldComparisonCondition['operator'];
  value: string;
  valueType: FieldComparisonCondition['valueType'];
}

export interface BuilderExpressionNode {
  id: string;
  type: 'expression';
  negated: boolean;
  expression: string;
}

export interface BuilderGroupNode {
  id: string;
  type: 'group';
  negated: boolean;
  operator: GroupOperator;
  children: BuilderNode[];
}

export type BuilderNode = BuilderComparisonNode | BuilderExpressionNode | BuilderGroupNode;

export interface ConditionBuilderViewModel {
  mode: ConditionMode;
  setMode: (mode: ConditionMode) => void;
  root: BuilderGroupNode;
  fieldOptions: SearchSelectOption[];
  operatorOptions: SearchSelectOption[];
  eventFields: WorkflowEventFieldOption[];
  pathRoot: PathRoot | null;
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
  inputRoot: PathRoot | null;
  getLookupValueOptions: (fieldPath: string) => SearchSelectOption[] | null;
  setGroupOperator: (groupId: string, operator: GroupOperator) => void;
  toggleNegated: (nodeId: string) => void;
  updateComparison: (nodeId: string, updates: Partial<Omit<BuilderComparisonNode, 'id' | 'type'>>) => void;
  updateExpression: (nodeId: string, expression: string) => void;
  addComparison: (groupId: string) => void;
  addExpression: (groupId: string) => void;
  addGroup: (groupId: string) => void;
  wrapGroupChildren: (groupId: string) => void;
  removeNode: (nodeId: string) => void;
  focusedNodeId: string | null;
  toggleCollapsed: (nodeId: string) => void;
  isCollapsed: (nodeId: string) => boolean;
  getNodeSummary: (node: BuilderNode) => string;
}

const OPERATOR_OPTIONS: SearchSelectOption[] = Object.entries(CONDITION_OPERATOR_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const newComparisonNode = (): BuilderComparisonNode => ({
  id: crypto.randomUUID(),
  type: 'comparison',
  negated: false,
  fieldPath: '',
  operator: '==',
  value: '',
  valueType: 'literal',
});

const newExpressionNode = (): BuilderExpressionNode => ({
  id: crypto.randomUUID(),
  type: 'expression',
  negated: false,
  expression: '',
});

const newGroupNode = (operator: GroupOperator): BuilderGroupNode => ({
  id: crypto.randomUUID(),
  type: 'group',
  negated: false,
  operator,
  children: [newComparisonNode()],
});

const conditionToNode = (condition: Condition): BuilderNode => {
  switch (condition.kind) {
    case 'Not': {
      const inner = conditionToNode(condition.condition);
      return { ...inner, negated: !inner.negated };
    }
    case 'LogicalAnd':
    case 'LogicalOr':
      return {
        id: crypto.randomUUID(),
        type: 'group',
        negated: false,
        operator: condition.kind === 'LogicalAnd' ? 'and' : 'or',
        children: condition.conditions.map(conditionToNode),
      };
    case 'FieldComparison':
      return {
        id: crypto.randomUUID(),
        type: 'comparison',
        negated: false,
        fieldPath: condition.fieldPath,
        operator: condition.operator,
        value: String(condition.value ?? ''),
        valueType: condition.valueType,
      };
    case 'Expression':
      return {
        id: crypto.randomUUID(),
        type: 'expression',
        negated: false,
        expression: condition.expression,
      };
    case 'AlwaysTrue':
      return { ...newExpressionNode(), expression: 'true' };
  }
};

const conditionToRoot = (condition: Condition): BuilderGroupNode => {
  if (condition.kind === 'AlwaysTrue') return newGroupNode('and');
  const node = conditionToNode(condition);
  if (node.type === 'group' && !node.negated) return node;
  return { id: crypto.randomUUID(), type: 'group', negated: false, operator: 'and', children: [node] };
};

const nodeToCondition = (node: BuilderNode): Condition => {
  let base: Condition;
  if (node.type === 'group') {
    const children = node.children.map(nodeToCondition);
    base = children.length === 0
      ? { kind: 'AlwaysTrue' }
      : { kind: node.operator === 'and' ? 'LogicalAnd' : 'LogicalOr', conditions: children };
  } else if (node.type === 'comparison') {
    base = {
      kind: 'FieldComparison',
      fieldPath: node.fieldPath,
      operator: node.operator,
      value: node.value,
      valueType: node.valueType,
    };
  } else {
    base = { kind: 'Expression', expression: node.expression };
  }
  return node.negated ? { kind: 'Not', condition: base } : base;
};

const mapTree = (node: BuilderNode, nodeId: string, fn: (n: BuilderNode) => BuilderNode): BuilderNode => {
  if (node.id === nodeId) return fn(node);
  if (node.type !== 'group') return node;
  return { ...node, children: node.children.map((child) => mapTree(child, nodeId, fn)) };
};

const diagramPathToBuilderPath = (condition: Condition, path: number[]): number[] => {
  const builderPath: number[] = [];
  let current: Condition | undefined = condition;
  for (const index of path) {
    if (!current) break;
    if (current.kind === 'Not') {
      current = current.condition;
    } else if (current.kind === 'LogicalAnd' || current.kind === 'LogicalOr') {
      builderPath.push(index);
      current = current.conditions[index];
    } else {
      break;
    }
  }
  return builderPath;
};

const getNodeAtBuilderPath = (root: BuilderGroupNode, path: number[]): BuilderNode | undefined => {
  let current: BuilderNode | undefined = root;
  for (const index of path) {
    if (!current || current.type !== 'group') return undefined;
    current = current.children[index];
  }
  return current;
};

const removeFromTree = (node: BuilderNode, nodeId: string): BuilderNode | null => {
  if (node.id === nodeId) return null;
  if (node.type !== 'group') return node;
  const children = node.children
    .map((child) => removeFromTree(child, nodeId))
    .filter((child): child is BuilderNode => child !== null)
    .filter((child) => child.type !== 'group' || child.children.length > 0);
  return { ...node, children };
};

export const useConditionBuilderViewModel = (
  value: Condition,
  onChange: (condition: Condition) => void,
  eventName: string,
  screenKey?: string,
  focusPath?: number[] | null,
  onFocusHandled?: () => void,
  parameters?: WorkflowParameter[],
  stepOutputFields: StepOutputField[] = [],
  workflowVariables: WorkflowVariable[] = [],
  inputRoot: PathRoot | null = null,
): ConditionBuilderViewModel => {
  const { dynamicScreens } = useScreenDefinitions();

  const [mode, setModeState] = useState<ConditionMode>(value.kind === 'AlwaysTrue' ? 'always' : 'custom');
  const [root, setRoot] = useState<BuilderGroupNode>(() => conditionToRoot(value));
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const lastEmittedRef = useRef<Condition>(value);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setRoot(conditionToRoot(value));
    setModeState(value.kind === 'AlwaysTrue' ? 'always' : 'custom');
  }, [value]);

  useEffect(() => {
    if (!focusPath) return;
    const builderPath = diagramPathToBuilderPath(value, focusPath);
    const target = getNodeAtBuilderPath(root, builderPath);
    onFocusHandled?.();
    if (!target) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- destaque temporário do card pedido pelo diagrama; depende do root já renderizado
    setFocusedNodeId(target.id);
    requestAnimationFrame(() => {
      document.getElementById(`condition-node-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => setFocusedNodeId(null), 3000);
  }, [focusPath, value, root, onFocusHandled]);

  useEffect(() => () => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
  }, []);

  const toggleCollapsed = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback((nodeId: string) => collapsedIds.has(nodeId), [collapsedIds]);

  const eventFields = useMemo(
    () => buildConditionEventFields(eventName, screenKey, dynamicScreens, parameters),
    [eventName, screenKey, dynamicScreens, parameters],
  );

  const pathRoot = useMemo(
    () =>
      eventName === WORKFLOW_CALLED_EVENT
        ? workflowParametersToRoot(parameters)
        : eventNameToRoot(eventName, screenKey),
    [eventName, screenKey, parameters],
  );

  const schemaContext = useSchemaContext();
  const { getLookupOptions } = useLookupValues();

  const getLookupValueOptions = useCallback(
    (fieldPath: string): SearchSelectOption[] | null => {
      if (!pathRoot || !fieldPath) return null;
      const segments = stripEventPrefix(fieldPath);
      if (!segments) return null;
      const resolution = resolvePath(schemaContext, pathRoot, segments);
      if (!resolution.valid || resolution.node.kind !== 'scalar' || !resolution.node.lookupCollection) return null;
      const options = getLookupOptions(resolution.node.lookupCollection);
      return options.length > 0 ? options : null;
    },
    [pathRoot, schemaContext, getLookupOptions],
  );

  const fieldOptions = useMemo(
    (): SearchSelectOption[] =>
      eventFields.map((f) => ({ value: `${EVENT_FIELD_PATH_PREFIX}${f.path}`, label: f.label })),
    [eventFields],
  );

  const fieldLabelByPath = useMemo(
    () => new Map(fieldOptions.map((option) => [option.value, option.label])),
    [fieldOptions],
  );

  const getNodeSummary = useCallback((node: BuilderNode): string => {
    const prefix = node.negated ? 'NÃO ' : '';
    if (node.type === 'group') {
      const count = node.children.length;
      return `${prefix}${count} ${count === 1 ? 'condição' : 'condições'} (${node.operator === 'and' ? 'E' : 'OU'})`;
    }
    if (node.type === 'expression') {
      return `${prefix}${node.expression || 'expressão vazia'}`;
    }
    const field = node.fieldPath ? (fieldLabelByPath.get(node.fieldPath) ?? node.fieldPath) : 'campo não definido';
    const operator = CONDITION_OPERATOR_LABELS[node.operator] ?? node.operator;
    if (node.operator === 'isEmpty' || node.operator === 'isNotEmpty') {
      return `${prefix}${field} ${operator}`;
    }
    const value = node.valueType === 'eventField'
      ? (fieldLabelByPath.get(node.value) ?? node.value)
      : (node.value || 'valor não definido');
    return `${prefix}${field} ${operator} ${value}`;
  }, [fieldLabelByPath]);

  const emit = useCallback((nextRoot: BuilderGroupNode) => {
    setRoot(nextRoot);
    const condition = nodeToCondition(nextRoot);
    lastEmittedRef.current = condition;
    onChange(condition);
  }, [onChange]);

  const setMode = useCallback((newMode: ConditionMode) => {
    setModeState(newMode);
    if (newMode === 'always') {
      const condition: Condition = { kind: 'AlwaysTrue' };
      lastEmittedRef.current = condition;
      onChange(condition);
    } else {
      emit(root);
    }
  }, [onChange, emit, root]);

  const setGroupOperator = useCallback((groupId: string, operator: GroupOperator) => {
    emit(mapTree(root, groupId, (n) => (n.type === 'group' ? { ...n, operator } : n)) as BuilderGroupNode);
  }, [root, emit]);

  const toggleNegated = useCallback((nodeId: string) => {
    emit(mapTree(root, nodeId, (n) => ({ ...n, negated: !n.negated })) as BuilderGroupNode);
  }, [root, emit]);

  const updateComparison = useCallback((nodeId: string, updates: Partial<Omit<BuilderComparisonNode, 'id' | 'type'>>) => {
    emit(mapTree(root, nodeId, (n) => (n.type === 'comparison' ? { ...n, ...updates } : n)) as BuilderGroupNode);
  }, [root, emit]);

  const updateExpression = useCallback((nodeId: string, expression: string) => {
    emit(mapTree(root, nodeId, (n) => (n.type === 'expression' ? { ...n, expression } : n)) as BuilderGroupNode);
  }, [root, emit]);

  const addComparison = useCallback((groupId: string) => {
    emit(mapTree(root, groupId, (n) => (n.type === 'group' ? { ...n, children: [...n.children, newComparisonNode()] } : n)) as BuilderGroupNode);
  }, [root, emit]);

  const addExpression = useCallback((groupId: string) => {
    emit(mapTree(root, groupId, (n) => (n.type === 'group' ? { ...n, children: [...n.children, newExpressionNode()] } : n)) as BuilderGroupNode);
  }, [root, emit]);

  const addGroup = useCallback((groupId: string) => {
    emit(mapTree(root, groupId, (n) => (
      n.type === 'group'
        ? { ...n, children: [...n.children, newGroupNode(n.operator === 'and' ? 'or' : 'and')] }
        : n
    )) as BuilderGroupNode);
  }, [root, emit]);

  const wrapGroupChildren = useCallback((groupId: string) => {
    emit(mapTree(root, groupId, (n) => {
      if (n.type !== 'group' || n.children.length === 0) return n;
      const inner: BuilderGroupNode = {
        id: crypto.randomUUID(),
        type: 'group',
        negated: false,
        operator: n.operator,
        children: n.children,
      };
      return { ...n, children: [inner] };
    }) as BuilderGroupNode);
  }, [root, emit]);

  const removeNode = useCallback((nodeId: string) => {
    const result = removeFromTree(root, nodeId) as BuilderGroupNode;
    if (result.children.length === 0) {
      setModeState('always');
      setRoot(newGroupNode('and'));
      const condition: Condition = { kind: 'AlwaysTrue' };
      lastEmittedRef.current = condition;
      onChange(condition);
      return;
    }
    emit(result);
  }, [root, emit, onChange]);

  return {
    mode,
    setMode,
    root,
    fieldOptions,
    operatorOptions: OPERATOR_OPTIONS,
    eventFields,
    pathRoot,
    stepOutputFields,
    workflowVariables,
    inputRoot,
    getLookupValueOptions,
    setGroupOperator,
    toggleNegated,
    updateComparison,
    updateExpression,
    addComparison,
    addExpression,
    addGroup,
    wrapGroupChildren,
    removeNode,
    focusedNodeId,
    toggleCollapsed,
    isCollapsed,
    getNodeSummary,
  };
};
