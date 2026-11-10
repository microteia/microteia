import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../kernel';
import type { PluginRecord } from '../kernel';
import type { StepDefinition } from '../domain/engine/StepDefinition';
import type { ExpressionFunction } from '../domain/engine/expression/FunctionRegistry';
import type { RegisterStepsDeps } from '../infrastructure/workflow/stepDeps';
import type { StepFactory } from './workflowExtensionPoints';
import { EXPRESSION_FUNCTION_POINT, WORKFLOW_STEP_POINT } from './workflowExtensionPoints';
import { CAPABILITY_PROVIDER_POINT, capabilityProvider } from './capabilityExtensionPoints';
import { CORE_STEP_DEFINITION_IDS } from '../domain/schema/workflowStepCatalog';
import { BACKEND_PLUGINS } from './index';

const hostWith = (records: PluginRecord[]) => {
  const host = createPluginHost();
  return { host, result: host.load(records) };
};

const without = (pluginId: string): PluginRecord[] =>
  BACKEND_PLUGINS.filter((record) => record.manifest.id !== pluginId);

/**
 * Os Steps que o `registerSteps` fixo registrava antes da migração para contribuições. `create-deadline`
 * saiu com a entidade Prazo: criar um prazo é gravar um registro, e quem faz isso é o Step genérico
 * "Gravar Registro" (`upsert`) — o motor não conhece mais nenhuma entidade de escritório pelo nome.
 */
const STEPS_ANTES_DA_MIGRACAO = [
  'call-workflow', 'exit', 'map', 'notify', 'query',
  'register-audit', 'remove', 'script', 'set-variable', 'upsert', 'validate-object',
].sort();

/** Os passos de `core.steps` hoje: os de antes da migração e os que nasceram como contribuição desde então. */
const PASSOS_DO_NUCLEO = [
  ...STEPS_ANTES_DA_MIGRACAO, 'delay', 'render-document', 'share-documents', 'portal-invite', 'portal-revoke', 'http-request',
].sort();

/**
 * Os passos que chamam um MODELO. Vivem em `core.ai.steps`, e não em `core.steps`, e é por isso que
 * os testes de remoção abaixo distinguem "os passos" de "os passos daquele plugin".
 */
const PASSOS_DE_IA = ['ai-detect-workflow', 'ai-extract-parameters'].sort();

/** As 53 funções que o `ExpressionEngine` registrava direto, antes da migração. */
const FUNCOES_ANTES_DA_MIGRACAO = [
  'abs', 'addDays', 'and', 'avg', 'ceil', 'coalesce', 'concat', 'contains', 'dateDiff', 'day',
  'dayOfWeek', 'delete', 'endsWith', 'first', 'floor', 'formatCNPJ', 'formatCPF', 'formatDate',
  'formatMoney', 'getVar', 'hasPermission', 'if', 'indexOf', 'interpolate', 'isCNPJ', 'isCPF', 'isEmail',
  'isEmpty', 'isNotNull', 'isNull', 'isWeekend', 'join', 'last', 'length', 'lower', 'map', 'max',
  'min', 'month', 'not', 'now', 'object', 'onlyNumber', 'or', 'replace', 'round', 'split',
  'startsWith', 'substring', 'sum', 'today', 'trim', 'upper', 'year',
].sort();

/**
 * Saíram do catálogo por serem INALCANÇÁVEIS: o `expr-eval` reserva esses nomes como operadores e
 * nunca roteia a chamada para a função registrada — `and(a, b)` e `or(a, b)` nem parseiam, e
 * `not`/`abs`/`ceil`/`floor` são resolvidos pelo operador unário antes. Continuam
 * funcionando pela forma que o parser aceita (`a and b`, `not a`, `abs(x)`), documentada no
 * `operatorRegistry`. A sonda que prova isso está em
 * `domain/engine/expression/fieldExpressionParity.test.ts`.
 */
const REMOVIDAS_POR_SEREM_INALCANCAVEIS = ['abs', 'and', 'ceil', 'floor', 'not', 'or'];

/** As contas de dias úteis, que chegaram depois da migração — a mesma lista dos dois catálogos. */
const FUNCOES_DE_DIAS_UTEIS = ['addBusinessDays', 'businessDaysBetween', 'isBusinessDay', 'nextBusinessDay'];

/** O resto ISO 7064 mod 97-10, o verbo por trás do número CNJ e do IBAN — também dos dois catálogos. */
const FUNCOES_DE_DIGITO_VERIFICADOR = ['mod97'];

const FUNCOES_ESPERADAS = [
  ...FUNCOES_ANTES_DA_MIGRACAO.filter((name) => !REMOVIDAS_POR_SEREM_INALCANCAVEIS.includes(name)),
  ...FUNCOES_DE_DIAS_UTEIS,
  ...FUNCOES_DE_DIGITO_VERIFICADOR,
].sort();

