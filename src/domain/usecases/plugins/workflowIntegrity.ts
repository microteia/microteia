import type { MarketplacePlugin, WorkflowModuleTemplate } from '../../entities/MarketplacePlugin';
import type { InputMapping, WorkflowStep } from '../../entities/Workflow';
import { flattenSteps } from '../../services/stepTree';
import { extensionStepsOf, parseExtensionStepId } from '../../schema/workflowStepContribution';
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
import { PORTAL_ROLES_SINCE_KERNEL } from '../../schema/portalRole';
import { UPSERT_MATCH_PRIMARY_KEY_SINCE_KERNEL, type UpsertStepConfig } from '../../schema/mutationSpec';
import { QUERY_PAGE_SINCE_KERNEL, type QuerySpec } from '../../schema/querySpec';
import {
  HTTP_REQUEST_SINCE_KERNEL,
  HTTP_ASYNC_SINCE_KERNEL,
  HTTP_CALLBACK_INPUT,
  HTTP_REQUEST_STEP_ID,
  httpRequestSpecWarnings,
  validateHttpRequestSpec,
} from '../../schema/httpRequestSpec';
import { HTTP_CONNECTION_SINCE_KERNEL } from '../../schema/httpConnection';

/** As entradas que fazem do convite um convite por identidade — qualquer uma delas exige o kernel novo. */
const PORTAL_IDENTITY_CLAIM_INPUTS = ['requiredClaimName', 'requiredClaimValue', 'requiredClaimNormalize'] as const;
import {
  CALLED_WORKFLOW_PATH_TYPES_SINCE_KERNEL,
  CHILD_RECORD_EVENTS_SINCE_KERNEL,
  PORTAL_VIEWED_ACTION,
  WORKFLOW_CALLED_EVENT,
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
import { hasChangeFilter, WORKFLOW_FLOW_CONTROL_SINCE_KERNEL } from '../../schema/workflowChangeFilter';
import { APPROVAL_STEP_ID, WORKFLOW_APPROVAL_PORTAL_SINCE_KERNEL, WORKFLOW_APPROVAL_SINCE_KERNEL } from '../../schema/workflowTask';
import { REPORT_FILE_SINCE_KERNEL, REPORT_SNAPSHOTS_SINCE_KERNEL, RUN_REPORT_STEP_ID, WORKFLOW_RUN_REPORT_SINCE_KERNEL } from '../../schema/report/reportStep';
import { WAIT_FOR_STEP_ID, WORKFLOW_WAIT_FOR_SINCE_KERNEL } from '../../schema/workflowWait';
import { WORKFLOW_PAGED_LOOP_SINCE_KERNEL } from '../../schema/workflowLoopQuery';
import { WORKFLOW_WEBHOOK_EVENT, WORKFLOW_WEBHOOK_SINCE_KERNEL } from '../../schema/workflowWebhook';
import {
  AI_DATA_STEPS_SINCE_KERNEL,
  AI_EXTRACT_FIELDS_SINCE_KERNEL,
  AI_EXTRACT_PARAMETERS_STEP_ID,
  AI_GENERATE_STEP_ID,
} from '../../schema/aiSteps';
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

/** O que um passo de extensão precisa saber do pacote: os passos que ele declara e de quem ele depende. */
interface PackageStepContext {
  ownPluginId: string;
  own: ReadonlySet<string>;
  dependencies: ReadonlySet<string>;
}

const packageStepContext = (pkg: MarketplacePlugin): PackageStepContext => ({
  ownPluginId: pkg.manifest?.id ?? '',
  own: new Set(extensionStepsOf(pkg.manifest?.id ?? '', pkg.manifest?.contributes).map((one) => one.id)),
  dependencies: new Set(Object.keys(pkg.manifest?.dependencies ?? {})),
});

const stepIssues = (
  step: WorkflowStep,
  ref: PackageRef,
  hasDependencies: boolean,
  pkgSteps: PackageStepContext,
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
    if (step.type === 'Switch' && step.switch === undefined) {
      return [{
        ref,
        message: '@core.marketplace/issue.step.control-incomplete',
        messageParams: { step: step.id, type: step.type, missing: 'switch' },
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
    // O passo de EXTENSÃO tem dono no id (`<pluginId>/<chave>`): o do próprio pacote tem de estar entre
    // os que ele declara; o de outra extensão exige ela nas dependências — sem isso a automação instala
    // num escritório que não tem o passo e falha na primeira execução.
    const extension = parseExtensionStepId(step.stepDefinitionId);
    if (extension && extension.pluginId === pkgSteps.ownPluginId) {
      return pkgSteps.own.has(step.stepDefinitionId) ? [] : [{
        ref,
        message: '@core.marketplace/issue.step.unknown-definition',
        messageParams: { step: step.id, definition: step.stepDefinitionId },
      }];
    }
    if (extension) {
      return pkgSteps.dependencies.has(extension.pluginId) ? [] : [{
        ref,
        message: '@core.marketplace/issue.step.extension-dependency',
        messageParams: { step: step.id, definition: step.stepDefinitionId, extension: extension.pluginId },
      }];
    }
    // Sem dono no id, só pode ser erro de digitação — a não ser que o pacote dependa de alguém.
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
    ...webhookTriggerIssues(workflow, ref, pkg),
    ...childEventKernelIssues(workflow, ref, pkg),
    ...portalViewedIssues(workflow, ref, pkg),
    ...portalSharingKernelIssues(steps, ref, pkg),
    ...portalAccessIssues(steps, ref, pkg),
    ...upsertMatchKernelIssues(steps, ref, pkg),
    ...queryPageKernelIssues(steps, ref, pkg),
    ...httpRequestIssues(steps, ref, pkg),
    ...calledPathTypeKernelIssues(workflow, steps, ref, pkg),
    ...excludedStepIssues(workflow, steps, ref),
    ...delayIssues(workflow, steps, ref, pkg),
    ...pagedLoopIssues(workflow, steps, ref, pkg),
    ...flowControlKernelIssues(workflow, steps, ref, pkg),
    ...stepDefinitionKernelIssues(steps, ref, pkg),
    ...extractFieldsKernelIssues(steps, ref, pkg),
    ...reportFileKernelIssues(steps, ref, pkg),
    ...reportSnapshotKernelIssues(steps, ref, pkg),
    ...approvalPortalKernelIssues(steps, ref, pkg),
    ...steps.flatMap((step) => stepIssues(step, ref, hasDependencies, packageStepContext(pkg))),
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

/** As entradas do `notify` cujo caminho do evento vale pelo TIPO — e não só pelo valor que traz. */
const NOTIFY_TYPED_PATH_INPUTS = ['recipientAddresses', 'recipientPhones', 'portalRecord'] as const;

/**
 * O `notify` que, num fluxo chamado, aponta um contato ou o registro do portal por um caminho dos
 * parâmetros, num pacote que admite kernel anterior: lá o caminho é resolvido contra o evento, que não
 * tem campo nenhum, e o passo reprova em toda execução.
 */
const calledPathTypeKernelIssues = (
  workflow: WorkflowModuleTemplate,
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (workflow.eventName !== WORKFLOW_CALLED_EVENT) return [];
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', CALLED_WORKFLOW_PATH_TYPES_SINCE_KERNEL)) return [];
  return steps.flatMap((step) => step.stepDefinitionId !== 'notify'
    ? []
    : NOTIFY_TYPED_PATH_INPUTS
      .filter((input) => step.configuration?.[input]?.kind === 'Event')
      .map((input) => ({
        ref,
        message: '@core.marketplace/issue.step.input-kernel',
        messageParams: { step: step.id, input, minimum: CALLED_WORKFLOW_PATH_TYPES_SINCE_KERNEL },
      })));
};

/**
 * A consulta em páginas, num pacote que admite kernel anterior: lá `page` é ignorado, `cursor` nunca é
 * publicado, e a automação que percorre a coleção relê a primeira página para sempre.
 */
const queryPageKernelIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', QUERY_PAGE_SINCE_KERNEL)) return [];
  return steps.flatMap((step): PackageValidationIssue[] => {
    const config = step.stepDefinitionId === 'query' ? step.configuration?.query : undefined;
    if (config?.kind !== 'Literal') return [];
    const value = config.value as Partial<QuerySpec> | null | undefined;
    if (value?.page === undefined) return [];
    return [{
      ref,
      message: '@core.marketplace/issue.step.input-kernel',
      messageParams: { step: step.id, input: 'query.page', minimum: QUERY_PAGE_SINCE_KERNEL },
    }];
  });
};

/**
 * O passo "Chamar API". Três recusas:
 * - kernel anterior ao passo: lá ele reprovaria em toda execução, por ser desconhecido;
 * - especificação inválida: a mesma `validateHttpRequestSpec` do editor e do motor;
 * - cabeçalho sensível com valor FIXO. No escritório isso é aviso; no pacote é recusa, porque o
 *   segredo deixaria o escritório dentro do arquivo da extensão.
 */
const httpRequestIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  const kernelCovered = rangeExcludesBelow(pkg.manifest?.kernel ?? '', HTTP_REQUEST_SINCE_KERNEL);
  return steps.flatMap((step): PackageValidationIssue[] => {
    if (step.stepDefinitionId !== HTTP_REQUEST_STEP_ID) return [];
    const issues: PackageValidationIssue[] = kernelCovered ? [] : [{
      ref,
      message: '@core.marketplace/issue.step.definition-kernel',
      messageParams: { step: step.id, definition: HTTP_REQUEST_STEP_ID, minimum: HTTP_REQUEST_SINCE_KERNEL },
    }];
    const config = step.configuration?.request;
    if (config?.kind !== 'Literal') {
      return [...issues, { ref, message: '@core.marketplace/issue.step.http-invalid', messageParams: { step: step.id, detail: '@core.automation/step.http.not-configured' } }];
    }
    for (const issue of validateHttpRequestSpec(config.value)) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.http-invalid',
        messageParams: { step: step.id, ...(issue.errorParams ?? {}), detail: issue.error },
      });
    }
    // A credencial pela chave chegou depois do passo: num kernel anterior ela seria ignorada, e a
    // chamada sairia sem o segredo — falhando na API, não no portão.
    const connection = (config.value as { connection?: unknown } | null)?.connection;
    if (connection !== undefined && connection !== '' && !rangeExcludesBelow(pkg.manifest?.kernel ?? '', HTTP_CONNECTION_SINCE_KERNEL)) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.input-kernel',
        messageParams: { step: step.id, input: 'request.connection', minimum: HTTP_CONNECTION_SINCE_KERNEL },
      });
    }
    // O modo assíncrono e o callback chegaram depois: num kernel anterior a especificação seria lida
    // como síncrona — a automação ESPERARIA a resposta, e o callback nunca seria chamado.
    const asyncKernel = rangeExcludesBelow(pkg.manifest?.kernel ?? '', HTTP_ASYNC_SINCE_KERNEL);
    const mode = (config.value as { mode?: unknown } | null)?.mode;
    if (mode === 'async' && !asyncKernel) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.input-kernel',
        messageParams: { step: step.id, input: 'request.mode', minimum: HTTP_ASYNC_SINCE_KERNEL },
      });
    }
    if (step.configuration?.[HTTP_CALLBACK_INPUT] !== undefined && !asyncKernel) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.input-kernel',
        messageParams: { step: step.id, input: HTTP_CALLBACK_INPUT, minimum: HTTP_ASYNC_SINCE_KERNEL },
      });
    }
    for (const warning of httpRequestSpecWarnings(config.value)) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.http-literal-secret',
        messageParams: { step: step.id, name: warning.errorParams?.name ?? '' },
      });
    }
    return issues;
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
    // Um kernel anterior IGNORA o papel: o convidado entra sem ele, e a condição da tela que o pergunta
    // o deixa de fora — ou, no kernel que nem a lê, deixa todos.
    if (definition === PORTAL_INVITE_STEP_ID && step.configuration?.role !== undefined
      && !rangeExcludesBelow(pkg.manifest?.kernel ?? '', PORTAL_ROLES_SINCE_KERNEL)) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.step.input-kernel',
        messageParams: { step: step.id, input: 'role', minimum: PORTAL_ROLES_SINCE_KERNEL },
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
 * O gatilho de webhook num pacote que admite um kernel anterior a ele: a automação instalaria, e a
 * function de entrada que a dispara não existiria.
 */
