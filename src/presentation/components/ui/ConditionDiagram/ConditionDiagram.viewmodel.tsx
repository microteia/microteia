import { useMemo, useCallback, useState } from 'react';
import type { Condition, FieldComparisonCondition } from '../../../../domain/entities/Workflow';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import {
  CONDITION_OPERATOR_LABELS,
  EVENT_FIELD_PATH_PREFIX,
  buildConditionEventFields,
  createDefaultComparisonCondition,
  createDefaultExpressionCondition,
} from '../../../shared/conditionHelpers';

export type ConditionPath = number[];

export interface ConditionDiagramProps {
  condition: Condition;
  eventName: string;
  screenKey?: string;
  onChange?: (condition: Condition) => void;
  onRequestEdit?: (path: ConditionPath) => void;
}

export interface ConditionDiagramViewModel {
  isInteractive: boolean;
  getFieldLabel: (fieldPath: string) => string;
  getOperatorLabel: (operator: FieldComparisonCondition['operator']) => string;
  toggleGroupOperator: (path: ConditionPath) => void;
  toggleNegated: (path: ConditionPath) => void;
  removeNode: (path: ConditionPath) => void;
  addComparison: (path: ConditionPath | null) => void;
  addExpression: (path: ConditionPath | null) => void;
  addGroup: (path: ConditionPath | null) => void;
  wrapGroupChildren: (path: ConditionPath) => void;
  requestEdit: (path: ConditionPath) => void;
  toggleCollapsed: (path: ConditionPath) => void;
  isCollapsed: (path: ConditionPath) => boolean;
}

const getAtPath = (condition: Condition, path: ConditionPath): Condition | undefined => {
  let current: Condition | undefined = condition;
  for (const index of path) {
    if (!current) return undefined;
    if (current.kind === 'LogicalAnd' || current.kind === 'LogicalOr') {
      current = current.conditions[index];
    } else if (current.kind === 'Not') {
      current = index === 0 ? current.condition : undefined;
    } else {
      return undefined;
    }
  }
  return current;
};

const updateAtPath = (
  condition: Condition,
  path: ConditionPath,
  fn: (node: Condition) => Condition | null,
): Condition | null => {
  if (path.length === 0) return fn(condition);
  const [head, ...rest] = path;
  if (condition.kind === 'LogicalAnd' || condition.kind === 'LogicalOr') {
    const children = condition.conditions
      .map((child, index) => (index === head ? updateAtPath(child, rest, fn) : child))
      .filter((child): child is Condition => child !== null);
    if (children.length === 0) return null;
    return { ...condition, conditions: children };
  }
  if (condition.kind === 'Not') {
    const child = updateAtPath(condition.condition, rest, fn);
    return child === null ? null : { ...condition, condition: child };
  }
  return condition;
};

export const useConditionDiagramViewModel = (props: ConditionDiagramProps): ConditionDiagramViewModel => {
  const { condition, eventName, screenKey, onChange, onRequestEdit } = props;
  const { dynamicScreens } = useScreenDefinitions();

  const fieldLabelByPath = useMemo(() => {
    const eventFields = buildConditionEventFields(eventName, screenKey, dynamicScreens);
    const map = new Map<string, string>();
    eventFields.forEach((field) => {
      map.set(field.path, field.label);
      map.set(`${EVENT_FIELD_PATH_PREFIX}${field.path}`, field.label);
    });
    return map;
  }, [eventName, screenKey, dynamicScreens]);

  const getFieldLabel = useCallback(
    (fieldPath: string) => fieldLabelByPath.get(fieldPath) ?? fieldPath,
    [fieldLabelByPath],
  );

  const getOperatorLabel = useCallback(
    (operator: FieldComparisonCondition['operator']) => CONDITION_OPERATOR_LABELS[operator] ?? operator,
    [],
  );

  const emit = useCallback((next: Condition | null) => {
    onChange?.(next ?? { kind: 'AlwaysTrue' });
  }, [onChange]);

  const toggleGroupOperator = useCallback((path: ConditionPath) => {
    emit(updateAtPath(condition, path, (node) => {
      if (node.kind === 'LogicalAnd') return { ...node, kind: 'LogicalOr' };
      if (node.kind === 'LogicalOr') return { ...node, kind: 'LogicalAnd' };
      return node;
    }));
  }, [condition, emit]);

  const toggleNegated = useCallback((path: ConditionPath) => {
    emit(updateAtPath(condition, path, (node) => (
      node.kind === 'Not' ? node.condition : { kind: 'Not', condition: node }
    )));
  }, [condition, emit]);

  const removeNode = useCallback((path: ConditionPath) => {
    emit(updateAtPath(condition, path, () => null));
  }, [condition, emit]);

  const addChild = useCallback((path: ConditionPath | null, child: Condition) => {
    if (path === null) {
      if (condition.kind === 'AlwaysTrue') {
        emit(child);
      } else if (condition.kind === 'LogicalAnd' || condition.kind === 'LogicalOr') {
        emit({ ...condition, conditions: [...condition.conditions, child] });
      } else {
        emit({ kind: 'LogicalAnd', conditions: [condition, child] });
      }
      return;
    }
    emit(updateAtPath(condition, path, (node) => (
      node.kind === 'LogicalAnd' || node.kind === 'LogicalOr'
        ? { ...node, conditions: [...node.conditions, child] }
        : node
    )));
  }, [condition, emit]);

  const addComparison = useCallback((path: ConditionPath | null) => {
    addChild(path, createDefaultComparisonCondition());
  }, [addChild]);

  const addExpression = useCallback((path: ConditionPath | null) => {
    addChild(path, createDefaultExpressionCondition());
  }, [addChild]);

  const addGroup = useCallback((path: ConditionPath | null) => {
    const target = path === null ? condition : getAtPath(condition, path);
    const parentIsOr = target?.kind === 'LogicalOr';
    addChild(path, {
      kind: parentIsOr ? 'LogicalAnd' : 'LogicalOr',
      conditions: [createDefaultComparisonCondition()],
    });
  }, [condition, addChild]);

  const wrapGroupChildren = useCallback((path: ConditionPath) => {
    emit(updateAtPath(condition, path, (node) => {
      if (node.kind !== 'LogicalAnd' && node.kind !== 'LogicalOr') return node;
      return { ...node, conditions: [{ kind: node.kind, conditions: node.conditions }] };
    }));
  }, [condition, emit]);

  const requestEdit = useCallback((path: ConditionPath) => {
    onRequestEdit?.(path);
  }, [onRequestEdit]);

  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const toggleCollapsed = useCallback((path: ConditionPath) => {
    const key = path.join('.');
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (path: ConditionPath) => collapsedPaths.has(path.join('.')),
    [collapsedPaths],
  );

  return {
    isInteractive: Boolean(onChange),
    getFieldLabel,
    getOperatorLabel,
    toggleGroupOperator,
    toggleNegated,
    removeNode,
    addComparison,
    addExpression,
    addGroup,
    wrapGroupChildren,
    requestEdit,
    toggleCollapsed,
    isCollapsed,
  };
};
