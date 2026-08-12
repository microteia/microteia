import { describe, it, expect } from 'vitest';
import { flattenParameterInputs, parameterToInputDefinition } from './parameterInputs';
import type { WorkflowParameter } from '../../domain/entities/Workflow';

/**
 * A ponte que faz o parâmetro declarado virar um controle. É o que garante que o mesmo parâmetro
 * seja preenchido do mesmo jeito no Step, no "Executar" e na ação que pergunta.
 */
describe('parameterToInputDefinition', () => {
  it('referência a entidade vira o controle que lista os registros da coleção', () => {
    const param: WorkflowParameter = { key: 'processo', label: 'Processo', type: 'EntityReference', entityType: 'cases' };
    expect(parameterToInputDefinition(param)).toEqual({
      id: 'processo',
      label: 'Processo',
      required: false,
      rules: undefined,
      type: 'EntityReference',
      entityType: 'cases',
    });
  });

  it('lista do escritório vira o controle das opções daquela coleção', () => {
    const param: WorkflowParameter = { key: 'situacao', label: 'Situação', type: 'lookup', lookupCollection: 'pushStatuses' };
    expect(parameterToInputDefinition(param).options).toEqual({ kind: 'Lookup', lookup: 'pushStatuses' });
  });

  it('lista de opções própria vira o controle das opções declaradas', () => {
    const param: WorkflowParameter = {
      key: 'prioridade',
      label: 'Prioridade',
      type: 'select',
      options: [{ value: 'alta', label: 'Alta' }],
    };
    expect(parameterToInputDefinition(param).options).toEqual({
      kind: 'Static',
      options: [{ value: 'alta', label: 'Alta' }],
    });
  });

  it('o objeto se desdobra nos campos, com o id que o executor espera', () => {
    const param: WorkflowParameter = {
      key: 'dados',
      label: 'Dados',
      type: 'Object',
      fields: [{ key: 'area', label: 'Área', type: 'lookup', lookupCollection: 'caseAreas' }],
    };
    const [input] = flattenParameterInputs(param);
    expect(input.id).toBe('param.dados.area');
    expect(input.label).toBe('Dados › Área');
    expect(input.options).toEqual({ kind: 'Lookup', lookup: 'caseAreas' });
  });
});
