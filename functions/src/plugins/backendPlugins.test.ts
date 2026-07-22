import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../kernel';
import type { PluginRecord } from '../kernel';
import type { StepDefinition } from '../domain/engine/StepDefinition';
import type { ExpressionFunction } from '../domain/engine/expression/FunctionRegistry';
import type { RegisterStepsDeps } from '../infrastructure/workflow/stepDeps';
import type { StepFactory } from './workflowExtensionPoints';
import { EXPRESSION_FUNCTION_POINT, WORKFLOW_STEP_POINT } from './workflowExtensionPoints';
import { BACKEND_PLUGINS } from './index';

const hostWith = (records: PluginRecord[]) => {
  const host = createPluginHost();
  return { host, result: host.load(records) };
};

const without = (pluginId: string): PluginRecord[] =>
  BACKEND_PLUGINS.filter((record) => record.manifest.id !== pluginId);

/** Os 12 Steps que o `registerSteps` fixo registrava antes da migração para contribuições. */
const STEPS_ANTES_DA_MIGRACAO = [
  'call-workflow', 'create-deadline', 'exit', 'map', 'notify', 'query',
  'register-audit', 'remove', 'script', 'set-variable', 'upsert', 'validate-object',
].sort();

/** As 53 funções que o `ExpressionEngine` registrava direto, antes da migração. */
const FUNCOES_ANTES_DA_MIGRACAO = [
  'abs', 'addDays', 'and', 'avg', 'ceil', 'coalesce', 'concat', 'contains', 'dateDiff', 'day',
  'dayOfWeek', 'delete', 'endsWith', 'first', 'floor', 'formatCNPJ', 'formatCPF', 'formatDate',
  'formatMoney', 'getVar', 'if', 'indexOf', 'interpolate', 'isCNPJ', 'isCPF', 'isEmail',
  'isEmpty', 'isNotNull', 'isNull', 'isWeekend', 'join', 'last', 'length', 'lower', 'map', 'max',
  'min', 'month', 'not', 'now', 'object', 'onlyNumber', 'or', 'replace', 'round', 'split',
  'startsWith', 'substring', 'sum', 'today', 'trim', 'upper', 'year',
].sort();

describe('plugins do backend — carga', () => {
  it('carrega sem nenhum diagnóstico', () => {
    const { result } = hostWith(BACKEND_PLUGINS);
    expect(result.diagnostics).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('carrega core.workflow antes de quem depende dele', () => {
    const { result } = hostWith(BACKEND_PLUGINS);
    expect(result.loaded[0]).toBe('core.workflow');
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

    expect(ids).toEqual(STEPS_ANTES_DA_MIGRACAO);
  });

  it('nenhuma função de expressão se perdeu na migração', () => {
    const { host } = hostWith(BACKEND_PLUGINS);
    const names = host.contributions
      .query(EXPRESSION_FUNCTION_POINT)
      .map((contribution) => (contribution.metadata as { name: string }).name)
      .sort();

    expect(names).toEqual(FUNCOES_ANTES_DA_MIGRACAO);
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
  it('remover core.steps tira os passos e preserva as funções', () => {
    const { host, result } = hostWith(without('core.steps'));

    expect(result.diagnostics).toEqual([]);
    expect(host.contributions.query(WORKFLOW_STEP_POINT)).toEqual([]);
    expect(host.contributions.query(EXPRESSION_FUNCTION_POINT)).toHaveLength(
      FUNCOES_ANTES_DA_MIGRACAO.length,
    );
    expect(host.implementations.keysOf('core.steps')).toEqual([]);
  });

  it('remover core.expressions tira as funções e preserva os passos', () => {
    const { host } = hostWith(without('core.expressions'));

    expect(host.contributions.query(EXPRESSION_FUNCTION_POINT)).toEqual([]);
    expect(host.contributions.query(WORKFLOW_STEP_POINT)).toHaveLength(STEPS_ANTES_DA_MIGRACAO.length);
  });

  it('remover core.workflow derruba os dois, porque ninguém declara os pontos', () => {
    const { host, result } = hostWith(without('core.workflow'));

    expect(result.loaded).toEqual([]);
    expect(host.contributions.query(WORKFLOW_STEP_POINT)).toEqual([]);
    expect(host.contributions.query(EXPRESSION_FUNCTION_POINT)).toEqual([]);
    expect(result.diagnostics.every((d) => d.code === 'dependency.missing')).toBe(true);
  });
});