const webhookTriggerIssues = (
  workflow: WorkflowModuleTemplate,
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] =>
  workflow.eventName !== WORKFLOW_WEBHOOK_EVENT || rangeExcludesBelow(pkg.manifest?.kernel ?? '', WORKFLOW_WEBHOOK_SINCE_KERNEL)
    ? []
    : [{
        ref,
        message: '@core.marketplace/issue.workflow.trigger-kernel',
        messageParams: { event: workflow.eventName, minimum: WORKFLOW_WEBHOOK_SINCE_KERNEL },
      }];

/**
 * O filtro de mudança, o `Switch` e a política de falha num pacote que admite um kernel anterior a eles.
 *
 * Nenhum dos três falha num kernel velho — e esse é o problema: o filtro é ignorado e a automação roda a
 * cada salvamento; a política é ignorada e a falha encerra a execução. Um pacote que os declara precisa
 * dizer o kernel de que depende, para que o velho recuse em vez de rodar outra coisa.
 */
const flowControlKernelIssues = (
  workflow: WorkflowModuleTemplate,
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', WORKFLOW_FLOW_CONTROL_SINCE_KERNEL)) return [];
  const features = [
    ...(hasChangeFilter(workflow) ? ['changeType/changedFields'] : []),
    ...(steps.some((step) => step.type === 'Switch') ? ['Switch'] : []),
    ...(steps.some((step) => step.onError !== undefined) ? ['onError'] : []),
  ];
  return features.map((feature) => ({
    ref,
    message: '@core.marketplace/issue.workflow.feature-kernel',
    messageParams: { feature, minimum: WORKFLOW_FLOW_CONTROL_SINCE_KERNEL },
  }));
};

