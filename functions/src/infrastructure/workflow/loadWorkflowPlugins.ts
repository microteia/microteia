import { createPluginHost } from '../../kernel';
import type { PluginHost } from '../../kernel';
import { hasErrors } from '../../domain/schema/plugin/diagnostics';
import { stepRegistry } from '../../domain/engine/StepRegistry';
import { expressionFunctions } from '../../domain/engine/expression/FunctionRegistry';
import type { ExpressionFunction } from '../../domain/engine/expression/FunctionRegistry';
import { BACKEND_PLUGINS } from '../../plugins';
import type { StepFactory } from '../../plugins/workflowExtensionPoints';
import { EXPRESSION_FUNCTION_POINT, WORKFLOW_STEP_POINT } from '../../plugins/workflowExtensionPoints';
import { CAPABILITY_PROVIDER_POINT } from '../../plugins/capabilityExtensionPoints';
import type { RegisterStepsDeps } from './stepDeps';

let host: PluginHost | null = null;

/**
 * Carrega os plugins do backend uma única vez por instância. A carga é síncrona e sem I/O — só
 * valida manifests e indexa contribuições —, então pode acontecer no cold start sem custo de
 * latência.
 */
export const getWorkflowPluginHost = (): PluginHost => {
  if (host) return host;

  const created = createPluginHost();
  const result = created.load(BACKEND_PLUGINS);

  if (hasErrors(result.diagnostics)) {
    const messages = result.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map((diagnostic) => `${diagnostic.pluginId ?? '?'}: ${diagnostic.message}`)
      .join(' | ');
    throw new Error(`Plugins do backend inválidos — o motor não pode iniciar. ${messages}`);
  }

  host = created;
  return host;
};

let expressionFunctionsRegistered = false;

/**
 * Idempotente e chamada sob demanda pelo `ExpressionEngine`. As funções não dependem de
 * repositório, mas o registro não pode acontecer no topo do módulo: o índice dos plugins importa
 * os Steps, que importam o motor — e o motor leria a lista antes de ela existir.
 */
export const registerExpressionFunctionsFromPlugins = (): void => {
  if (expressionFunctionsRegistered) return;
  const loaded = getWorkflowPluginHost();
  expressionFunctionsRegistered = true;

  for (const contribution of loaded.contributions.query(EXPRESSION_FUNCTION_POINT)) {
    if (contribution.impl?.kind !== 'code') continue;
    const fn = loaded.implementations.resolve<ExpressionFunction>(
      contribution.pluginId,
      contribution.impl.key,
    );
    if (fn) expressionFunctions.register(fn);
  }
};

/**
 * Substitui o antigo `registerSteps`: em vez de uma lista fixa de Steps, percorre as
 * contribuições `workflow.step` dos plugins carregados e injeta as dependências em cada fábrica.
 * Adicionar um Step passa a ser uma linha de manifest.
 */
export const registerStepsFromPlugins = (deps: RegisterStepsDeps): void => {
  const loaded = getWorkflowPluginHost();

  for (const contribution of loaded.contributions.query(WORKFLOW_STEP_POINT)) {
    if (contribution.impl?.kind !== 'code') continue;
    const factory = loaded.implementations.resolve<StepFactory>(
      contribution.pluginId,
      contribution.impl.key,
    );
    if (factory) stepRegistry.register(factory(deps));
  }
};

/**
 * Coleta as implementações de uma Capability. Devolve TODAS, não uma: quem consome IA continua
 * escolhendo pelo `canHandle` do provedor, guiado pela conexão configurada no escritório. Um
 * provedor novo entra por manifest, sem tocar no container de injeção.
 */
export const capabilityProvidersOf = <T>(capabilityId: string): T[] => {
  const loaded = getWorkflowPluginHost();

  return loaded.contributions
    .query(CAPABILITY_PROVIDER_POINT)
    .filter((contribution) => (contribution.metadata as { capability?: string }).capability === capabilityId)
    .flatMap((contribution) => {
      if (contribution.impl?.kind !== 'code') return [];
      const implementation = loaded.implementations.resolve<T>(contribution.pluginId, contribution.impl.key);
      return implementation ? [implementation] : [];
    });
};
