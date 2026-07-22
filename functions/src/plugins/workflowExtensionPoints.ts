import type { Contribution } from '../domain/schema/plugin/contribution';
import type { ExtensionPointDefinition } from '../domain/schema/plugin/extensionPoint';
import type { StepDefinition } from '../domain/engine/StepDefinition';
import type { ExpressionFunction } from '../domain/engine/expression/FunctionRegistry';
import type { RegisterStepsDeps } from '../infrastructure/workflow/stepDeps';

export const WORKFLOW_STEP_POINT = 'workflow.step';
export const EXPRESSION_FUNCTION_POINT = 'expression.function';

export const WORKFLOW_API_VERSION = '1.0.0';

/**
 * Um Step é construído com as dependências do motor, não importado pronto: quem contribui declara
 * a fábrica, e o composition root injeta os repositórios no momento da carga. É isso que mantém o
 * Step ignorante sobre de onde vêm seus dados.
 */
export type StepFactory = (deps: RegisterStepsDeps) => StepDefinition;

export interface WorkflowStepMetadata {
  stepDefinitionId: string;
  name: string;
  category: StepDefinition['category'];
}

export interface ExpressionFunctionMetadata {
  name: string;
  category: ExpressionFunction['category'];
  minArgs: number;
  maxArgs?: number;
}

export const WORKFLOW_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: WORKFLOW_STEP_POINT,
    apiVersion: WORKFLOW_API_VERSION,
    title: 'Passo de automação',
    description: 'Registra um passo configurável no construtor visual de Automações.',
    ownerPluginId: 'core.workflow',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
  {
    id: EXPRESSION_FUNCTION_POINT,
    apiVersion: WORKFLOW_API_VERSION,
    title: 'Função de expressão',
    description: 'Registra uma função disponível nas expressões e dentro do Step Script.',
    ownerPluginId: 'core.workflow',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
];

const slug = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

export const workflowStep = (
  metadata: WorkflowStepMetadata,
  implKey: string,
): Contribution => ({
  point: WORKFLOW_STEP_POINT,
  id: slug(metadata.stepDefinitionId),
  apiVersion: WORKFLOW_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});

/**
 * A metadata da função é DERIVADA do próprio objeto — descrição, assinatura e exemplo já vivem
 * nele e são servidos à tela de referência. Duplicá-los no manifest só criaria duas verdades.
 */
export const expressionFunction = (fn: ExpressionFunction): Contribution => ({
  point: EXPRESSION_FUNCTION_POINT,
  id: slug(fn.name),
  apiVersion: WORKFLOW_API_VERSION,
  metadata: {
    name: fn.name,
    category: fn.category,
    minArgs: fn.minArgs,
    maxArgs: fn.maxArgs,
  } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: fn.name },
});
