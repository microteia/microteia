import { canonicalJson } from '../schema/contentFingerprint';
import { versionContentOf } from '../schema/workflowVersion';
import type { WorkflowStep } from '../entities/Workflow';

/** O passo como a tela o nomeia: o tipo e, no passo do catálogo, qual. */
export type DiffStepRef = { stepId: string; type: string; stepDefinitionId: string };

/**
 * Uma diferença entre duas versões, como DADO — quem a mostra traduz. As chaves de um passo alterado são
 * as do passo (`condition`, `onError`) e as da configuração (`configuration.<entrada>`).
 */
export type ArtifactVersionChange =
  | { kind: 'field'; key: string }
  | { kind: 'code'; key: string; added: number; removed: number }
  | ({ kind: 'step-added' | 'step-removed' | 'step-moved' } & DiffStepRef)
  | ({ kind: 'step-changed'; keys: string[] } & DiffStepRef);

/** Derivado do código-fonte: mudou junto com ele, e listá-lo seria contar a mesma mudança duas vezes. */
const DERIVED_KEYS: ReadonlySet<string> = new Set(['compiledJs']);
/** Texto que se compara por LINHA, e não por igualdade: "mudou" não diz nada sobre um código inteiro. */
const CODE_KEYS: ReadonlySet<string> = new Set(['sourceTs']);

const same = (left: unknown, right: unknown): boolean => canonicalJson(left ?? null) === canonicalJson(right ?? null);

/** Linhas acrescentadas e retiradas, por contagem: sem alinhar trechos, mas sem errar o tamanho da mudança. */
const lineChanges = (before: unknown, after: unknown): { added: number; removed: number } => {
  const count = (text: unknown) => {
    const lines = new Map<string, number>();
    for (const line of String(text ?? '').split('\n')) lines.set(line, (lines.get(line) ?? 0) + 1);
    return lines;
  };
  const old = count(before);
  const now = count(after);
  let added = 0;
  let removed = 0;
  for (const [line, times] of now) added += Math.max(0, times - (old.get(line) ?? 0));
  for (const [line, times] of old) removed += Math.max(0, times - (now.get(line) ?? 0));
  return { added, removed };
};

interface PlacedStep {
  step: WorkflowStep;
  /** Onde o passo está: o nó pai e o ramo (`whenTrue`, `body`, `case:0`…); a raiz é ''. */
  parent: string;
  index: number;
}

/** Cada passo da árvore com o lugar dele — os filhos de um nó são os ramos, o corpo e os casos. */
const placeSteps = (steps: readonly WorkflowStep[] | undefined, parent = '', into = new Map<string, PlacedStep>()) => {
  [...(steps ?? [])].sort((a, b) => a.order - b.order).forEach((step, index) => {
    into.set(step.id, { step, parent, index });
    placeSteps(step.branches?.whenTrue, `${step.id}:whenTrue`, into);
    placeSteps(step.branches?.whenFalse, `${step.id}:whenFalse`, into);
    placeSteps(step.loop?.body, `${step.id}:body`, into);
    (step.switch?.cases ?? []).forEach((one, at) => placeSteps(one.steps, `${step.id}:case:${at}`, into));
    placeSteps(step.switch?.otherwise, `${step.id}:otherwise`, into);
    (step.parallel?.branches ?? []).forEach((one) => placeSteps(one.steps, `${step.id}:lane:${one.id}`, into));
  });
  return into;
};

/** O que é do PRÓPRIO passo: sem os filhos (cada um se compara sozinho) e sem a ordem (mover é outra mudança). */
const ownPart = (step: WorkflowStep): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...step };
  delete rest.branches;
  delete rest.order;
  return {
    ...rest,
    ...(step.loop ? { loop: { ...step.loop, body: undefined } } : {}),
    ...(step.switch ? { switch: { cases: step.switch.cases.map((one) => ({ ...one, steps: undefined })) } } : {}),
    ...(step.parallel ? { parallel: { branches: step.parallel.branches.map((one) => ({ ...one, steps: undefined })) } } : {}),
  };
};

const changedKeys = (before: WorkflowStep, after: WorkflowStep): string[] => {
  const left = ownPart(before);
  const right = ownPart(after);
  const keys: string[] = [];
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    if (key === 'configuration') {
      const oldConfig = before.configuration ?? {};
      const newConfig = after.configuration ?? {};
      for (const input of [...new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)])].sort()) {
        if (!same(oldConfig[input], newConfig[input])) keys.push(`configuration.${input}`);
      }
    } else if (!same(left[key], right[key])) {
      keys.push(key);
    }
  }
  return keys;
};

const refOf = (step: WorkflowStep): DiffStepRef => ({ stepId: step.id, type: step.type, stepDefinitionId: step.stepDefinitionId });

/** O passo mudou de lugar: outro pai, ou outra posição entre os irmãos que existem nas duas versões. */
const movedSteps = (before: Map<string, PlacedStep>, after: Map<string, PlacedStep>): Set<string> => {
  const moved = new Set<string>();
  // Só os irmãos que estão sob o MESMO pai nas duas versões: o que entrou, saiu ou foi para outro ramo não
  // pode empurrar a posição dos que ficaram.
  const siblings = (placed: Map<string, PlacedStep>, parent: string) =>
    [...placed.values()]
      .filter((one) => one.parent === parent
        && before.get(one.step.id)?.parent === parent
        && after.get(one.step.id)?.parent === parent)
      .sort((a, b) => a.index - b.index)
      .map((one) => one.step.id);
  for (const [id, now] of after) {
    const old = before.get(id);
    if (!old) continue;
    if (old.parent !== now.parent) { moved.add(id); continue; }
    if (siblings(before, old.parent).indexOf(id) !== siblings(after, now.parent).indexOf(id)) moved.add(id);
  }
  return moved;
};

/**
 * O que mudou de `before` para `after` — duas versões de uma automação ou de um script, pelas chaves de
 * conteúdo do artefato (`ARTIFACT_VERSION_CONTENT_KEYS`). Os passos são comparados um a um pelo id, em
 * qualquer nível da árvore: o que entrou, o que saiu, o que mudou de lugar e o que mudou de configuração.
 */
export const diffArtifactVersions = (
  keys: readonly string[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ArtifactVersionChange[] => {
  const left = versionContentOf(keys, before);
  const right = versionContentOf(keys, after);
  const changes: ArtifactVersionChange[] = [];

  for (const key of keys) {
    if (key === 'steps' || DERIVED_KEYS.has(key) || same(left[key], right[key])) continue;
    changes.push(CODE_KEYS.has(key) ? { kind: 'code', key, ...lineChanges(left[key], right[key]) } : { kind: 'field', key });
  }

  if (keys.includes('steps')) {
    const oldSteps = placeSteps(left.steps as WorkflowStep[] | undefined);
    const newSteps = placeSteps(right.steps as WorkflowStep[] | undefined);
    const moved = movedSteps(oldSteps, newSteps);
    for (const [id, { step }] of newSteps) {
      const old = oldSteps.get(id);
      if (!old) { changes.push({ kind: 'step-added', ...refOf(step) }); continue; }
      const stepKeys = changedKeys(old.step, step);
      if (stepKeys.length > 0) changes.push({ kind: 'step-changed', ...refOf(step), keys: stepKeys });
      if (moved.has(id)) changes.push({ kind: 'step-moved', ...refOf(step) });
    }
    for (const [id, { step }] of oldSteps) {
      if (!newSteps.has(id)) changes.push({ kind: 'step-removed', ...refOf(step) });
    }
  }
  return changes;
};
