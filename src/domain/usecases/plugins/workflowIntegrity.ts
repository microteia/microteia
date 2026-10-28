import type { MarketplacePlugin, WorkflowModuleTemplate } from '../../entities/MarketplacePlugin';
import type { InputMapping, WorkflowStep } from '../../entities/Workflow';
import { flattenSteps } from '../../services/stepTree';
import {
  CONTROL_STEP_TYPES,
  UNIMPLEMENTED_STEP_TYPES,
  type InputDefinition,
  type WorkflowStepMetadata,
  coreStepMetadata,
  isCoreStepDefinitionId,
  isPausingStepDefinition,
  isStepExcludedFromTrigger,
  PORTAL_DOCUMENT_SHARING_SINCE_KERNEL,
  PORTAL_INVITE_STEP_ID,
  PORTAL_REVOKE_STEP_ID,
  SHARE_DOCUMENTS_STEP_ID,
} from '../../schema/workflowStepCatalog';
import {
  PORTAL_AUTOMATION_INVITES_SINCE_KERNEL,
  PORTAL_TRACK_VIEWS_SINCE_KERNEL,
  acceptsAutomationInvites,
  asPortalDeclaration,
} from '../../schema/portal';
import { PORTAL_IDENTITY_CLAIM_SINCE_KERNEL } from '../../schema/portalIdentity';
import { UPSERT_MATCH_PRIMARY_KEY_SINCE_KERNEL, type UpsertStepConfig } from '../../schema/mutationSpec';

/** As entradas que fazem do convite um convite por identidade — qualquer uma delas exige o kernel novo. */
const PORTAL_IDENTITY_CLAIM_INPUTS = ['requiredClaimName', 'requiredClaimValue', 'requiredClaimNormalize'] as const;
import {
  CHILD_RECORD_EVENTS_SINCE_KERNEL,
  PORTAL_VIEWED_ACTION,
  splitChildRecordEventName,
  splitEntityEventName,
} from '../../schema/eventCatalog';
import { WORKFLOW_AUDIT_EVENT, WORKFLOW_AUDIT_SINCE_KERNEL } from '../../schema/workflowAuditTrigger';
import type { PackageRef, PackageValidationIssue } from './pluginReferences';
import {
  WORKFLOW_SCHEDULE_EVENT,
  WORKFLOW_DATE_REACHED_SINCE_KERNEL,
  WORKFLOW_DELAY_SINCE_KERNEL,
  WORKFLOW_SCHEDULE_SINCE_KERNEL,
  dateReachedIssues,
  dateReachedPrefix,
  scheduleIssues,
} from '../../schema/workflowClock';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import { screenEventPrefix } from './screenModule';
import { RENDER_DOCUMENT_STEP_ID, declaredDocumentTemplates, renderDocumentStepIssues, renderDocumentTemplateKey } from './documentStepIntegrity';

/**
 * A integridade de um passo de automação.
 *
 * Até aqui a validação de pacote conferia as referências de um workflow — o script que ele chama, o
 * workflow que ele chama, a tela do `eventName` — e nada do PASSO. O efeito era o pior que este
 * repositório combate em outros lugares: o pacote validava, instalava, e o fluxo não rodava. Um
 * `stepDefinitionId` com erro de digitação só aparecia no log do motor, com o fluxo em execução, como
 * "StepDefinition desconhecida".
 *
 * A lista de defeitos a pegar não foi inventada aqui: ela está escrita no comentário de
 * `scripts/declarativeWorkflow.test.ts`, que já dizia quais erros compilam e não falham até alguém
 * executar o fluxo. Este arquivo é aquela lista virando reprovação.
 *
 * Todas as checagens são de FALSO-POSITIVO ZERO — uma validação que reprova pacote legítimo é pior
 * que a ausência dela, porque ensina o autor a ignorar o veredito.
 */

const MAPPING_KINDS = ['Literal', 'Event', 'Expression', 'Output', 'Variable'];

const isControl = (step: WorkflowStep): boolean => CONTROL_STEP_TYPES.includes(step.type);

const isMapping = (value: unknown): value is InputMapping =>
  typeof value === 'object'
  && value !== null
  && typeof (value as { kind?: unknown }).kind === 'string'
  && MAPPING_KINDS.includes((value as { kind: string }).kind);

