import type { WorkflowStep } from '../entities/Workflow';
import { ACTION_RETURN_KEYS } from '../entities/Action';
import type { MapStepConfig } from './mapSpec';
import type { WorkflowStepMetadata } from './workflowStepCatalog';
import { CORE_STEP_CATALOG } from './workflowStepCatalog';
import { EXIT_STEP_DEFINITION_ID, workflowChildLists } from './workflowReturn';

/**
 * O fluxo de um BOTÃO responde em todos os caminhos?
 *
 * O botão lê as saídas do último passo executado e procura `result`, `status` ou `actions`. Sem
 * nenhuma das três, o fluxo roda inteiro — grava, notifica, audita — e o botão diz que nada voltou.
 * O contrato estava só na ajuda do editor de ações, e um pacote inteiro podia ser escrito, conferido
 * e instalado sem que ninguém o lesse.
 *
 * `returningStepsOf` responde outra pergunta — quais passos PODEM dar o retorno, para o editor unir as
 * formas — e por isso aproxima: com um `exit` num ramo, ela deixa de olhar o fim normal do fluxo. Aqui
 * cada caminho é seguido como o `WorkflowExecutor` o percorre: o ramo que converge, o corpo do laço
 * que encerra, o `exit` que mantém como retorno o passo de antes — e o `exit` sem passo antes, que
 * devolve vazio.
 *
 * O veredito de um passo sai do CATÁLOGO, não de uma lista nossa: as saídas estáticas, ou a forma
 * dinâmica que ele declara. O que só a execução sabe — script, fluxo chamado, passo de extensão —
 * fica `unknown` e não vira aviso: dizer "não responde" sobre o que não se sabe ensinaria o autor a
 * ignorar o relatório.
 */

export type ReturnEnding =
  | { kind: 'returns' }
  | { kind: 'unknown' }
  /** Termina sem nenhuma das três chaves. `stepId` nulo: o caminho não executou passo nenhum. */
  | { kind: 'silent'; stepId: string | null; stepDefinitionId?: string };

export interface ActionReturnGap {
  stepId: string | null;
  stepDefinitionId?: string;
}

interface PathState {
  ending: ReturnEnding;
  halted: boolean;
}

const NOTHING_RAN: ReturnEnding = { kind: 'silent', stepId: null };

/** O corpo de laço que encerra antes de qualquer passo devolve o que vinha de antes do laço. */
const ranNothing = (ending: ReturnEnding): boolean => ending.kind === 'silent' && ending.stepId === null;

const answersButton = (keys: readonly string[]): boolean =>
  keys.some((key) => (ACTION_RETURN_KEYS as readonly string[]).includes(key));

const literalOf = (step: WorkflowStep, inputId: string): unknown => {
  const mapping = step.configuration?.[inputId];
  return mapping?.kind === 'Literal' ? mapping.value : undefined;
};

/** As chaves que o passo publica, ou `null` quando só a execução sabe. */
const publishedKeys = (step: WorkflowStep, meta: WorkflowStepMetadata): string[] | null => {
  const dynamic = meta.dynamicOutputs;
  if (dynamic === undefined) return meta.outputDefinitions.map((output) => output.id);

  if (dynamic.kind === 'from-map-config') {
    const config = literalOf(step, dynamic.sourceInputId) as MapStepConfig | undefined;
    if (!config || typeof config !== 'object' || !Array.isArray(config.fields)) return null;
    const name = config.name?.trim();
    return name ? [name] : config.fields.map((field) => field?.name?.trim() ?? '').filter(Boolean);
  }
  if (dynamic.kind === 'from-input-field') {
    const inputs = Array.isArray(dynamic.sourceInputId) ? dynamic.sourceInputId : [dynamic.sourceInputId];
    const names = inputs.map((inputId) => literalOf(step, inputId));
    return names.every((name): name is string => typeof name === 'string') ? names.map((name) => name.trim()) : null;
  }
  return null;
};

const endingOf = (step: WorkflowStep, catalog: readonly WorkflowStepMetadata[]): ReturnEnding => {
  const meta = catalog.find((entry) => entry.id === step.stepDefinitionId);
  if (meta === undefined) return { kind: 'unknown' };
  const keys = publishedKeys(step, meta);
  if (keys === null) return { kind: 'unknown' };
  return answersButton(keys)
    ? { kind: 'returns' }
    : { kind: 'silent', stepId: step.id, stepDefinitionId: step.stepDefinitionId };
};