/**
 * O kernel a partir do qual existe cada passo do catálogo que chegou DEPOIS do pacote mais antigo que
 * ainda instala. Um pacote que admite kernel anterior instalaria um fluxo que reprova no passo — "passo
 * desconhecido" na primeira execução, longe de quem empacotou.
 *
 * Os passos que PAUSAM ficam em `delayIssues`, que já confere o resto do que eles exigem.
 */
const STEP_DEFINITION_SINCE_KERNEL: Readonly<Record<string, string>> = {
  [RUN_REPORT_STEP_ID]: WORKFLOW_RUN_REPORT_SINCE_KERNEL,
  [AI_GENERATE_STEP_ID]: AI_DATA_STEPS_SINCE_KERNEL,
};

/** "Executar relatório" com arquivo num pacote que admite kernel anterior: lá o `file` é ignorado em silêncio. */
const reportFileKernelIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', REPORT_FILE_SINCE_KERNEL)) return [];
  const first = steps.find((step) => step.stepDefinitionId === RUN_REPORT_STEP_ID && step.configuration?.file !== undefined);
  return first
    ? [{ ref, message: '@core.marketplace/issue.step.input-kernel', messageParams: { step: first.id, input: 'file', minimum: REPORT_FILE_SINCE_KERNEL } }]
    : [];
};

