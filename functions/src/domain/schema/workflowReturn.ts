// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowReturn.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { WorkflowStep } from '../entities/Workflow';

/**
 * Quais passos dão o RETORNO de uma automação.
 *
 * Morava em `presentation/shared/workflowHelpers.ts`, onde só o editor o alcançava. O gateway de
 * agente precisa da mesma resposta para dizer o formato da saída de uma automação, e uma segunda
 * cópia no backend divergiria na primeira regra nova do motor — o editor mostraria uma saída e o
 * agente prometeria outra.
 */

export const EXIT_STEP_DEFINITION_ID = 'exit';

const byOrder = (a: WorkflowStep, b: WorkflowStep): number => a.order - b.order;

const orderedEnabledSteps = (steps: WorkflowStep[]): WorkflowStep[] =>
  steps.filter((step) => step.enabled).sort(byOrder);

/**
 * As listas-filhas de um nó de controle: Condition tem duas, Loop tem uma, Switch tem uma por caminho
 * mais o "senão", Parallel uma por ramo, o resto nenhuma.
 */
export const workflowChildLists = (step: WorkflowStep): { key: string; steps: WorkflowStep[] }[] => {
  if (step.type === 'Switch' && step.switch) {
    return [
      ...step.switch.cases.map((one) => ({ key: one.id, steps: one.steps })),
      { key: 'otherwise', steps: step.switch.otherwise },
    ];
  }
  if (step.type === 'Parallel' && step.parallel) {
    return step.parallel.branches.map((one) => ({ key: one.id, steps: one.steps }));
  }
  if (step.type === 'Condition') {
    const branches = step.branches ?? { whenTrue: [], whenFalse: [] };
    return [
      { key: 'whenTrue', steps: branches.whenTrue },
      { key: 'whenFalse', steps: branches.whenFalse },
    ];
  }
  if (step.type === 'Loop' && step.loop) {
    return [{ key: 'body', steps: step.loop.body }];
  }
  return [];
};

// Um nó de condição ou de caminhos não tem saída própria: quem contribui é o último Step do ramo que
// executar. Loop não expande — a saída dele é o vetor publicado sob `loop.outputName` —, e Parallel também
// não: a saída dele é a de cada ramo, sob `branches.<ramo>`.
const terminalStepsOf = (step: WorkflowStep): WorkflowStep[] => {
  if (step.type !== 'Condition' && step.type !== 'Switch') return [step];
  return workflowChildLists(step).flatMap((child) => {
    const ordered = orderedEnabledSteps(child.steps);
    const last = ordered[ordered.length - 1];
    return last ? terminalStepsOf(last) : [];
  });
};

/**
 * Steps cujas saídas podem virar o retorno do workflow — espelha a regra do WorkflowExecutor, que
 * devolve as saídas do último Step executado na travessia. Com "Encerrar Workflow" no fluxo, os
 * candidatos são os Steps imediatamente anteriores a cada encerramento (um por ramo); sem nenhum,
 * é o último Step do nível raiz. Vários candidatos = formas de retorno alternativas conforme o
 * ramo que executar; cabe ao chamador decidir o que fazer com a ambiguidade (o editor une todas).
 */
export const returningStepsOf = (steps: WorkflowStep[]): WorkflowStep[] => {
  const candidates: WorkflowStep[] = [];
  let sawExit = false;

  // `incoming` espelha o `incomingLastStepId` do WorkflowExecutor: dentro de um ramo ou do corpo
  // de um Loop, o "Step anterior" a um encerramento na primeira posição é o último Step executado
  // no nível de cima, não `undefined`.
  const visit = (branch: WorkflowStep[], incoming: WorkflowStep | null): void => {
    let previous = incoming;
    for (const step of orderedEnabledSteps(branch)) {
      if (step.stepDefinitionId === EXIT_STEP_DEFINITION_ID) {
        sawExit = true;
        if (previous) candidates.push(...terminalStepsOf(previous));
        return;
      }
      for (const child of workflowChildLists(step)) visit(child.steps, previous);
      previous = step;
    }
  };

  visit(steps, null);
  // Um encerramento sem Step anterior devolve vazio em runtime — não é caso de fallback.
  if (sawExit) return candidates;

  const root = orderedEnabledSteps(steps);
  const last = root[root.length - 1];
  return last ? terminalStepsOf(last) : [];
};