const keyOf = (state: PathState): string =>
  `${state.halted ? 'h' : 'l'}:${state.ending.kind}:${state.ending.kind === 'silent' ? state.ending.stepId ?? '' : ''}`;

const distinct = (states: PathState[]): PathState[] => {
  const seen = new Map<string, PathState>();
  for (const state of states) if (!seen.has(keyOf(state))) seen.set(keyOf(state), state);
  return [...seen.values()];
};

const ordered = (steps: readonly WorkflowStep[]): WorkflowStep[] =>
  steps.filter((step) => step.enabled).sort((a, b) => a.order - b.order);

const traverse = (
  steps: readonly WorkflowStep[],
  incoming: PathState[],
  catalog: readonly WorkflowStepMetadata[],
): PathState[] => {
  let states = incoming;
  for (const step of ordered(steps)) {
    const live = states.filter((state) => !state.halted);
    if (live.length === 0) break;
    const halted = states.filter((state) => state.halted);

    let next: PathState[];
    if (step.type === 'Condition' || step.type === 'Switch') {
      next = workflowChildLists(step).flatMap((child) => traverse(child.steps, live, catalog));
    } else if (step.type === 'Parallel') {
      // Os ramos rodam TODOS: um encerramento em qualquer um encerra a automação depois da junção. Sem
      // ele, a saída do nó são os ramos (`branches`), que não respondem a um botão.
      const inside = (step.parallel?.branches ?? []).flatMap((branch) =>
        traverse(branch.steps, [{ ending: NOTHING_RAN, halted: false }], catalog));
      const stoppedInside = inside
        .filter((state) => state.halted)
        .flatMap((state) => (ranNothing(state.ending)
          ? live.map((before) => ({ ending: before.ending, halted: true }))
          : [state]));
      next = [{ ending: { kind: 'silent', stepId: step.id, stepDefinitionId: step.type }, halted: false }, ...stoppedInside];
    } else if (step.type === 'Loop') {
      const body = traverse(step.loop?.body ?? [], [{ ending: NOTHING_RAN, halted: false }], catalog);
      const stoppedInside = body
        .filter((state) => state.halted)
        .flatMap((state) => (ranNothing(state.ending)
          ? live.map((before) => ({ ending: before.ending, halted: true }))
          : [state]));
      const loopKeys = [step.loop?.outputName ?? ''];
      const afterLoop: ReturnEnding = answersButton(loopKeys)
        ? { kind: 'returns' }
        : { kind: 'silent', stepId: step.id, stepDefinitionId: step.type };
      next = [{ ending: afterLoop, halted: false }, ...stoppedInside];
    } else if (step.stepDefinitionId === EXIT_STEP_DEFINITION_ID) {
      next = live.map((state) => ({ ending: state.ending, halted: true }));
    } else {
      next = [{ ending: endingOf(step, catalog), halted: false }];
    }
    states = distinct([...halted, ...next]);
  }
  return states;
};

/** Como cada caminho do fluxo termina, sem repetição. */
export const workflowReturnEndings = (
  steps: readonly WorkflowStep[],
  catalog: readonly WorkflowStepMetadata[] = CORE_STEP_CATALOG,
): ReturnEnding[] => {
  const endings = traverse(steps, [{ ending: NOTHING_RAN, halted: false }], catalog).map((state) => state.ending);
  return distinct(endings.map((ending) => ({ ending, halted: false }))).map((state) => state.ending);
};

/**
 * Os caminhos que terminam sem responder ao botão: o passo que fecha cada um, ou `stepId` nulo para o
 * caminho em que nenhum passo rodou. Vazio quando todo caminho responde — ou quando o que falta saber
 * só a execução diz.
 */
export const actionReturnGaps = (
  steps: readonly WorkflowStep[],
  catalog: readonly WorkflowStepMetadata[] = CORE_STEP_CATALOG,
): ActionReturnGap[] =>
  workflowReturnEndings(steps, catalog).flatMap((ending): ActionReturnGap[] =>
    (ending.kind === 'silent'
      ? [{
        stepId: ending.stepId,
        ...(ending.stepDefinitionId === undefined ? {} : { stepDefinitionId: ending.stepDefinitionId }),
      }]
      : []));
