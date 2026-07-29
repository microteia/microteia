import type {
  ActionModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
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

  return packageOutRefs(pkg)
    .filter((ref) => !bundled(ref) && !coveredByDependency(ref))
    .map((ref) => ({
      ref,
      message: `${ref.from} referencia ${kindLabel[ref.kind]} "${ref.id}", que não está no pacote nem coberta por uma dependência declarada.`,
    }));
};