/**
 * A aprovação pelo portal ou com quórum num pacote que admite kernel anterior: lá as duas entradas são
 * ignoradas — o convidado nunca seria chamado, e a primeira decisão fecharia o que pedia votos.
 */
const approvalPortalKernelIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', WORKFLOW_APPROVAL_PORTAL_SINCE_KERNEL)) return [];
  return steps.flatMap((step): PackageValidationIssue[] => {
    if (step.stepDefinitionId !== APPROVAL_STEP_ID) return [];
    return (['portalGuests', 'quorum'] as const)
      .filter((input) => step.configuration?.[input] !== undefined)
      .map((input) => ({
        ref,
        message: '@core.marketplace/issue.step.input-kernel',
        messageParams: { step: step.id, input, minimum: WORKFLOW_APPROVAL_PORTAL_SINCE_KERNEL },
      }));
  });
};

/** A foto para a série num pacote que admite kernel anterior: lá o `snapshot` é ignorado, e a série nunca nasce. */
const reportSnapshotKernelIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', REPORT_SNAPSHOTS_SINCE_KERNEL)) return [];
  const first = steps.find((step) => step.stepDefinitionId === RUN_REPORT_STEP_ID && step.configuration?.snapshot !== undefined);
  return first
    ? [{ ref, message: '@core.marketplace/issue.step.input-kernel', messageParams: { step: first.id, input: 'snapshot', minimum: REPORT_SNAPSHOTS_SINCE_KERNEL } }]
    : [];
};

/**
 * "Extrair parâmetros" com os campos declarados no passo (`fields`) num pacote que admite kernel
 * anterior: lá o passo sem automação-alvo reprova em toda execução.
 */
const extractFieldsKernelIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', AI_EXTRACT_FIELDS_SINCE_KERNEL)) return [];
  const first = steps.find((step) => step.stepDefinitionId === AI_EXTRACT_PARAMETERS_STEP_ID && step.configuration?.fields !== undefined);
  return first
    ? [{
        ref,
        message: '@core.marketplace/issue.step.input-kernel',
        messageParams: { step: first.id, input: 'fields', minimum: AI_EXTRACT_FIELDS_SINCE_KERNEL },
      }]
    : [];
};

