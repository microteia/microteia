import type {
  ActionModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  ScreenPatchTemplate,
  WorkflowModuleTemplate,
} from '../../entities/MarketplacePlugin';
import type { InputMapping, WorkflowStep } from '../../entities/Workflow';
import { getEntityByCollection, getEntityByEventPrefix } from '../../schema/entityRegistry';
import { splitEntityEventName } from '../../schema/eventCatalog';
import { isLookupCollection } from '../../schema/lookupRegistry';

export type RefKind = 'screen' | 'action' | 'workflow' | 'script';

export interface PackageRef {
  kind: RefKind;
  /** `key` de template (screen) ou `templateId` (action/workflow/script). */
  id: string;
  /** De onde a referência partiu, para a mensagem de diagnóstico. */
  from: string;
}

/** Ids de input de Step que guardam referências a outros artefatos (Literal com o id). */
export const SCRIPT_ID_INPUT = 'scriptId';
export const TARGET_WORKFLOW_ID_INPUT = 'targetWorkflowId';

export const isCoreCollection = (name: string): boolean =>
  getEntityByCollection(name) !== undefined || isLookupCollection(name);

const literalValue = (mapping: InputMapping | undefined): string | null =>
  mapping && mapping.kind === 'Literal' && typeof mapping.value === 'string' && mapping.value.trim() !== ''
    ? mapping.value
    : null;

const stepLiteral = (step: WorkflowStep, inputId: string): string | null =>
  literalValue(step.configuration?.[inputId]);

export const screenOutRefs = (screen: ScreenModuleTemplate): PackageRef[] => {
  const refs: PackageRef[] = [];
  const from = `tela "${screen.key}"`;

  for (const actionId of [...(screen.viewActionIds ?? []), ...(screen.cardActionIds ?? [])]) {
    refs.push({ kind: 'action', id: actionId, from });
  }

  const screenTargets = [
    screen.parentEntity,
    ...screen.fields.map((f) => f.refEntity),
    ...screen.fields.map((f) => f.aggregation?.from),
  ].filter((value): value is string => Boolean(value));

  for (const target of screenTargets) {
    if (!isCoreCollection(target)) refs.push({ kind: 'screen', id: target, from });
  }
  return refs;
};

/**
 * As referências de saída dos CAMPOS de um complemento. O alvo não entra aqui: ele não é uma
 * referência a artefato do pacote, e sim o ponto de acoplamento — conferido por `patchTargetIssue`.
 */
export const screenPatchOutRefs = (patch: ScreenPatchTemplate): PackageRef[] => {
  const from = `complemento de "${patch.target}"`;
  const refs: PackageRef[] = [];

  const targets = [
    ...patch.fields.map((field) => field.refEntity),
    ...patch.fields.map((field) => field.aggregation?.from),
  ].filter((value): value is string => Boolean(value));

  for (const target of targets) {
    if (!isCoreCollection(target)) refs.push({ kind: 'screen', id: target, from });
  }
  return refs;
};

export const actionOutRefs = (action: ActionModuleTemplate): PackageRef[] =>
  action.workflowId ? [{ kind: 'workflow', id: action.workflowId, from: `ação "${action.key}"` }] : [];

export const workflowOutRefs = (workflow: WorkflowModuleTemplate): PackageRef[] => {
  const refs: PackageRef[] = [];
  const from = `automação "${workflow.name}"`;

  for (const step of workflow.steps ?? []) {
    const scriptId = stepLiteral(step, SCRIPT_ID_INPUT);
    if (scriptId) refs.push({ kind: 'script', id: scriptId, from });
    const targetWorkflowId = stepLiteral(step, TARGET_WORKFLOW_ID_INPUT);
    if (targetWorkflowId) refs.push({ kind: 'workflow', id: targetWorkflowId, from });
  }
  const event = splitEntityEventName(workflow.eventName);
  if (event && !isCoreCollection(event.collection) && !getEntityByEventPrefix(event.collection)) {
    refs.push({ kind: 'screen', id: event.collection, from });
  }
  return refs;
};

export const packageOutRefs = (pkg: MarketplacePlugin): PackageRef[] => [
  ...(pkg.screens ?? []).flatMap(screenOutRefs),
  ...(pkg.screenPatches ?? []).flatMap(screenPatchOutRefs),
  ...(pkg.actions ?? []).flatMap(actionOutRefs),
  ...pkg.workflows.flatMap(workflowOutRefs),
];