/**
 * Um input dinâmico não está em `inputs`: ele nasce do alvo escolhido em design-time. `call-workflow`
 * e `script` os recebem como `param.<chave>`, e reprovar essas chaves reprovaria todo passo que passa
 * argumento — que é o uso normal dos dois. Aqui só o prefixo é conferido; o `render-document` tem as
 * chaves conferidas contra o modelo, quando ele se enxerga (`documentStepIntegrity.ts`).
 */
const acceptsDynamicKey = (metadata: WorkflowStepMetadata, key: string): boolean =>
  metadata.dynamicInputs !== undefined && key.startsWith('param.');

const literalString = (mapping: InputMapping): string | undefined =>
  mapping.kind === 'Literal' && typeof mapping.value === 'string' ? mapping.value : undefined;

const inputIssues = (
  step: WorkflowStep,
  metadata: WorkflowStepMetadata,
  ref: PackageRef,
): PackageValidationIssue[] => {
  const issues: PackageValidationIssue[] = [];
  const configuration = step.configuration ?? {};
  const byId = new Map<string, InputDefinition>(metadata.inputs.map((input) => [input.id, input]));

  for (const [key, raw] of Object.entries(configuration)) {
    const input = byId.get(key);
    if (input === undefined) {
      if (!acceptsDynamicKey(metadata, key)) {
        issues.push({
          ref,
          message: '@core.marketplace/issue.step.unknown-input',
          messageParams: {
            step: step.id,
            definition: metadata.id,
            input: key,
            expected: metadata.inputs.map((one) => one.id).join(', '),
          },
        });
      }
      continue;
    }

    if (!isMapping(raw)) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.input-not-mapping',
        messageParams: { step: step.id, definition: metadata.id, input: key },
      });
      continue;
    }

    const allowed = input.allowedMappingKinds;
    if (allowed !== undefined && !allowed.includes(raw.kind)) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.mapping-kind',
        messageParams: {
          step: step.id,
          definition: metadata.id,
          input: key,
          kind: raw.kind,
          allowed: allowed.join(', '),
        },
      });
      continue;
    }

    // O `validator` e o `pattern` só respondem sobre um literal de texto — é o único caso em que o
    // valor final já é conhecido no pacote. Para os outros quatro `kind`, o valor nasce em runtime.
    const value = literalString(raw);
    if (value !== undefined) {
      const failed = input.validator?.(value);
      if (failed !== undefined) {
        issues.push({
          ref,
          message: '@core.marketplace/issue.step.input-invalid',
          messageParams: { step: step.id, definition: metadata.id, input: key, reason: failed },
        });
      } else if (input.pattern !== undefined && !new RegExp(input.pattern).test(value)) {
        issues.push({
          ref,
          message: '@core.marketplace/issue.step.input-invalid',
          messageParams: {
            step: step.id,
            definition: metadata.id,
            input: key,
            reason: input.patternMessage ?? input.pattern,
          },
        });
      }
    }
  }

  for (const input of metadata.inputs) {
    if (!input.required) continue;
    if (input.defaultValue !== undefined) continue;
    if (configuration[input.id] !== undefined) continue;
    issues.push({
      ref,
      message: '@core.marketplace/issue.step.missing-input',
      messageParams: { step: step.id, definition: metadata.id, input: input.id },
    });
  }

  return issues;
};

/**
 * `{ kind: 'Output', stepId, outputId }` é a única forma de mapping que aponta para OUTRO passo, e por
 * isso a única que pode ficar pendurada. A checagem é de EXISTÊNCIA, não de ordem: com ramos e
 * repetição, "antes" é uma pergunta de runtime, e responder mal a ela reprovaria fluxo válido.
 */
