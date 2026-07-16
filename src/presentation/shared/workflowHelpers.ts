import type { Condition, WorkflowStep } from '../../domain/entities/Workflow';
import type { StepDefinitionSummary } from '../../domain/entities/WorkflowStepCatalog';
import { CONDITION_OPERATOR_LABELS, EVENT_FIELD_PATH_PREFIX } from './conditionHelpers';

/**
 * Retorna o nome de exibição de um step, com prioridade:
 * 1. signature (nome customizado fornecido pelo usuário)
 * 2. name (nome padrão do step definition)
 * 3. fallback (ex: stepDefinitionId)
 */
export const getStepDisplayName = (
  step: WorkflowStep,
  definition?: StepDefinitionSummary,
  fallback?: string,
): string => {
  if (step.signature) return step.signature;
  if (step.name) return step.name;
  if (definition?.name) return definition.name;
  if (step.type === 'Condition') return 'Condição';
  return fallback ?? step.stepDefinitionId;
};

// ─────────────────────────────────────────────────────────────────────────────
// Árvore de Steps (StepCondition ramifica em branches.whenTrue / branches.whenFalse)
// Um Step do tipo 'Condition' é um nó de controle: não produz output próprio e carrega
// dois ramos, cada um uma sequência recursiva de Steps. As funções abaixo tratam a lista
// de Steps como uma árvore imutável, preservando a ordenação por `order` em cada nível.
// ─────────────────────────────────────────────────────────────────────────────

export type BranchKey = 'whenTrue' | 'whenFalse';

export type InsertTarget =
  | { kind: 'root' }
  | { kind: 'branch'; conditionId: string; branch: BranchKey };

export const isConditionStep = (step: WorkflowStep): boolean => step.type === 'Condition';

const byOrder = (a: WorkflowStep, b: WorkflowStep): number => a.order - b.order;

// Atribui `order` pela posição atual no array (NÃO reordena — o chamador já arranjou a lista).
const reindex = (list: WorkflowStep[]): WorkflowStep[] =>
  list.map((step, index) => ({ ...step, order: index }));

// Ordena por `order` e então reindexa por posição. Para inserção/remoção, onde a lista deve
// preservar a ordem lógica existente antes de reatribuir os índices.
const sortAndReindex = (list: WorkflowStep[]): WorkflowStep[] => reindex([...list].sort(byOrder));

const branchesOf = (step: WorkflowStep): WorkflowStep['branches'] =>
  step.type === 'Condition' ? step.branches ?? { whenTrue: [], whenFalse: [] } : undefined;

/** Achata a árvore inteira numa lista (ordem de pré-percurso). Útil para lookups por id. */
export const flattenSteps = (steps: WorkflowStep[]): WorkflowStep[] => {
  const out: WorkflowStep[] = [];
  const walk = (list: WorkflowStep[]): void => {
    for (const step of [...list].sort(byOrder)) {
      out.push(step);
      const branches = branchesOf(step);
      if (branches) {
        walk(branches.whenTrue);
        walk(branches.whenFalse);
      }
    }
  };
  walk(steps);
  return out;
};

/** Localiza um Step em qualquer profundidade da árvore. */
export const findStepInTree = (steps: WorkflowStep[], id: string): WorkflowStep | null => {
  for (const step of steps) {
    if (step.id === id) return step;
    const branches = branchesOf(step);
    if (branches) {
      const found = findStepInTree(branches.whenTrue, id) ?? findStepInTree(branches.whenFalse, id);
      if (found) return found;
    }
  }
  return null;
};

/** Aplica `fn` ao Step com o id dado, em qualquer profundidade, retornando nova árvore. */
export const updateStepInTree = (
  steps: WorkflowStep[],
  id: string,
  fn: (step: WorkflowStep) => WorkflowStep,
): WorkflowStep[] =>
  steps.map((step) => {
    if (step.id === id) return fn(step);
    const branches = branchesOf(step);
    if (branches) {
      return {
        ...step,
        branches: {
          whenTrue: updateStepInTree(branches.whenTrue, id, fn),
          whenFalse: updateStepInTree(branches.whenFalse, id, fn),
        },
      };
    }
    return step;
  });

/** Remove o Step com o id dado (e seus ramos, se for uma Condição) e reindexa os irmãos. */
export const removeStepFromTree = (steps: WorkflowStep[], id: string): WorkflowStep[] => {
  const filtered = steps.filter((step) => step.id !== id);
  const mapped = filtered.map((step) => {
    const branches = branchesOf(step);
    if (branches) {
      return {
        ...step,
        branches: {
          whenTrue: removeStepFromTree(branches.whenTrue, id),
          whenFalse: removeStepFromTree(branches.whenFalse, id),
        },
      };
    }
    return step;
  });
  return filtered.length !== steps.length ? sortAndReindex(mapped) : mapped;
};

/** Insere um Step no fim do alvo (raiz ou um ramo específico de uma Condição). */
export const insertStepInto = (
  steps: WorkflowStep[],
  target: InsertTarget,
  step: WorkflowStep,
): WorkflowStep[] => {
  if (target.kind === 'root') {
    return reindex([...[...steps].sort(byOrder), step]);
  }
  return steps.map((current) => {
    if (current.id === target.conditionId && current.type === 'Condition') {
      const branches = current.branches ?? { whenTrue: [], whenFalse: [] };
      return {
        ...current,
        branches: { ...branches, [target.branch]: reindex([...[...branches[target.branch]].sort(byOrder), step]) },
      };
    }
    const branches = branchesOf(current);
    if (branches) {
      return {
        ...current,
        branches: {
          whenTrue: insertStepInto(branches.whenTrue, target, step),
          whenFalse: insertStepInto(branches.whenFalse, target, step),
        },
      };
    }
    return current;
  });
};

