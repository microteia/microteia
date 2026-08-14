import { useMemo, useCallback, useState } from 'react';
import type { Condition, FieldComparisonCondition, WorkflowParameter } from '../../../../domain/entities/Workflow';
import { useSchemaContext } from '../../../shared/useSchemaContext';
import {
  conditionOperatorKey,
  EVENT_FIELD_PATH_PREFIX,
  buildConditionEventFields,
  createDefaultComparisonCondition,
  createDefaultExpressionCondition,
} from '../../../shared/conditionHelpers';
import { useT } from '../../../shared/i18n/useT';

export type ConditionPath = number[];

export interface ConditionDiagramProps {
  condition: Condition;
  eventName: string;
  parameters?: WorkflowParameter[];
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
  const { condition, eventName, parameters, onChange, onRequestEdit } = props;
  const schemaContext = useSchemaContext();
  const t = useT('core.ui');

  const fieldLabelByPath = useMemo(() => {
    const eventFields = buildConditionEventFields(eventName, schemaContext, parameters);
    const map = new Map<string, string>();
    eventFields.forEach((field) => {
      map.set(field.path, field.label);
      map.set(`${EVENT_FIELD_PATH_PREFIX}${field.path}`, field.label);
    });
    return map;
  }, [eventName, schemaContext, parameters]);

  const getFieldLabel = useCallback(
    (fieldPath: string) => fieldLabelByPath.get(fieldPath) ?? fieldPath,
    [fieldLabelByPath],
  );

  const getOperatorLabel = useCallback(
    (operator: FieldComparisonCondition['operator']) => t(conditionOperatorKey(operator)),
    [t],
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
