import type { WorkflowStep } from "../entities/Workflow";

/**
 * Achata a árvore de Steps (incluindo os ramos whenTrue/whenFalse de nós StepCondition e o corpo
 * de nós Loop) numa lista única. Usado por rotinas que precisam varrer todos os Steps
 * independentemente da profundidade — ex: coletar Scripts/SubWorkflows referenciados ao copiar um
 * workflow público, ou coletar os ids de um corpo de Loop para isolamento entre iterações.
 */
export const flattenSteps = (steps: WorkflowStep[]): WorkflowStep[] => {
  const out: WorkflowStep[] = [];
  for (const step of steps) {
    out.push(step);
    if (step.type === "Condition" && step.branches) {
      out.push(...flattenSteps(step.branches.whenTrue));
      out.push(...flattenSteps(step.branches.whenFalse));
    }
    if (step.type === "Loop" && step.loop) {
      out.push(...flattenSteps(step.loop.body));
    }
    if (step.type === "Switch" && step.switch) {
      for (const one of step.switch.cases) out.push(...flattenSteps(one.steps));
      out.push(...flattenSteps(step.switch.otherwise));
    }
  }
  return out;
};

/**
 * Aplica `fn` a cada Step da árvore, preservando a estrutura de ramos/corpo. Para nós StepCondition,
 * `fn` é aplicada ao próprio nó e depois a transformação recorre nos dois ramos; para nós Loop,
 * recorre no corpo.
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
    if (mapped.type === "Loop" && mapped.loop) {
      return {
        ...mapped,
        loop: { ...mapped.loop, body: mapStepTree(mapped.loop.body, fn) },
      };
    }
    if (mapped.type === "Switch" && mapped.switch) {
      return {
        ...mapped,
        switch: {
          cases: mapped.switch.cases.map((one) => ({ ...one, steps: mapStepTree(one.steps, fn) })),
          otherwise: mapStepTree(mapped.switch.otherwise, fn),
        },
      };
    }
    return mapped;
  });