const outputRefIssues = (
  steps: readonly WorkflowStep[],
  ref: PackageRef,
): PackageValidationIssue[] => {
  const issues: PackageValidationIssue[] = [];
  const byStepId = new Map(steps.map((step) => [step.id, step]));

  for (const step of steps) {
    for (const [key, raw] of Object.entries(step.configuration ?? {})) {
      if (!isMapping(raw) || raw.kind !== 'Output') continue;

      const target = byStepId.get(raw.stepId);
      if (target === undefined) {
        issues.push({
          ref,
          message: '@core.marketplace/issue.step.output-unknown-step',
          messageParams: { step: step.id, input: key, target: raw.stepId },
        });
        continue;
      }

      // Um passo de saídas dinâmicas publica nomes que só existem em runtime — `query` acrescenta
      // `first.<projeção>`, `set-variable` publica o nome que o próprio input escolheu. Aí não há o
      // que conferir, e afirmar o contrário seria reprovar o uso correto.
      if (!isCoreStepDefinitionId(target.stepDefinitionId)) continue;
      const metadata = coreStepMetadata(target.stepDefinitionId);
      if (metadata.dynamicOutputs !== undefined) continue;

      if (!metadata.outputDefinitions.some((output) => output.id === raw.outputId)) {
        issues.push({
          ref,
          message: '@core.marketplace/issue.step.output-unknown-id',
          messageParams: {
            step: step.id,
            input: key,
            target: raw.stepId,
            output: raw.outputId,
            expected: metadata.outputDefinitions.map((one) => one.id).join(', ') || '—',
          },
        });
      }
    }
  }

  return issues;
};

const stepIssues = (
  step: WorkflowStep,
  ref: PackageRef,
  hasDependencies: boolean,
): PackageValidationIssue[] => {
  if (UNIMPLEMENTED_STEP_TYPES.includes(step.type)) {
    return [{
      ref,
      message: '@core.marketplace/issue.step.type-unimplemented',
      messageParams: { step: step.id, type: step.type },
    }];
  }

  if (isControl(step)) {
    if (step.type === 'Condition' && step.condition === undefined) {
      return [{
        ref,
        message: '@core.marketplace/issue.step.control-incomplete',
        messageParams: { step: step.id, type: step.type, missing: 'condition' },
      }];
    }
    if (step.type === 'Loop' && step.loop === undefined) {
      return [{
        ref,
        message: '@core.marketplace/issue.step.control-incomplete',
        messageParams: { step: step.id, type: step.type, missing: 'loop' },
      }];
    }
    return [];
  }

  if (!step.stepDefinitionId?.trim()) {
    return [{
      ref,
      message: '@core.marketplace/issue.step.no-definition',
      messageParams: { step: step.id, type: step.type },
    }];
  }

  if (!isCoreStepDefinitionId(step.stepDefinitionId)) {
    // Um passo pode vir de uma extensão que contribui para `workflow.step`, e daqui não há como
    // resolvê-la. Mas isso exige a `dependency` declarada: sem nenhuma, um id que o kernel não
    // conhece só pode ser erro de digitação — e é justamente o defeito mais comum.
    return hasDependencies ? [] : [{
      ref,
      message: '@core.marketplace/issue.step.unknown-definition',
      messageParams: { step: step.id, definition: step.stepDefinitionId },
    }];
  }

  return inputIssues(step, coreStepMetadata(step.stepDefinitionId), ref);
};

const workflowIssues = (
  workflow: WorkflowModuleTemplate,
  hasDependencies: boolean,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  const ref: PackageRef = {
    kind: 'workflow',
    id: workflow.templateId,
    from: { origin: '@core.marketplace/ref.origin.workflow', name: workflow.name },
  };
  const steps = flattenSteps(workflow.steps);

  return [
    ...triggerIssues(workflow, ref, pkg),
    ...auditTriggerIssues(workflow, ref, pkg),
    ...childEventKernelIssues(workflow, ref, pkg),
    ...portalViewedIssues(workflow, ref, pkg),
    ...portalSharingKernelIssues(steps, ref, pkg),
    ...portalAccessIssues(steps, ref, pkg),
    ...upsertMatchKernelIssues(steps, ref, pkg),
    ...excludedStepIssues(workflow, steps, ref),
    ...delayIssues(workflow, steps, ref, pkg),
    ...steps.flatMap((step) => stepIssues(step, ref, hasDependencies)),
    ...outputRefIssues(steps, ref),
    ...documentStepIssues(steps, ref, pkg),
  ];
};

/** O evento de nota ou documento num pacote que admite um kernel em que ele não existe para toda tela. */
const childEventKernelIssues = (
  workflow: WorkflowModuleTemplate,
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] =>
  !splitChildRecordEventName(workflow.eventName) || rangeExcludesBelow(pkg.manifest?.kernel ?? '', CHILD_RECORD_EVENTS_SINCE_KERNEL)
    ? []
    : [{
        ref,
        message: '@core.marketplace/issue.workflow.trigger-kernel',
        messageParams: { event: workflow.eventName, minimum: CHILD_RECORD_EVENTS_SINCE_KERNEL },
      }];

