import { describe, it, expect } from 'vitest';
import { flattenParameterInputs, parameterForDisplay, parameterToInputDefinition } from './parameterInputs';
import type { WorkflowParameter } from '../../domain/entities/Workflow';

/**
 * O resolvedor de referência do teste: marca o que passou por ele e interpola o que a frase pede —
 * é o suficiente para provar que nenhuma referência escapa para a tela.
 */
const label = (value: string | null | undefined, params?: Record<string, string>): string => {
  const raw = value ?? '';
  if (!raw.startsWith('@')) return raw;
  const resolved = `traduzido(${raw.slice(1)})`;
  return params ? `${resolved}[${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',')}]` : resolved;
};

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
    const [input] = flattenParameterInputs(label, param);
    expect(input.id).toBe('param.dados.area');
    expect(input.label).toBe('Dados › Área');
    expect(input.options).toEqual({ kind: 'Lookup', lookup: 'caseAreas' });
  });
});

/**
 * O ponto ÚNICO em que o rótulo declarativo de um parâmetro é resolvido. Existe porque as três telas
 * que pedem parâmetro atravessam este módulo, e duas delas mostravam a referência crua.
 *
 * O teste guarda a REGRESSÃO: se alguém deixar de resolver um dos três níveis — o rótulo, a opção do
 * `select`, o campo do objeto —, a referência volta à tela e ninguém vê até alguém abrir o formulário.
 */
describe('parameterForDisplay — o rótulo declarativo resolvido antes de virar controle', () => {
  it('resolve o rótulo, as opções e os campos do objeto', () => {
    const param: WorkflowParameter = {
      key: 'decision',
      label: '@com.acme.auto/parameter.decision',
      type: 'select',
      options: [
        { value: 'approved', label: '@com.acme.auto/parameter.decision.approve' },
        { value: 'rejected', label: 'Reprovar' },
      ],
      fields: [{ key: 'note', label: '@com.acme.auto/parameter.note', type: 'String' }],
    };
    const shown = parameterForDisplay(label, param);

    expect(shown.label).toBe('traduzido(com.acme.auto/parameter.decision)');
    expect(shown.options).toEqual([
      { value: 'approved', label: 'traduzido(com.acme.auto/parameter.decision.approve)' },
      { value: 'rejected', label: 'Reprovar' },
    ]);
    expect(shown.fields?.[0].label).toBe('traduzido(com.acme.auto/parameter.note)');
  });

  it('nada além do rótulo é tocado — chave, tipo e regras seguem intactos', () => {
    const param: WorkflowParameter = {
      key: 'amount',
      label: '@com.acme.auto/field.amount',
      type: 'Number',
      required: true,
      list: true,
      rules: { format: { kind: 'currency' } } as WorkflowParameter['rules'],
    };
    const shown = parameterForDisplay(label, param);

    expect(shown).toEqual({ ...param, label: 'traduzido(com.acme.auto/field.amount)' });
  });

  it('o texto que o escritório digitou passa intacto', () => {
    const param: WorkflowParameter = { key: 'note', label: 'Observação do cliente', type: 'String' };
    expect(parameterForDisplay(label, param).label).toBe('Observação do cliente');
  });

  it('é idempotente — aplicar duas vezes não muda nada', () => {
    const param: WorkflowParameter = { key: 'note', label: '@com.acme.auto/parameter.note', type: 'String' };
    const once = parameterForDisplay(label, param);
    expect(parameterForDisplay(label, once)).toEqual(once);
  });

  it('o controle montado a partir dele não carrega referência nenhuma', () => {
    const param: WorkflowParameter = {
      key: 'dados',
      label: '@com.acme.auto/field.data',
      type: 'Object',
      fields: [{ key: 'note', label: '@com.acme.auto/parameter.note', type: 'String' }],
    };
    const inputs = flattenParameterInputs(label, parameterForDisplay(label, param));
    inputs.forEach((input) => expect(input.label.startsWith('@')).toBe(false));
  });

  /**
   * A REGRESSÃO que este teste guarda: o rótulo de uma lista é a única referência que o próprio
   * `flattenParameterInputs` inventa, e ela não vinha de `parameterForDisplay`. Ninguém a resolvia,
   * e o Step "Chamar Workflow" desenhava "{name} (lista)" cru em cima de cada parâmetro de lista.
   */
  it('o parâmetro de LISTA também chega resolvido, com o nome interpolado', () => {
    const param: WorkflowParameter = {
      key: 'reclamantes',
      label: '@com.acme.auto/parameter.claimants',
      type: 'Object',
      list: true,
      fields: [{ key: 'name', label: 'Nome', type: 'String' }],
    };
    const [input] = flattenParameterInputs(label, parameterForDisplay(label, param));

    expect(input.id).toBe('param.reclamantes');
    expect(input.label).toBe(
      'traduzido(core.automation/output.list)[name=traduzido(com.acme.auto/parameter.claimants)]',
    );
  });
});