/** Substitui um Step existente pelo objeto dado (mesmo id), preservando sua posição. */
export const replaceStepInTree = (steps: WorkflowStep[], step: WorkflowStep): WorkflowStep[] =>
  updateStepInTree(steps, step.id, (existing) => ({ ...step, order: existing.order }));

/** Move um Step uma posição para cima/baixo dentro dos próprios irmãos (mesmo ramo). */
export const moveStepWithinSiblings = (
  steps: WorkflowStep[],
  id: string,
  direction: 'up' | 'down',
): WorkflowStep[] => {
  if (steps.some((s) => s.id === id)) {
    const sorted = [...steps].sort(byOrder);
    const position = sorted.findIndex((s) => s.id === id);
    const swapWith = direction === 'up' ? position - 1 : position + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return steps;
    const next = [...sorted];
    [next[position], next[swapWith]] = [next[swapWith], next[position]];
    return reindex(next);
  }
  return steps.map((step) => {
    const branches = branchesOf(step);
    if (branches) {
      return {
        ...step,
        branches: {
          whenTrue: moveStepWithinSiblings(branches.whenTrue, id, direction),
          whenFalse: moveStepWithinSiblings(branches.whenFalse, id, direction),
        },
      };
    }
    return step;
  });
};

/**
 * Reordena os irmãos de um ramo movendo `id` para `toIndex` (drag & drop dentro do mesmo
 * nível). Só reordena no nível onde o id realmente está.
 */
export const reorderSiblings = (
  steps: WorkflowStep[],
  id: string,
  toIndex: number,
): WorkflowStep[] => {
  if (steps.some((s) => s.id === id)) {
    const sorted = [...steps].sort(byOrder);
    const fromIndex = sorted.findIndex((s) => s.id === id);
    // toIndex é o índice do "gap" alvo; ao remover o item, os gaps após ele deslocam-se.
    const adjusted = fromIndex < toIndex ? toIndex - 1 : toIndex;
    if (adjusted === fromIndex) return steps;
    const next = [...sorted];
    const [moved] = next.splice(fromIndex, 1);
    const clamped = Math.max(0, Math.min(adjusted, next.length));
    next.splice(clamped, 0, moved);
    return reindex(next);
  }
  return steps.map((step) => {
    const branches = branchesOf(step);
    if (branches) {
      return {
        ...step,
        branches: {
          whenTrue: reorderSiblings(branches.whenTrue, id, toIndex),
          whenFalse: reorderSiblings(branches.whenFalse, id, toIndex),
        },
      };
    }
    return step;
  });
};

/**
 * Steps que podem produzir outputs disponíveis para um Step-alvo já existente na árvore.
 * Regra (segura): do alvo até a raiz, coleta os irmãos anteriores em cada nível (e os irmãos
 * anteriores a cada Condição ancestral), na ordem de execução. Exclui o outro ramo de cada
 * ancestral e os próprios nós de Condição (que não produzem output).
 */
export const collectPriorSteps = (rootSteps: WorkflowStep[], targetId: string): WorkflowStep[] => {
  const result: WorkflowStep[] = [];
  const walk = (list: WorkflowStep[]): boolean => {
    const ordered = [...list].sort(byOrder);
    const precedingHere: WorkflowStep[] = [];
    for (const step of ordered) {
      if (step.id === targetId) {
        result.unshift(...precedingHere);
        return true;
      }
      const branches = branchesOf(step);
      if (branches && (walk(branches.whenTrue) || walk(branches.whenFalse))) {
        result.unshift(...precedingHere);
        return true;
      }
      if (step.type !== 'Condition') precedingHere.push(step);
    }
    return false;
  };
  walk(rootSteps);
  return result;
};

/** Igual a collectPriorSteps, mas para um Step ainda não inserido, dado o alvo de inserção. */
export const collectPriorStepsForInsert = (
  rootSteps: WorkflowStep[],
  target: InsertTarget,
): WorkflowStep[] => {
  if (target.kind === 'root') {
    return [...rootSteps].filter((s) => s.type !== 'Condition').sort(byOrder);
  }
  const condition = findStepInTree(rootSteps, target.conditionId);
  const branchSteps = (condition?.branches?.[target.branch] ?? []).filter((s) => s.type !== 'Condition');
  return [...collectPriorSteps(rootSteps, target.conditionId), ...[...branchSteps].sort(byOrder)];
};

/** Resumo de uma linha de uma Condição, para exibir dentro do nó no grafo/lista. */
export const describeCondition = (condition: Condition | undefined): string => {
  if (!condition) return 'Sem condição';
  switch (condition.kind) {
    case 'AlwaysTrue':
      return 'Sempre verdadeiro';
    case 'FieldComparison': {
      const field = condition.fieldPath.replace(EVENT_FIELD_PATH_PREFIX, '') || '(campo)';
      const operator = CONDITION_OPERATOR_LABELS[condition.operator] ?? condition.operator;
      if (condition.operator === 'isEmpty' || condition.operator === 'isNotEmpty') {
        return `${field} ${operator}`;
      }
      return `${field} ${operator} ${String(condition.value ?? '')}`.trim();
    }
    case 'Expression':
      return condition.expression || '(expressão)';
    case 'LogicalAnd':
      return condition.conditions.map(describeCondition).join(' E ') || 'E';
    case 'LogicalOr':
      return condition.conditions.map(describeCondition).join(' OU ') || 'OU';
    case 'Not':
      return `NÃO (${describeCondition(condition.condition)})`;
    default:
      return 'Condição';
  }
};
