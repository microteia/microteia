import type { WorkflowStep } from '../entities/Workflow';

/**
 * A travessia da árvore de passos de uma automação, num lugar só.
 *
 * Um passo não mora necessariamente na raiz de `steps`: `Condition` guarda dois ramos, `Loop`
 * guarda um corpo e `Switch` guarda N caminhos mais o "senão", e os dois são sequências de passos como qualquer outra. Quem varre a automação
 * PRECISA descer, e quem esquece de descer não falha — apenas deixa de enxergar, o que é a forma
 * mais cara de errar neste repositório.
 *
 * Foi o que aconteceu: `workflowOutRefs` varria só a raiz, e uma chamada a script pendurada dentro
 * de um laço não virava referência. O pacote validava limpo, instalava, e só falava na primeira
 * execução, como `step.script.not-found` num log — longe de quem escreveu o pacote. Ao lado, no
 * mesmo diretório, `workflowIntegrity` já tinha a recursão certa numa função privada; foi a
 * existência de duas cópias que deixou a terceira sem nenhuma.
 *
 * Daí este módulo. Percurso novo sobre passos usa uma destas duas funções — nunca um `for` sobre
 * `workflow.steps`, que é justamente o que compila e não desce.
 */
export const flattenSteps = (steps: readonly WorkflowStep[] | undefined): WorkflowStep[] =>
  (steps ?? []).flatMap((step) => [
    step,
    ...flattenSteps(step.branches?.whenTrue),
    ...flattenSteps(step.branches?.whenFalse),
    ...flattenSteps(step.loop?.body),
    ...(step.switch?.cases ?? []).flatMap((one) => flattenSteps(one.steps)),
    ...flattenSteps(step.switch?.otherwise),
  ]);

/**
 * Aplica `fn` a cada passo preservando a forma da árvore. A transformação vem ANTES da descida, para
 * que um `fn` que troque a configuração de um nó de controle não perca os filhos já reescritos.
 */
export const mapSteps = (
  steps: readonly WorkflowStep[] | undefined,
  fn: (step: WorkflowStep) => WorkflowStep,
): WorkflowStep[] => (steps ?? []).map((step) => {
  let next = fn(step);
  if (next.branches) {
    next = {
      ...next,
      branches: {
        whenTrue: mapSteps(next.branches.whenTrue, fn),
        whenFalse: mapSteps(next.branches.whenFalse, fn),
      },
    };
  }
  if (next.loop) {
    next = { ...next, loop: { ...next.loop, body: mapSteps(next.loop.body, fn) } };
  }
  if (next.switch) {
    next = {
      ...next,
      switch: {
        cases: next.switch.cases.map((one) => ({ ...one, steps: mapSteps(one.steps, fn) })),
        otherwise: mapSteps(next.switch.otherwise, fn),
      },
    };
  }
  return next;
});
