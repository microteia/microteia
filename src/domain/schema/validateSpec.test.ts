import { describe, expect, it } from 'vitest';
import type { WorkflowParameter } from '../entities/Workflow';
import { createSchemaContext } from './pathResolver';
import { validateObject } from './validateSpec';
import { BR_FIELD_RULE_PRESETS } from '../../plugins/marketplace/brasil';

/** Pessoa vem de extensão: é a TELA que declara o CPF e a validação do dígito verificador. */
const ctx = createSchemaContext([
  {
    id: 'pessoas',
    collection: 'persons',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: false, order: 0, origin: 'plugin' },
      {
        key: 'cpf', label: 'CPF', type: 'masked', mask: 'cpf', required: false, order: 1, origin: 'plugin',
        rules: { format: { preset: 'digits' }, validate: { check: 'cpf' } },
      },
    ],
  },
], [], [], BR_FIELD_RULE_PRESETS);

const param = (overrides: Partial<WorkflowParameter> & Pick<WorkflowParameter, 'key'>): WorkflowParameter => ({
  label: overrides.key,
  type: 'String',
  ...overrides,
});

describe('validateObject — só entidade', () => {
  it('valida o objeto inteiro pelo schema da entidade', () => {
    const outcome = validateObject(
      ctx,
      { source: 'input', entityType: 'persons', outputName: 'person' },
      { name: 'Ana', cpf: '529.982.247-25' },
    );
    expect(outcome.value).toEqual({ name: 'Ana', cpf: '52998224725' });
    expect(outcome.issues).toHaveLength(0);
  });

  it('reprova pelo schema da entidade', () => {
    const outcome = validateObject(
      ctx,
      { source: 'input', entityType: 'persons', outputName: 'person' },
      { cpf: '11111111111' },
    );
    expect(outcome.issues).toHaveLength(1);
    expect(outcome.issues[0].error).toBe('CPF inválido');
  });
});

describe('validateObject — entidade + parâmetros', () => {
  it('as regras dos parâmetros sobrepõem as do schema', () => {
    const outcome = validateObject(
      ctx,
      {
        source: 'input',
        entityType: 'persons',
        outputName: 'person',
        parameters: [
          param({ key: 'cpf', label: 'CPF', rules: { format: { preset: 'cpf' }, validate: { pattern: '^\\d{3}\\.' } } }),
        ],
      },
      { name: 'Ana', cpf: '11111111111' },
    );
    expect(outcome.issues).toHaveLength(0);
    expect(outcome.value).toEqual({ name: 'Ana', cpf: '111.111.111-11' });
  });

  it('a saída continua sendo o objeto inteiro da entidade', () => {
    const outcome = validateObject(
      ctx,
      {
        source: 'input',
        entityType: 'persons',
        outputName: 'person',
        parameters: [param({ key: 'email', label: 'E-mail' })],
      },
      { name: 'Ana', email: 'a@b.com', notes: 'x' },
    );
    expect(outcome.value).toEqual({ name: 'Ana', email: 'a@b.com', notes: 'x' });
  });
});

describe('validateObject — só parâmetros', () => {
  it('a saída é um objeto anônimo formado pelos parâmetros', () => {
    const outcome = validateObject(
      ctx,
      {
        source: 'input',
        outputName: 'dados',
        parameters: [
          param({ key: 'documento', label: 'Documento', rules: { format: { preset: 'digits' }, validate: { check: 'cpf' } } }),
        ],
      },
      { documento: '529.982.247-25', lixo: 'descartado' },
    );
    expect(outcome.value).toEqual({ documento: '52998224725' });
    expect(outcome.issues).toHaveLength(0);
  });

  it('exige os parâmetros obrigatórios', () => {
    const outcome = validateObject(
      ctx,
      { source: 'input', outputName: 'dados', parameters: [param({ key: 'nome', label: 'Nome', required: true })] },
      {},
    );
    expect(outcome.issues).toEqual([
      {
        path: 'nome',
        label: 'Nome',
        error: '@core.automation/parameter.required',
        errorParams: { label: 'Nome' },
      },
    ]);
  });
});