const stepDefinitionKernelIssues = (
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  const declared = pkg.manifest?.kernel ?? '';
  return Object.entries(STEP_DEFINITION_SINCE_KERNEL).flatMap(([definition, minimum]) => {
    const first = steps.find((step) => step.stepDefinitionId === definition);
    return first && !rangeExcludesBelow(declared, minimum)
      ? [{ ref, message: '@core.marketplace/issue.step.definition-kernel', messageParams: { step: first.id, definition, minimum } }]
      : [];
  });
};

/**
 * Onde um passo que PAUSA (`delay`, `approval`) não pode pausar — e falharia com o fluxo rodando:
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

  const declared = pkg.manifest?.kernel ?? '';
  const waits = delays.filter((step) => step.stepDefinitionId !== APPROVAL_STEP_ID && step.stepDefinitionId !== WAIT_FOR_STEP_ID);
  const approvals = delays.filter((step) => step.stepDefinitionId === APPROVAL_STEP_ID);
  const eventWaits = delays.filter((step) => step.stepDefinitionId === WAIT_FOR_STEP_ID);
  const kernel = [
    ...(waits.length > 0 && !rangeExcludesBelow(declared, WORKFLOW_DELAY_SINCE_KERNEL)
      ? [{ ref, message: '@core.marketplace/issue.step.delay-kernel', messageParams: { step: waits[0].id, minimum: WORKFLOW_DELAY_SINCE_KERNEL } }]
      : []),
    // A aprovação pausa pelo mesmo mecanismo da espera, mas a caixa de tarefas e a decisão chegaram depois.
    ...(approvals.length > 0 && !rangeExcludesBelow(declared, WORKFLOW_APPROVAL_SINCE_KERNEL)
      ? [{
          ref,
          message: '@core.marketplace/issue.step.definition-kernel',
          messageParams: { step: approvals[0].id, definition: APPROVAL_STEP_ID, minimum: WORKFLOW_APPROVAL_SINCE_KERNEL },
        }]
      : []),
    // A espera por evento pausa pelo mesmo relógio, mas quem a retoma é o barramento — e ele só a
    // procura a partir deste kernel.
    ...(eventWaits.length > 0 && !rangeExcludesBelow(declared, WORKFLOW_WAIT_FOR_SINCE_KERNEL)
      ? [{
          ref,
          message: '@core.marketplace/issue.step.definition-kernel',
          messageParams: { step: eventWaits[0].id, definition: WAIT_FOR_STEP_ID, minimum: WORKFLOW_WAIT_FOR_SINCE_KERNEL },
        }]
      : []),
  ];

  return [...nested, ...fromAction, ...kernel];
};

/**
 * O `Loop` sobre consulta (`loop.query`) PAUSA entre as páginas, então tem as recusas de quem pausa —
 * aninhado e disparado por ação — mais a do kernel. Num kernel anterior a recusa é a pior possível: o
 * `query` é ignorado e o laço percorre a `source`, uma lista vazia, terminando "com sucesso" sem ter
 * tocado registro nenhum.
 */
const pagedLoopIssues = (
  workflow: WorkflowModuleTemplate,
  steps: WorkflowStep[],
  ref: PackageRef,
  pkg: MarketplacePlugin,
): PackageValidationIssue[] => {
  const paged = steps.filter((step) => step.type === 'Loop' && step.loop?.query !== undefined);
  if (paged.length === 0) return [];
  const topLevel = new Set(workflow.steps.map((step) => step.id));
  const action = (pkg.actions ?? []).find((candidate) => candidate.workflowId === workflow.templateId);
  return [
    ...paged
      .filter((step) => !topLevel.has(step.id))
      .map((step) => ({ ref, message: '@core.marketplace/issue.step.delay-nested', messageParams: { step: step.id } })),
    ...(action
      ? [{ ref, message: '@core.marketplace/issue.step.delay-in-action', messageParams: { step: paged[0].id, action: action.key } }]
      : []),
    ...(rangeExcludesBelow(pkg.manifest?.kernel ?? '', WORKFLOW_PAGED_LOOP_SINCE_KERNEL)
      ? []
      : [{
          ref,
          message: '@core.marketplace/issue.workflow.feature-kernel',
          messageParams: { feature: 'loop.query', minimum: WORKFLOW_PAGED_LOOP_SINCE_KERNEL },
        }]),
  ];
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
