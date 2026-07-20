import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import { createSchemaContext } from './pathResolver';
import type { SchemaScreen } from './pathResolver';
import { computeFieldValues, formatAndValidateRecord } from './recordRules';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

const screens: SchemaScreen[] = [
  {
    id: 'persons',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [
      field({
        key: 'registro',
        label: 'Registro OAB',
        rules: {
          format: { preset: 'upper' },
          validate: { pattern: '^[A-Z]{2}\\d{6}$', message: 'Use UF + 6 dígitos' },
        },
      }),
    ],
  },
  {
    id: 'audiencias',
    titleSingular: 'Audiência',
    titleFieldKey: 'title',
    fields: [
      field({ key: 'protocolo', label: 'Protocolo', rules: { format: { preset: 'digits' } } }),
      field({ key: 'obs', label: 'Observação' }),
    ],
  },
];

const ctx = createSchemaContext(screens);

describe('formatAndValidateRecord — campos nativos', () => {
  it('formata e valida um campo nativo com regra', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', { cpf: '529.982.247-25', name: 'Ana' });
    expect(outcome.data).toEqual({ cpf: '52998224725', name: 'Ana' });
    expect(outcome.issues).toHaveLength(0);
  });

  it('reprova um CPF com dígito verificador inválido', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', { cpf: '11111111111' });
    expect(outcome.issues).toEqual([
      { path: 'cpf', label: 'CPF', error: 'CPF inválido' },
    ]);
  });

  it('nunca reprova campo vazio ou ausente', () => {
    expect(formatAndValidateRecord(ctx, 'persons', { cpf: '' }).issues).toHaveLength(0);
    expect(formatAndValidateRecord(ctx, 'persons', { cpf: null }).issues).toHaveLength(0);
    expect(formatAndValidateRecord(ctx, 'persons', { name: 'Ana' }).issues).toHaveLength(0);
  });

  it('alcança campo dentro de objeto aninhado', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', {
      address: { street: 'Rua A', zipCode: '01310-100' },
    });
    expect(outcome.data).toEqual({ address: { street: 'Rua A', zipCode: '01310100' } });
    expect(outcome.issues).toHaveLength(0);
  });

  it('preserva intactas as folhas sem regra', () => {
    const data = { notes: '  espaços  ', tagIds: ['a', 'b'], status: 'Ativo' };
    const outcome = formatAndValidateRecord(ctx, 'persons', data);
    expect(outcome.data).toEqual(data);
    expect(outcome.issues).toHaveLength(0);
  });
});

describe('formatAndValidateRecord — campos dinâmicos', () => {
  it('aplica regras de campo dinâmico sob customValues', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', {
      customValues: { registro: 'sp123456' },
    });
    expect(outcome.data).toEqual({ customValues: { registro: 'SP123456' } });
    expect(outcome.issues).toHaveLength(0);
  });

  it('reprova campo dinâmico fora do padrão', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', {
      customValues: { registro: 'sp12' },
    });
    expect(outcome.issues).toEqual([
      { path: 'customValues.registro', label: 'Registro OAB', error: 'Use UF + 6 dígitos' },
    ]);
  });

  it('aplica regras em entidade customizada sob values', () => {
    const outcome = formatAndValidateRecord(ctx, 'audiencias', {
      values: { protocolo: 'nº 12.345', obs: 'manter' },
    });
    expect(outcome.data).toEqual({ values: { protocolo: '12345', obs: 'manter' } });
    expect(outcome.issues).toHaveLength(0);
  });
});

const logicScreens: SchemaScreen[] = [
  {
    id: 'equipamentos',
    titleSingular: 'Equipamento',
    titleFieldKey: 'nome',
    fields: [
      field({ key: 'eletrico', label: 'Elétrico', type: 'checkbox' }),
      field({
        key: 'liberacao',
        label: 'Número liberação',
        rules: { format: { preset: 'digits' } },
        logic: { validate: 'if(eletrico == true and isEmpty(value), "Obrigatório para elétricos", null)' },
      }),
    ],
  },
];
const logicCtx = createSchemaContext(logicScreens);

describe('formatAndValidateRecord — validação por expressão', () => {
  it('dispara a mensagem da expressão sobre valores customizados', () => {
    const outcome = formatAndValidateRecord(logicCtx, 'equipamentos', {
      values: { eletrico: true, liberacao: '' },
    });
    expect(outcome.issues).toEqual([
      { path: 'values.liberacao', label: 'Número liberação', error: 'Obrigatório para elétricos' },
    ]);
  });

  it('não dispara quando a condição é falsa', () => {
    const outcome = formatAndValidateRecord(logicCtx, 'equipamentos', {
      values: { eletrico: false, liberacao: '' },
    });
    expect(outcome.issues).toHaveLength(0);
  });

  it('a expressão vê o valor JÁ formatado (format roda antes)', () => {
    const outcome = formatAndValidateRecord(logicCtx, 'equipamentos', {
      values: { eletrico: true, liberacao: 'abc123' },
    });
    expect(outcome.data).toEqual({ values: { eletrico: true, liberacao: '123' } });
    expect(outcome.issues).toHaveLength(0);
  });

  it('coexiste com a validação por regra (FieldRules) no mesmo registro', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', {
      customValues: { registro: 'sp12' },
    });
    expect(outcome.issues).toEqual([
      { path: 'customValues.registro', label: 'Registro OAB', error: 'Use UF + 6 dígitos' },
    ]);
  });
});

