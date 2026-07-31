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
import { screenEventPrefix, templateCollection } from './screenModule';

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

/**
 * O gatilho de um workflow é uma referência a uma TELA — por isso entra aqui. Mas o nome do evento
 * não é a chave dela: quem declara `eventPrefix` (ou descreve outra coleção) emite por um nome
 * próprio. A tela é achada pelo que cada uma EMITE (`screenEventPrefix`), e a referência aponta a
 * chave dela; supor que prefixo e chave são a mesma palavra acusaria uma tela inexistente.
 *
 * Prefixo que nenhuma tela do pacote emite e que não é do kernel continua virando referência pelo
 * próprio nome: é o caso legítimo de uma automação que dispara com algo que o pacote não leva.
 */
export const workflowOutRefs = (
  workflow: WorkflowModuleTemplate,
  screens: ScreenModuleTemplate[] = [],
): PackageRef[] => {
  const refs: PackageRef[] = [];
  const from = `automação "${workflow.name}"`;

  for (const step of workflow.steps ?? []) {
    const scriptId = stepLiteral(step, SCRIPT_ID_INPUT);
    if (scriptId) refs.push({ kind: 'script', id: scriptId, from });
    const targetWorkflowId = stepLiteral(step, TARGET_WORKFLOW_ID_INPUT);
    if (targetWorkflowId) refs.push({ kind: 'workflow', id: targetWorkflowId, from });
  }
  const event = splitEntityEventName(workflow.eventName);
  if (event) {
    const emitter = screens.find((screen) => screenEventPrefix(screen) === event.prefix);
    if (emitter) refs.push({ kind: 'screen', id: emitter.key, from });
    else if (!isCoreCollection(event.prefix) && !getEntityByEventPrefix(event.prefix)) {
      refs.push({ kind: 'screen', id: event.prefix, from });
    }
  }
  return refs;
};

export const packageOutRefs = (pkg: MarketplacePlugin): PackageRef[] => [
  ...(pkg.screens ?? []).flatMap(screenOutRefs),
  ...(pkg.screenPatches ?? []).flatMap(screenPatchOutRefs),
  ...(pkg.actions ?? []).flatMap(actionOutRefs),
  ...pkg.workflows.flatMap((workflow) => workflowOutRefs(workflow, pkg.screens ?? [])),
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
 * O prefixo de eventos é um nome GLOBAL, como a coleção: quem escuta `case.saved` não sabe — nem
 * pode saber — qual extensão publica. Daí as três checagens:
 *
 * - **Nome que o motor não lê.** `lookup`, `workflow` e os eventos de filho (`person_note`) são
 *   dele; uma tela que emitisse por esses nomes nunca teria o gatilho resolvido.
 * - **Prefixo que já é do kernel.** Uma tela `medico` declarando `person` faria toda gravação de
 *   médico disparar as automações de Pessoa do escritório. Declarar o prefixo da PRÓPRIA coleção
 *   fixa é o oposto: é a continuidade que deixa uma entidade sair do kernel sem renomear eventos.
 * - **Duas telas, um nome.** Só é colisão quando as coleções são diferentes — duas telas sobre a
 *   MESMA coleção emitindo o mesmo evento é o esperado, há um só fluxo de dados ali.
 */
const eventPrefixIssues = (screens: ScreenModuleTemplate[]): PackageValidationIssue[] => {
  const issues: PackageValidationIssue[] = [];
  const collectionByPrefix = new Map<string, string>();

  for (const screen of screens) {
    const prefix = screenEventPrefix(screen);
    const collection = templateCollection(screen);
    const ref: PackageRef = { kind: 'screen', id: screen.key, from: `tela "${screen.key}"` };

    if (!splitEntityEventName(`${prefix}.saved`)) {
      issues.push({
        ref,
        message: `a tela "${screen.key}" emitiria "${prefix}.saved", um nome reservado pelo motor de automações — declare outro \`eventPrefix\`.`,
      });
    }

    const kernelEntity = getEntityByEventPrefix(prefix);
    if (kernelEntity && kernelEntity.collection !== collection) {
      issues.push({
        ref,
        message: `a tela "${screen.key}" declara o prefixo "${prefix}", que é de ${kernelEntity.labelPlural} — as automações de ${kernelEntity.labelPlural} passariam a disparar com "${collection}".`,
      });
    }

    const taken = collectionByPrefix.get(prefix);
    if (taken && taken !== collection) {
      issues.push({
        ref,
        message: `a tela "${screen.key}" emitiria "${prefix}.saved", nome que "${taken}" já usa neste pacote — duas coleções não podem publicar o mesmo evento.`,
      });
    }
    collectionByPrefix.set(prefix, collection);
  }
  return issues;
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
    ...eventPrefixIssues(pkg.screens ?? []),
    ...packageOutRefs(pkg)
      .filter((ref) => !bundled(ref) && !coveredByDependency(ref))
      .map((ref) => ({
        ref,
        message: `${ref.from} referencia ${kindLabel[ref.kind]} "${ref.id}", que não está no pacote nem coberta por uma dependência declarada.`,
      })),
  ];
};
