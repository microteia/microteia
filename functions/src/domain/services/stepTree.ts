import type { WorkflowStep } from "../entities/Workflow";

/**
 * Achata a árvore de Steps (incluindo os ramos whenTrue/whenFalse de nós StepCondition) numa
 * lista única. Usado por rotinas que precisam varrer todos os Steps independentemente da
 * profundidade — ex: coletar Scripts/SubWorkflows referenciados ao copiar um workflow público.
 */
export const flattenSteps = (steps: WorkflowStep[]): WorkflowStep[] => {
  const out: WorkflowStep[] = [];
  for (const step of steps) {
    out.push(step);
    if (step.type === "Condition" && step.branches) {
      out.push(...flattenSteps(step.branches.whenTrue));
      out.push(...flattenSteps(step.branches.whenFalse));
    }
  }
  return out;
};

/**
 * Aplica `fn` a cada Step da árvore, preservando a estrutura de ramos. Para nós StepCondition,
 * `fn` é aplicada ao próprio nó e depois a transformação recorre nos dois ramos.
 */
export const mapStepTree = (
  steps: WorkflowStep[],
  fn: (step: WorkflowStep) => WorkflowStep,
): WorkflowStep[] =>
  steps.map((step) => {
    const mapped = fn(step);
    if (mapped.type === "Condition" && mapped.branches) {
      return {
        ...mapped,
        branches: {
          whenTrue: mapStepTree(mapped.branches.whenTrue, fn),
          whenFalse: mapStepTree(mapped.branches.whenFalse, fn),
        },
      };
    }
    return mapped;
  });
