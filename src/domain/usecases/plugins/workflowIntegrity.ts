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
} from '../../schema/workflowStepCatalog';
import type { PackageRef, PackageValidationIssue } from './pluginReferences';
import { WORKFLOW_SCHEDULE_EVENT, scheduleIssues } from '../../schema/workflowClock';

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
 * argumento — que é o uso normal dos dois.
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
): PackageValidationIssue[] => {
  const ref: PackageRef = {
    kind: 'workflow',
    id: workflow.templateId,
    from: { origin: '@core.marketplace/ref.origin.workflow', name: workflow.name },
  };
  const steps = flattenSteps(workflow.steps);

  return [
    ...triggerIssues(workflow, ref),
    ...steps.flatMap((step) => stepIssues(step, ref, hasDependencies)),
    ...outputRefIssues(steps, ref),
  ];
};

/**
 * O gatilho de horário sem horário que o relógio leia. A automação instala, aparece ligada e nunca
 * dispara — o pior tipo de defeito, porque não há execução falhada para alguém ver.
 */
const triggerIssues = (workflow: WorkflowModuleTemplate, ref: PackageRef): PackageValidationIssue[] => {
  if (workflow.eventName !== WORKFLOW_SCHEDULE_EVENT) return [];
  return scheduleIssues(workflow.schedule).map((issue) => ({
    ref,
    message: '@core.marketplace/issue.workflow.schedule-invalid',
    messageParams: { detail: issue.message, ...(issue.messageParams ?? {}) },
  }));
};

/**
 * Os problemas de passo de todo workflow do pacote. Entra na porta única de validação
 * (`validatePluginPackage`), e por isso vale igual no `check` do terminal, no MCP, na tela de autoria
 * e na instalação.
 */
export const workflowStepIssues = (pkg: MarketplacePlugin): PackageValidationIssue[] => {
  const hasDependencies = Object.keys(pkg.manifest?.dependencies ?? {}).length > 0;
  return (pkg.workflows ?? []).flatMap((workflow) => workflowIssues(workflow, hasDependencies));
};