const computeScreens: SchemaScreen[] = [
  {
    id: 'itens',
    titleSingular: 'Item',
    titleFieldKey: 'descricao',
    fields: [
      field({ key: 'nome', label: 'Nome' }),
      field({ key: 'sobrenome', label: 'Sobrenome' }),
      field({ key: 'quantidade', label: 'Quantidade', type: 'number' }),
      field({ key: 'precoUnitario', label: 'Preço unitário', type: 'currency' }),
      field({
        key: 'nomeCompleto',
        label: 'Nome completo',
        logic: { compute: "trim(concat(nome, ' ', sobrenome))" },
      }),
      field({
        key: 'total',
        label: 'Total',
        type: 'currency',
        logic: { compute: 'quantidade * precoUnitario' },
      }),
      field({
        key: 'resumo',
        label: 'Resumo',
        logic: { compute: "concat(nomeCompleto, ' — R$ ', total)" },
      }),
    ],
  },
  {
    id: 'ciclicos',
    titleSingular: 'Cíclico',
    titleFieldKey: 'a',
    fields: [
      field({ key: 'a', label: 'A', logic: { compute: 'b' } }),
      field({ key: 'b', label: 'B', logic: { compute: 'a' } }),
      field({ key: 'ok', label: 'Ok', logic: { compute: "concat('valor')" } }),
      field({ key: 'quebrado', label: 'Quebrado', logic: { compute: 'funcaoInexistente(1)' } }),
    ],
  },
];
const computeCtx = createSchemaContext(computeScreens);

describe('formatAndValidateRecord — campos computados', () => {
  it('computa texto concatenado a partir de outros campos', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'itens', {
      values: { nome: 'Ana', sobrenome: 'Souza' },
    });
    expect((outcome.data.values as Record<string, unknown>).nomeCompleto).toBe('Ana Souza');
    expect(outcome.issues).toHaveLength(0);
  });

  it('computa valor numérico', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'itens', {
      values: { quantidade: 3, precoUnitario: 10 },
    });
    expect((outcome.data.values as Record<string, unknown>).total).toBe(30);
  });

  it('encadeia computados na ordem de dependência', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'itens', {
      values: { nome: 'Ana', sobrenome: 'Souza', quantidade: 2, precoUnitario: 5 },
    });
    expect((outcome.data.values as Record<string, unknown>).resumo).toBe('Ana Souza — R$ 10');
  });

  it('usa o baseline quando o payload é parcial', () => {
    const outcome = formatAndValidateRecord(
      computeCtx,
      'itens',
      { values: { quantidade: 4 } },
      { baseline: { values: { quantidade: 1, precoUnitario: 10 } } },
    );
    expect((outcome.data.values as Record<string, unknown>).total).toBe(40);
  });

  it('sem baseline, dependência ausente pula o campo em vez de gravar lixo', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'itens', { values: { quantidade: 4 } });
    const values = outcome.data.values as Record<string, unknown>;
    expect(values).not.toHaveProperty('total');
    expect(values.quantidade).toBe(4);
    expect(outcome.issues).toHaveLength(0);
  });

  it('descarta campos em ciclo sem lançar, mantendo os demais', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'ciclicos', { values: {} });
    const values = outcome.data.values as Record<string, unknown>;
    expect(values.a).toBeUndefined();
    expect(values.b).toBeUndefined();
    expect(values.ok).toBe('valor');
  });

  it('ignora expressão que lança, sem bloquear a gravação', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'ciclicos', { values: {} });
    expect((outcome.data.values as Record<string, unknown>).quebrado).toBeUndefined();
    expect(outcome.issues).toHaveLength(0);
  });

  it('computa em campo dinâmico de entidade fixa, sob customValues', () => {
    const outcome = formatAndValidateRecord(
      createSchemaContext([
        {
          id: 'persons',
          titleSingular: 'Pessoa',
          titleFieldKey: 'name',
          fields: [
            field({ key: 'apelido', label: 'Apelido' }),
            field({ key: 'saudacao', label: 'Saudação', logic: { compute: "concat('Olá, ', apelido)" } }),
          ],
        },
      ]),
      'persons',
      { customValues: { apelido: 'Ana' } },
    );
    expect((outcome.data.customValues as Record<string, unknown>).saudacao).toBe('Olá, Ana');
  });
});

describe('computeFieldValues — preview do formulário', () => {
  it('devolve apenas os campos calculados, na ordem de dependência', () => {
    const values = computeFieldValues(computeScreens[0].fields, {
      nome: 'Ana',
      sobrenome: 'Souza',
      quantidade: 2,
      precoUnitario: 5,
    });
    expect(values).toEqual({ nomeCompleto: 'Ana Souza', total: 10, resumo: 'Ana Souza — R$ 10' });
  });

  it('devolve objeto vazio quando nenhum campo é calculado', () => {
    expect(computeFieldValues([field({ key: 'nome', label: 'Nome' })], { nome: 'Ana' })).toEqual({});
  });
});

describe('formatAndValidateRecord — transparência', () => {
  it('não altera nada em tabela sem regras', () => {
    const data = { key: 'x', label: 'X' };
    const outcome = formatAndValidateRecord(ctx, 'personTypes', data);
    expect(outcome.data).toEqual(data);
    expect(outcome.issues).toHaveLength(0);
  });
});