describe('plugins do backend — carga', () => {
  it('carrega sem nenhum diagnóstico', () => {
    const { result } = hostWith(BACKEND_PLUGINS);
    expect(result.diagnostics).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('carrega quem declara um ponto antes de quem contribui para ele', () => {
    const { result } = hostWith(BACKEND_PLUGINS);
    const posicao = (id: string) => result.loaded.indexOf(id);

    expect(posicao('core.workflow')).toBeLessThan(posicao('core.steps'));
    expect(posicao('core.workflow')).toBeLessThan(posicao('core.expressions'));
    expect(posicao('core.capabilities')).toBeLessThan(posicao('core.ai'));
    expect(posicao('core.workflow')).toBeLessThan(posicao('core.ai.steps'));
    expect(posicao('core.ai')).toBeLessThan(posicao('core.ai.steps'));
  });

  it('toda contribuição resolve uma implementação', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    const all = [
      ...host.contributions.query(WORKFLOW_STEP_POINT),
      ...host.contributions.query(EXPRESSION_FUNCTION_POINT),
    ];

    for (const contribution of all) {
      expect(contribution.impl?.kind).toBe('code');
      if (contribution.impl?.kind !== 'code') continue;
      expect(host.implementations.has(contribution.pluginId, contribution.impl.key)).toBe(true);
    }
  });
});

describe('plugins do backend — paridade com o registro fixo', () => {
  it('nenhum Step se perdeu na migração', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    const ids = host.contributions
      .query(WORKFLOW_STEP_POINT)
      .map((contribution) => (contribution.metadata as { stepDefinitionId: string }).stepDefinitionId)
      .sort();

    for (const id of STEPS_ANTES_DA_MIGRACAO) {
      expect(ids, `o Step "${id}" existia antes da migração e não é mais contribuído`).toContain(id);
    }
  });

  /**
   * A contrapartida do teste acima, e a que cobra o passo NOVO: o catálogo — que é metadata, e vive
   * em `src/` — e as contribuições — que trazem o executor, e vivem aqui — têm de nomear o mesmo
   * conjunto. Uma entrada de catálogo sem contribuição aparece no construtor visual e só falha com o
   * fluxo em execução ("StepDefinition desconhecida"); uma contribuição sem entrada de catálogo nem
   * chega a ser oferecida.
   */
  it('o catálogo do kernel e as contribuições nomeiam exatamente os mesmos passos', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    const ids = host.contributions
      .query(WORKFLOW_STEP_POINT)
      .map((contribution) => (contribution.metadata as { stepDefinitionId: string }).stepDefinitionId)
      .sort();

    expect(ids).toEqual([...CORE_STEP_DEFINITION_IDS].sort());
  });

  it('nenhuma função de expressão se perdeu na migração, além das removidas por serem inalcançáveis', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    const names = host.contributions
      .query(EXPRESSION_FUNCTION_POINT)
      .map((contribution) => (contribution.metadata as { name: string }).name)
      .sort();

    expect(names).toEqual(FUNCOES_ESPERADAS);
  });

  it('a fábrica de cada Step produz a StepDefinition com o id declarado na metadata', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    const deps = {} as RegisterStepsDeps;

    for (const contribution of host.contributions.query(WORKFLOW_STEP_POINT)) {
      if (contribution.impl?.kind !== 'code') continue;
      const factory = host.implementations.resolve<StepFactory>(contribution.pluginId, contribution.impl.key);
      const definition = factory?.(deps) as StepDefinition;

      const declared = (contribution.metadata as { stepDefinitionId: string }).stepDefinitionId;
      expect(definition.id, `metadata de "${contribution.id}" divergiu da fábrica`).toBe(declared);
    }
  });

  it('a metadata de cada função bate com o objeto da função', () => {
    const { host } = hostWith(BACKEND_PLUGINS);

    for (const contribution of host.contributions.query(EXPRESSION_FUNCTION_POINT)) {
      if (contribution.impl?.kind !== 'code') continue;
      const fn = host.implementations.resolve<ExpressionFunction>(contribution.pluginId, contribution.impl.key);
      const metadata = contribution.metadata as { name: string; minArgs: number };

      expect(fn?.name).toBe(metadata.name);
      expect(fn?.minArgs).toBe(metadata.minArgs);
    }
  });

  it('nenhum id de Step ou de função é declarado duas vezes', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    const stepIds = host.contributions.query(WORKFLOW_STEP_POINT).map((c) => c.id);
    const fnIds = host.contributions.query(EXPRESSION_FUNCTION_POINT).map((c) => c.id);

    expect(new Set(stepIds).size).toBe(stepIds.length);
    expect(new Set(fnIds).size).toBe(fnIds.length);
  });
});