/**
 * O gatilho `<prefixo>.portalViewed` que nunca dispara: num kernel anterior ao evento, ou sobre uma tela
 * do PRÓPRIO pacote que não registra as aberturas (`portal.trackViews`). A tela de uma dependência ou do
 * escritório não é conferida daqui — a declaração dela não viaja neste pacote.
 */
const portalViewedIssues = (
  workflow: WorkflowModuleTemplate,
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  const event = splitEntityEventName(workflow.eventName);
  if (event?.action !== PORTAL_VIEWED_ACTION) return [];
  const kernel = rangeExcludesBelow(pkg.manifest?.kernel ?? '', PORTAL_TRACK_VIEWS_SINCE_KERNEL)
    ? []
    : [{
        ref,
        message: '@core.marketplace/issue.workflow.trigger-kernel',
        messageParams: { event: workflow.eventName, minimum: PORTAL_TRACK_VIEWS_SINCE_KERNEL },
      }];
  const screen = (pkg.screens ?? []).find((candidate) => screenEventPrefix(candidate) === event.prefix);
  const untracked = screen && asPortalDeclaration(screen.portal)?.trackViews !== true
    ? [{
        ref,
        message: '@core.marketplace/issue.workflow.portal-viewed.untracked',
        messageParams: { event: workflow.eventName, screen: screen.key },
      }]
    : [];
  return [...kernel, ...untracked];
};

/**
 * Compartilhar documento com o portal por automação — o passo `share-documents` e o `portalShared`
 * de `render-document` — num pacote que admite um kernel anterior: o passo reprovaria por ser
 * desconhecido, e a entrada seria ignorada, anexando um documento que o convidado nunca vê.
 */
const portalSharingKernelIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', PORTAL_DOCUMENT_SHARING_SINCE_KERNEL)) return [];
  const minimum = PORTAL_DOCUMENT_SHARING_SINCE_KERNEL;
  return steps.flatMap((step): PackageValidationIssue[] => {
    if (step.stepDefinitionId === SHARE_DOCUMENTS_STEP_ID) {
      return [{ ref, message: '@core.marketplace/issue.step.definition-kernel', messageParams: { step: step.id, definition: SHARE_DOCUMENTS_STEP_ID, minimum } }];
    }
    if (step.stepDefinitionId === RENDER_DOCUMENT_STEP_ID && step.configuration?.portalShared !== undefined) {
      return [{ ref, message: '@core.marketplace/issue.step.input-kernel', messageParams: { step: step.id, input: 'portalShared', minimum } }];
    }
    return [];
  });
};

/**
 * O `upsert` que endereça pela chave `primary`, num pacote que admite kernel anterior: lá a opção é
 * ignorada em silêncio, e a segunda execução do fluxo é recusada como duplicata em vez de alterar.
 */
const upsertMatchKernelIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', UPSERT_MATCH_PRIMARY_KEY_SINCE_KERNEL)) return [];
  return steps.flatMap((step): PackageValidationIssue[] => {
    const config = step.stepDefinitionId === 'upsert' ? step.configuration?.upsert : undefined;
    if (config?.kind !== 'Literal') return [];
    const value = config.value as Partial<UpsertStepConfig> | null | undefined;
    if (value?.matchPrimaryKey !== true) return [];
    return [{
      ref,
      message: '@core.marketplace/issue.step.input-kernel',
      messageParams: { step: step.id, input: 'upsert.matchPrimaryKey', minimum: UPSERT_MATCH_PRIMARY_KEY_SINCE_KERNEL },
    }];
  });
};

/**
 * Os passos de acesso ao portal. Num pacote que admite kernel anterior, o passo reprovaria por ser
 * desconhecido. E o convite para uma tela DO PRÓPRIO pacote que não declara `portal.invites` reprovaria
 * em toda execução: é o defeito que só o empacotamento enxerga a tempo — a tela de uma dependência, ou
 * do escritório, não está aqui para ser lida.
 */
const portalAccessIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  const kernelCovered = rangeExcludesBelow(pkg.manifest?.kernel ?? '', PORTAL_AUTOMATION_INVITES_SINCE_KERNEL);
  return steps.flatMap((step): PackageValidationIssue[] => {
    const definition = step.stepDefinitionId;
    if (definition !== PORTAL_INVITE_STEP_ID && definition !== PORTAL_REVOKE_STEP_ID) return [];
    const issues: PackageValidationIssue[] = kernelCovered ? [] : [{
      ref,
      message: '@core.marketplace/issue.step.definition-kernel',
      messageParams: { step: step.id, definition, minimum: PORTAL_AUTOMATION_INVITES_SINCE_KERNEL },
    }];
    const claimed = definition === PORTAL_INVITE_STEP_ID
      && PORTAL_IDENTITY_CLAIM_INPUTS.some((input) => step.configuration?.[input] !== undefined);
    if (claimed && !rangeExcludesBelow(pkg.manifest?.kernel ?? '', PORTAL_IDENTITY_CLAIM_SINCE_KERNEL)) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.input-kernel',
        messageParams: { step: step.id, input: 'requiredClaimName', minimum: PORTAL_IDENTITY_CLAIM_SINCE_KERNEL },
      });
    }
    const collection = step.configuration?.subjectCollection;
    if (definition !== PORTAL_INVITE_STEP_ID || collection?.kind !== 'Literal' || typeof collection.value !== 'string') return issues;
    const screen = (pkg.screens ?? []).find((candidate) => (candidate.dataCollection ?? candidate.key) === collection.value);
    if (!screen) return issues;
    const subject = {
      id: screen.key,
      collection: collection.value,
      fields: screen.fields,
      portal: asPortalDeclaration(screen.portal),
    };
    return acceptsAutomationInvites(subject) ? issues : [...issues, {
      ref,
      message: '@core.marketplace/issue.step.portal-invite.closed',
      messageParams: { step: step.id, screen: screen.key },
    }];
  });
};

/**
 * O passo que gera um modelo DO PRÓPRIO pacote, conferido contra ele. O modelo de uma dependência ou
 * do escritório não está aqui para ser lido — quem o enxerga são as ferramentas de autoria
 * (`documentSteps.ts` do SDK), e lá a ausência é dita, não recusada.
 */
const documentStepIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  const own = new Map(declaredDocumentTemplates(pkg.manifest?.contributes).map((template) => [template.key, template]));
  return steps.flatMap((step) => {
    const key = renderDocumentTemplateKey(step);
    const template = key === null ? undefined : own.get(key);
    return template === undefined ? [] : renderDocumentStepIssues(step, template, ref);
  });
};

/**
 * O passo do kernel que o catálogo declara incompatível com o gatilho do fluxo (`excludedTriggers`). O
 * de extensão fica de fora pela mesma razão de `stepIssues`: a metadata dele não está aqui para ser lida.
 */
const excludedStepIssues = (
  workflow: WorkflowModuleTemplate,
  steps: WorkflowStep[],
  ref: PackageRef,
): PackageValidationIssue[] =>
  steps
    .filter((step) => isCoreStepDefinitionId(step.stepDefinitionId ?? ''))
    .filter((step) => isStepExcludedFromTrigger(coreStepMetadata(step.stepDefinitionId ?? ''), workflow.eventName))
    .map((step) => ({
      ref,
      message: '@core.marketplace/issue.step.excluded-trigger',
      messageParams: { step: step.id, definition: step.stepDefinitionId ?? '', event: workflow.eventName },
    }));

/** O gatilho de auditoria num pacote que admite um kernel anterior a ele: instalaria e nunca dispararia. */
const auditTriggerIssues = (
  workflow: WorkflowModuleTemplate,
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] =>
  workflow.eventName !== WORKFLOW_AUDIT_EVENT || rangeExcludesBelow(pkg.manifest?.kernel ?? '', WORKFLOW_AUDIT_SINCE_KERNEL)
    ? []
    : [{
        ref,
        message: '@core.marketplace/issue.workflow.trigger-kernel',
        messageParams: { event: workflow.eventName, minimum: WORKFLOW_AUDIT_SINCE_KERNEL },
      }];