export interface PackageValidationIssue {
  ref: PackageRef;
  message: string;
}

const slug = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

/**
 * O alvo de um complemento precisa ser universal — igual em todo escritório. Por nome, só coleção
 * fixa do core (`persons`): a chave de uma tela do tenant de destino não é conhecida no pacote, e a
 * de uma tela do próprio pacote seria ambígua (os campos pertencem à tela, e não a um complemento).
 * Para estender a tela de OUTRA extensão, o alvo é o `sourceId` universal dela, que não dá para
 * conferir aqui — se ela não estiver instalada, o complemento simplesmente não se aplica.
 */
const patchTargetIssue = (
  patch: ScreenPatchTemplate,
  screenKeys: ReadonlySet<string>,
  screenSourceIds: ReadonlySet<string>,
): PackageValidationIssue | undefined => {
  const ref: PackageRef = { kind: 'screen', id: patch.target, from: `complemento de "${patch.target}"` };
  const ownScreen = (patch.targetKind ?? 'collection') === 'sourceId'
    ? screenSourceIds.has(patch.target)
    : screenKeys.has(patch.target);
  if (ownScreen) {
    return {
      ref,
      message: `o complemento aponta para "${patch.target}", que é uma tela do próprio pacote — declare os campos na tela, não num complemento.`,
    };
  }
  if ((patch.targetKind ?? 'collection') === 'sourceId') return undefined;
  if (!isCoreCollection(patch.target)) {
    return {
      ref,
      message: `o complemento aponta para "${patch.target}", que não é uma coleção fixa do sistema — para estender a tela de outra extensão, use o \`sourceId\` dela.`,
    };
  }
  return undefined;
};

/**
 * Valida a integridade referencial de um pacote — a MESMA checagem no export (dry-run) e no import.
 * Toda referência de saída precisa estar: (1) incluída no pacote, (2) numa coleção fixa do core, ou
 * (3) coberta por uma dependência declarada (chave namespaced `<slug-do-plugin>__x` de uma
 * `dependencies`). O que sobrar é uma referência pendente — no export, o autor inclui o artefato ou
 * declara a dependência; no import, a instalação é recusada.
 */
export const validatePackage = (pkg: MarketplacePlugin): PackageValidationIssue[] => {
  const screenKeys = new Set((pkg.screens ?? []).map((s) => s.key));
  const actionIds = new Set((pkg.actions ?? []).map((a) => a.templateId));
  const workflowIds = new Set(pkg.workflows.map((w) => w.templateId));
  const scriptIds = new Set((pkg.scripts ?? []).map((s) => s.templateId));
  const dependencySlugs = Object.keys(pkg.manifest.dependencies ?? {}).map(slug);

  const coveredByDependency = (ref: PackageRef): boolean =>
    ref.kind === 'screen' && dependencySlugs.some((depSlug) => ref.id.startsWith(`${depSlug}__`));

  const bundled = (ref: PackageRef): boolean => {
    switch (ref.kind) {
      case 'screen': return screenKeys.has(ref.id);
      case 'action': return actionIds.has(ref.id);
      case 'workflow': return workflowIds.has(ref.id);
      case 'script': return scriptIds.has(ref.id);
    }
  };

  const kindLabel: Record<RefKind, string> = {
    screen: 'a tela',
    action: 'a ação',
    workflow: 'a automação',
    script: 'o script',
  };

  const screenSourceIds = new Set((pkg.screens ?? []).map((s) => s.sourceId ?? s.key));
  const targetIssues = (pkg.screenPatches ?? [])
    .map((patch) => patchTargetIssue(patch, screenKeys, screenSourceIds))
    .filter((issue): issue is PackageValidationIssue => issue !== undefined);

  return [
    ...targetIssues,
    ...packageOutRefs(pkg)
      .filter((ref) => !bundled(ref) && !coveredByDependency(ref))
      .map((ref) => ({
        ref,
        message: `${ref.from} referencia ${kindLabel[ref.kind]} "${ref.id}", que não está no pacote nem coberta por uma dependência declarada.`,
      })),
  ];
};
