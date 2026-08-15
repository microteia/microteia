import { describe, it, expect } from 'vitest';
import {
  dslToParameters,
  parameterLookupCollections,
  parametersToDsl,
  sanitizeWorkflowParameters,
  siblingParameterErrors,
} from './workflowParameters';
import type { WorkflowParameter } from '../entities/Workflow';

/**
 * O parâmetro que aponta para uma LISTA DE OPÇÕES do escritório. O que ele guarda é o nome da
 * coleção da lista — a mesma chave que um campo de tela usa —, e é dela que sai o que se escolhe na
 * hora de executar.
 */
describe('parâmetro do tipo lookup', () => {
  const parametro = (over: Partial<WorkflowParameter> = {}): WorkflowParameter => ({
    key: 'situacao',
    label: 'Situação',
    type: 'lookup',
    lookupCollection: 'pushStatuses',
    ...over,
  });

  it('a lista escolhida sobrevive à limpeza do salvamento', () => {
    expect(sanitizeWorkflowParameters([parametro()])).toEqual([
      { key: 'situacao', label: 'Situação', type: 'lookup', lookupCollection: 'pushStatuses' },
    ]);
  });

  it('a lista só é guardada quando o tipo é o dela', () => {
    const [limpo] = sanitizeWorkflowParameters([parametro({ type: 'String' })]);
    expect(limpo.lookupCollection).toBeUndefined();
  });

  it('sem lista escolhida, o parâmetro acusa o que falta', () => {
    expect(siblingParameterErrors([parametro({ lookupCollection: undefined })])).toEqual([
      { message: '@core.automation/parameter.lookup-required' },
    ]);
  });

  it('vai e volta pelo JSON avançado sem perder a lista', () => {
    const dsl = parametersToDsl([parametro()]);
    expect(dslToParameters(dsl).params).toEqual([parametro()]);
  });

  it('o atalho de uma linha não serve: sem a lista não há o que escolher', () => {
    expect(dslToParameters('{ "situacao": "lookup" }').errors).toEqual([
      { path: 'situacao', message: '@core.automation/parameter.dsl.lookup-needs-collection' },
    ]);
  });

  it('as listas pedidas são reunidas, inclusive as de dentro de um objeto', () => {
    expect(
      parameterLookupCollections([
        parametro(),
        { key: 'dados', label: 'Dados', type: 'Object', fields: [
          { key: 'area', label: 'Área', type: 'lookup', lookupCollection: 'caseAreas' },
          { key: 'titulo', label: 'Título', type: 'String' },
        ] },
      ]),
    ).toEqual(['pushStatuses', 'caseAreas']);
  });
});
