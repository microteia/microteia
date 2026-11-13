// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowStepContribution.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowStepContribution.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ExtensionPointDefinition } from './plugin/extensionPoint';
import type { Contribution } from './plugin/contribution';
import type { StepCategory, WorkflowStepMetadata } from './workflowStepCatalog';

export const WORKFLOW_STEP_POINT = 'workflow.step';
export const WORKFLOW_STEP_API_VERSION = '1.0.0';

/** O kernel a partir do qual uma EXTENSÃO declara passo próprio — o "conector". */
export const EXTENSION_STEPS_SINCE_KERNEL = '2.122.0';

/**
 * A entrada em que o passo de extensão guarda o próprio corpo, SEMEADA pelo editor. É ela que deixa o
 * editor achar as entradas e as saídas do corpo pelo mesmo caminho de "Chamar automação" e "Script". O
 * executor NUNCA a lê: o corpo vale o que o pacote declarou, e editar a automação à mão não aponta o
 * passo para outro lugar. Nome próprio, e não `targetWorkflowId`, para a checagem de referências entre
 * extensões não cobrar do fornecedor que exporte um corpo que é detalhe dele.
 */
export const EXTENSION_STEP_TARGET_INPUT = 'connectorTarget';

/**
 * O ponto em que um passo entra no catálogo. O núcleo contribui em CÓDIGO (`code`, só de confiança); uma
 * extensão contribui com um CORPO declarativo — uma automação (`workflow`) ou um script do sandbox
 * (`script`) do próprio pacote. Nenhum código de terceiro roda no servidor fora do sandbox.
 */
export const WORKFLOW_STEP_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: WORKFLOW_STEP_POINT,
    apiVersion: WORKFLOW_STEP_API_VERSION,
    title: '@core.automation/point.step.title',
    description: '@core.automation/point.step.description',
    ownerPluginId: 'core.automation',
    allowedImplKinds: ['code', 'workflow', 'script'],
    implRequired: true,
    multiple: true,
  },
];

/** O que o autor declara de um passo de extensão — as entradas e as saídas são as do corpo. */
export interface ExtensionStepMetadata {
  /** A chave dentro da extensão; o id do passo é `<pluginId>/<key>`. */
  key: string;
  /** Referência `@<pacote>/<chave>` — o nome que o editor mostra na lista de passos. */
  name: string;
  description?: string;
  /** Uma chave do catálogo de ícones de tela. */
  icon?: string;
  category?: StepCategory;
}

/**
 * A contribuição de um passo de extensão: o corpo é uma automação CHAMADA (`workflowId`) ou um script
 * (`scriptId`) do próprio pacote, pelo `templateId`.
 */
export const extensionStepContribution = (
  metadata: ExtensionStepMetadata,
  body: { workflowId: string } | { scriptId: string },
): Contribution => ({
  point: WORKFLOW_STEP_POINT,
  id: `step-${metadata.key}`,
  apiVersion: WORKFLOW_STEP_API_VERSION,
  metadata: { ...metadata },
  impl: 'workflowId' in body ? { kind: 'workflow', workflowId: body.workflowId } : { kind: 'script', scriptId: body.scriptId },
});

const STEP_CATEGORIES: readonly StepCategory[] = ['Action', 'Data', 'Notification', 'Integration'];
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** A chave do passo dentro da extensão: minúsculas, dígitos e hífen. */
export const isExtensionStepKey = (value: unknown): value is string => typeof value === 'string' && KEY_PATTERN.test(value);

/** O id GLOBAL do passo: qualificado pela extensão, nunca colide com o núcleo nem com outra extensão. */
export const extensionStepId = (pluginId: string, key: string): string => `${pluginId}/${key}`;

/** O id é de passo de extensão? Os do núcleo não têm barra. */
export const parseExtensionStepId = (id: string): { pluginId: string; key: string } | null => {
  const at = id.lastIndexOf('/');
  if (at <= 0) return null;
  const pluginId = id.slice(0, at);
  const key = id.slice(at + 1);
  return isExtensionStepKey(key) ? { pluginId, key } : null;
};

export type ExtensionStepBody = { kind: 'workflow'; ref: string } | { kind: 'script'; ref: string };

export interface ExtensionStep {
  id: string;
  pluginId: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: StepCategory;
  /** O corpo, pela referência qualificada (`<pluginId>/<templateId>`) — a que sobrevive à instalação. */
  body: ExtensionStepBody;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Os passos que um pacote INSTALADO declara. O que não tem forma de passo de extensão — chave inválida,
 * sem nome, corpo que não é automação nem script — fica de fora: a validação do pacote já o recusou na
 * instalação, e aqui não se executa o que não se sabe ler.
 */
export const extensionStepsOf = (pluginId: string, contributions: readonly Contribution[] | undefined): ExtensionStep[] =>
  (contributions ?? []).flatMap((contribution): ExtensionStep[] => {
    if (contribution?.point !== WORKFLOW_STEP_POINT) return [];
    const metadata = (contribution.metadata ?? {}) as Record<string, unknown>;
    const key = metadata.key;
    const name = text(metadata.name);
    if (!isExtensionStepKey(key) || name === '') return [];
    const impl = contribution.impl;
    const body: ExtensionStepBody | null = impl?.kind === 'workflow' && text(impl.workflowId) !== ''
      ? { kind: 'workflow', ref: `${pluginId}/${text(impl.workflowId)}` }
      : impl?.kind === 'script' && text(impl.scriptId) !== ''
        ? { kind: 'script', ref: `${pluginId}/${text(impl.scriptId)}` }
        : null;
    if (!body) return [];
    const category = STEP_CATEGORIES.find((one) => one === metadata.category) ?? 'Integration';
    return [{
      id: extensionStepId(pluginId, key),
      pluginId,
      key,
      name,
      description: text(metadata.description),
      icon: text(metadata.icon),
      category,
      body,
    }];
  });

/**
 * A entrada do catálogo de um passo de extensão. Não declara entradas nem saídas: elas são as do CORPO —
 * os parâmetros e o retorno da automação, ou os parâmetros e as saídas do script —, achadas pelo mesmo
 * caminho de "Chamar automação" e "Script". Declarar duas vezes seria o primeiro lugar onde divergem.
 */
export const extensionStepCatalogEntry = (step: ExtensionStep): WorkflowStepMetadata & { fixedTarget: string } => ({
  id: step.id,
  version: 1,
  name: step.name,
  description: step.description,
  icon: step.icon,
  category: step.category,
  type: step.body.kind === 'workflow' ? 'SubWorkflow' : 'Script',
  configurable: true,
  inputs: [],
  outputDefinitions: [],
  dynamicInputs: step.body.kind === 'workflow'
    ? { kind: 'from-target-workflow-parameters', sourceInputId: EXTENSION_STEP_TARGET_INPUT }
    : { kind: 'from-target-script-parameters', sourceInputId: EXTENSION_STEP_TARGET_INPUT },
  dynamicOutputs: step.body.kind === 'workflow'
    ? { kind: 'from-target-workflow-outputs', sourceInputId: EXTENSION_STEP_TARGET_INPUT }
    : { kind: 'from-target-script-outputs', sourceInputId: EXTENSION_STEP_TARGET_INPUT },
  fixedTarget: step.body.ref,
});