/**
 * Onde o passo `delay` não pode pausar — e falharia com o fluxo rodando:
 *
 * - dentro de um ramo de condição ou do corpo de uma repetição: só o nível principal retoma;
 * - num fluxo que uma AÇÃO do pacote dispara: o botão espera a resposta, e ninguém espera dias;
 * - num pacote que admite um kernel anterior ao passo.
 */
const delayIssues = (
  workflow: WorkflowModuleTemplate,
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  const delays = steps.filter((step) => isPausingStepDefinition(step.stepDefinitionId));
  if (delays.length === 0) return [];
  const topLevel = new Set(workflow.steps.map((step) => step.id));

  const nested = delays
    .filter((step) => !topLevel.has(step.id))
    .map((step) => ({ ref, message: '@core.marketplace/issue.step.delay-nested', messageParams: { step: step.id } }));

  const action = (pkg.actions ?? []).find((candidate) => candidate.workflowId === workflow.templateId);
  const fromAction = action
    ? [{ ref, message: '@core.marketplace/issue.step.delay-in-action', messageParams: { step: delays[0].id, action: action.key } }]
    : [];

  const kernel = rangeExcludesBelow(pkg.manifest?.kernel ?? '', WORKFLOW_DELAY_SINCE_KERNEL)
    ? []
    : [{ ref, message: '@core.marketplace/issue.step.delay-kernel', messageParams: { step: delays[0].id, minimum: WORKFLOW_DELAY_SINCE_KERNEL } }];

  return [...nested, ...fromAction, ...kernel];
};

/**
 * Os campos de DATA da tela do pacote que emite o prefixo. `null` quando a tela não vem no pacote — a de
 * uma dependência ou do escritório não está aqui para ser lida, e recusar o que não se vê recusaria um
 * pacote certo.
 */
const packageDateFields = (prefix: string, pkg: MarketplacePlugin): string[] | null => {
  const screen = (pkg.screens ?? []).find((candidate) => screenEventPrefix(candidate) === prefix);
  return screen ? screen.fields.filter((field) => field.type === 'date').map((field) => field.key) : null;
};

/**
 * O gatilho temporal que o relógio não consegue rodar. A automação instala, aparece ligada e nunca
 * dispara — o pior tipo de defeito, porque não há execução falhada para alguém ver. E o mesmo vale para
 * um kernel anterior ao relógio, que por isso precisa RECUSAR o pacote, pelo intervalo de `kernel`.
 */
const triggerIssues = (workflow: WorkflowModuleTemplate, ref: PackageRef, pkg: MarketplacePlugin): PackageValidationIssue[] => {
  const prefix = dateReachedPrefix(workflow.eventName);
  if (workflow.eventName !== WORKFLOW_SCHEDULE_EVENT && prefix === null) return [];

  const shape = prefix === null
    ? scheduleIssues(workflow.schedule).map((issue) => ({
        ref,
        message: '@core.marketplace/issue.workflow.schedule-invalid',
        messageParams: { detail: issue.message, ...(issue.messageParams ?? {}) },
      }))
    : dateReachedIssues(workflow.dateReached, packageDateFields(prefix, pkg)).map((issue) => ({
        ref,
        message: '@core.marketplace/issue.workflow.date-reached-invalid',
        messageParams: { detail: issue.message, ...(issue.messageParams ?? {}) },
      }));

  const minimum = prefix === null ? WORKFLOW_SCHEDULE_SINCE_KERNEL : WORKFLOW_DATE_REACHED_SINCE_KERNEL;
  const kernel = rangeExcludesBelow(pkg.manifest?.kernel ?? '', minimum)
    ? []
    : [{
        ref,
        message: '@core.marketplace/issue.workflow.trigger-kernel',
        messageParams: { event: workflow.eventName, minimum },
      }];
  return [...shape, ...kernel];
};

/**
 * Os problemas de passo de todo workflow do pacote. Entra na porta única de validação
 * (`validatePluginPackage`), e por isso vale igual no `check` do terminal, no MCP, na tela de autoria
 * e na instalação.
 */
export const workflowStepIssues = (pkg: MarketplacePlugin): PackageValidationIssue[] => {
  const hasDependencies = Object.keys(pkg.manifest?.dependencies ?? {}).length > 0;
  return (pkg.workflows ?? []).flatMap((workflow) => workflowIssues(workflow, hasDependencies, pkg));
};