describe('plugins do backend — remoção limpa', () => {
  it('remover core.steps tira os passos dele, preserva as funções e os passos de IA', () => {
    const { host, result } = hostWith(without('core.steps'));
    const ids = host.contributions
      .query(WORKFLOW_STEP_POINT)
      .map((contribution) => (contribution.metadata as { stepDefinitionId: string }).stepDefinitionId)
      .sort();

    expect(result.diagnostics).toEqual([]);
    expect(ids).toEqual(PASSOS_DE_IA);
    expect(host.contributions.query(EXPRESSION_FUNCTION_POINT)).toHaveLength(
      FUNCOES_ESPERADAS.length,
    );
    expect(host.implementations.keysOf('core.steps')).toEqual([]);
  });

  it('remover core.ai.steps tira só os passos de IA', () => {
    const { host, result } = hostWith(without('core.ai.steps'));
    const ids = host.contributions
      .query(WORKFLOW_STEP_POINT)
      .map((contribution) => (contribution.metadata as { stepDefinitionId: string }).stepDefinitionId)
      .sort();

    expect(result.diagnostics).toEqual([]);
    expect(ids).toEqual(PASSOS_DO_NUCLEO);
  });

  it('remover core.expressions tira as funções e preserva os passos', () => {
    const { host } = hostWith(without('core.expressions'));

    expect(host.contributions.query(EXPRESSION_FUNCTION_POINT)).toEqual([]);
    expect(host.contributions.query(WORKFLOW_STEP_POINT)).toHaveLength(
      CORE_STEP_DEFINITION_IDS.length,
    );
  });

  it('remover core.workflow derruba passos e funções, mas não as capabilities', () => {
    const { host, result } = hostWith(without('core.workflow'));

    expect([...result.skipped].sort()).toEqual(['core.ai.steps', 'core.expressions', 'core.steps']);
    expect(host.contributions.query(WORKFLOW_STEP_POINT)).toEqual([]);
    expect(host.contributions.query(EXPRESSION_FUNCTION_POINT)).toEqual([]);
    expect(result.diagnostics.every((d) => d.code === 'dependency.missing')).toBe(true);

    // core.ai não depende do motor: continua de pé.
    expect(host.isLoaded('core.ai')).toBe(true);
  });
});


describe('capabilities — provedores de IA', () => {
  const providersOf = (host: ReturnType<typeof createPluginHost>, capability: string) =>
    host.contributions
      .query(CAPABILITY_PROVIDER_POINT)
      .filter((c) => (c.metadata as { capability: string }).capability === capability);

  it('os 5 provedores de IA que o container criava à mão viraram contribuições', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    const keys = providersOf(host, 'ai.completion')
      .map((c) => (c.metadata as { providerKey: string }).providerKey)
      .sort();

    expect(keys).toEqual(['anthropic', 'cohere', 'google', 'mistral', 'openai']);
  });

  it('cada provedor resolve um serviço que sabe atender sua própria chave', () => {
    const { host } = hostWith(BACKEND_PLUGINS);

    for (const contribution of providersOf(host, 'ai.completion')) {
      if (contribution.impl?.kind !== 'code') continue;
      const service = host.implementations.resolve<{ canHandle(p: string): boolean }>(
        contribution.pluginId,
        contribution.impl.key,
      );
      const { providerKey } = contribution.metadata as { providerKey: string };

      expect(service?.canHandle(providerKey), `${providerKey} não se reconhece`).toBe(true);
      expect(service?.canHandle('outro-qualquer')).toBe(false);
    }
  });

  it('o manifest declara a capability para quem quiser consumi-la', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    expect(host.capabilities.resolve({ capability: 'ai.completion', range: '^1.0.0' })?.pluginId).toBe(
      'core.ai',
    );
  });

  it('um plugin de terceiro adiciona um provedor SEM tocar no container de injeção', () => {
    const terceiro: PluginRecord = {
      trusted: true,
      implementations: { LlamaService: { canHandle: (p: string) => p === 'llama' } },
      manifest: {
        id: 'com.acme.llama',
        version: '1.0.0',
        kernel: '^2.0.0',
        name: 'Llama',
        dependencies: { 'core.capabilities': '^1.0.0' },
        provides: [{ capability: 'ai.completion', version: '1.0.0' }],
        contributes: [
          capabilityProvider(
            { capability: 'ai.completion', version: '1.0.0', providerKey: 'llama', label: 'Llama' },
            'LlamaService',
          ),
        ],
      },
    };

    const { host, result } = hostWith([...BACKEND_PLUGINS, terceiro]);

    expect(result.diagnostics).toEqual([]);
    expect(providersOf(host, 'ai.completion')).toHaveLength(6);
    expect(
      providersOf(host, 'ai.completion').map((c) => (c.metadata as { providerKey: string }).providerKey),
    ).toContain('llama');
  });

  it('remover core.ai deixa o sistema sem nenhum provedor de IA', () => {
    const { host } = hostWith(without('core.ai'));
    expect(providersOf(host, 'ai.completion')).toEqual([]);
    expect(host.capabilities.resolve({ capability: 'ai.completion', range: '^1.0.0' })).toBeNull();
  });
});
