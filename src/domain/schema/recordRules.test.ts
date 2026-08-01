import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import { createSchemaContext } from './pathResolver';
import type { SchemaScreen } from './pathResolver';
import { computeFieldValues, formatAndValidateRecord } from './recordRules';
import { BR_FIELD_RULE_PRESETS } from '../../plugins/marketplace/brasil';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
  origin: 'design',
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

/**
 * Pessoa é declarada por extensão: máscara, formatação e validação (inclusive o dígito verificador
 * do CPF) vêm da TELA, e valem igual na gravação por automação — que é o que este arquivo cobre.
 */
const screens: SchemaScreen[] = [
  {
    id: 'pessoas',
    collection: 'persons',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [
      field({ key: 'name', label: 'Nome' }),
      field({
        key: 'cpf',
        label: 'CPF',
        type: 'masked',
        mask: 'cpf',
        rules: { format: { preset: 'digits' }, validate: { check: 'cpf' } },
      }),
      field({
        key: 'address.zipCode',
        label: 'CEP',
        type: 'masked',
        mask: 'cep',
        rules: { format: { preset: 'digits' }, validate: { pattern: '^\\d{8}$', message: 'CEP deve ter 8 dígitos' } },
      }),
      field({ key: 'address.street', label: 'Rua' }),
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
      field({ key: 'data', label: 'Data da audiência', type: 'date' }),
      field({ key: 'sala', label: 'Sala', type: 'number' }),
      field({ key: 'virtual', label: 'Virtual', type: 'checkbox' }),
    ],
  },
];

// O escritório tem a extensão do Brasil instalada — é dela que vêm CPF e CEP.
const ctx = createSchemaContext(screens, [], [], BR_FIELD_RULE_PRESETS);

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
  it('aplica regras de campo declarado pelo tenant numa entidade fixa', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', {
      registro: 'sp123456',
    });
    expect(outcome.data).toEqual({ registro: 'SP123456' });
    expect(outcome.issues).toHaveLength(0);
  });

  it('reprova campo dinâmico fora do padrão', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', {
      registro: 'sp12',
    });
    expect(outcome.issues).toEqual([
      { path: 'registro', label: 'Registro OAB', error: 'Use UF + 6 dígitos' },
    ]);
  });

  it('aplica regras numa tela do Form Design', () => {
    const outcome = formatAndValidateRecord(ctx, 'audiencias', {
      protocolo: 'nº 12.345', obs: 'manter',
    });
    expect(outcome.data).toEqual({ protocolo: '12345', obs: 'manter' });
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
      eletrico: true, liberacao: '',
    });
    expect(outcome.issues).toEqual([
      { path: 'liberacao', label: 'Número liberação', error: 'Obrigatório para elétricos' },
    ]);
  });

  it('não dispara quando a condição é falsa', () => {
    const outcome = formatAndValidateRecord(logicCtx, 'equipamentos', {
      eletrico: false, liberacao: '',
    });
    expect(outcome.issues).toHaveLength(0);
  });

  it('a expressão vê o valor JÁ formatado (format roda antes)', () => {
    const outcome = formatAndValidateRecord(logicCtx, 'equipamentos', {
      eletrico: true, liberacao: 'abc123',
    });
    expect(outcome.data).toEqual({ eletrico: true, liberacao: '123' });
    expect(outcome.issues).toHaveLength(0);
  });

  it('coexiste com a validação por regra (FieldRules) no mesmo registro', () => {
    const outcome = formatAndValidateRecord(ctx, 'persons', {
      registro: 'sp12',
    });
    expect(outcome.issues).toEqual([
      { path: 'registro', label: 'Registro OAB', error: 'Use UF + 6 dígitos' },
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
      nome: 'Ana', sobrenome: 'Souza',
    });
    expect(outcome.data.nomeCompleto).toBe('Ana Souza');
    expect(outcome.issues).toHaveLength(0);
  });

  it('computa valor numérico', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'itens', {
      quantidade: 3, precoUnitario: 10,
    });
    expect(outcome.data.total).toBe(30);
  });

  it('encadeia computados na ordem de dependência', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'itens', {
      nome: 'Ana', sobrenome: 'Souza', quantidade: 2, precoUnitario: 5,
    });
    expect(outcome.data.resumo).toBe('Ana Souza — R$ 10');
  });

  it('usa o baseline quando o payload é parcial', () => {
    const outcome = formatAndValidateRecord(
      computeCtx,
      'itens',
      { quantidade: 4 },
      { baseline: { quantidade: 1, precoUnitario: 10 } },
    );
    expect(outcome.data.total).toBe(40);
  });

  it('sem baseline, dependência ausente pula o campo em vez de gravar lixo', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'itens', { quantidade: 4 });
    const values = outcome.data;
    expect(values).not.toHaveProperty('total');
    expect(values.quantidade).toBe(4);
    expect(outcome.issues).toHaveLength(0);
  });

  it('descarta campos em ciclo sem lançar, mantendo os demais', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'ciclicos', { values: {} });
    const values = outcome.data;
    expect(values.a).toBeUndefined();
    expect(values.b).toBeUndefined();
    expect(values.ok).toBe('valor');
  });

  it('ignora expressão que lança, sem bloquear a gravação', () => {
    const outcome = formatAndValidateRecord(computeCtx, 'ciclicos', { values: {} });
    expect(outcome.data.quebrado).toBeUndefined();
    expect(outcome.issues).toHaveLength(0);
  });

  it('computa em campo declarado pelo tenant numa entidade fixa', () => {
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
      { apelido: 'Ana' },
    );
    expect(outcome.data.saudacao).toBe('Olá, Ana');
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

describe('formatAndValidateRecord — tipo declarado', () => {
  it('grava a data do formulário como Date, no dia escolhido', () => {
    const outcome = formatAndValidateRecord(ctx, 'audiencias', { data: '2026-07-15' });
    const value = outcome.data.data as Date;

    expect(value).toBeInstanceOf(Date);
    expect([value.getFullYear(), value.getMonth() + 1, value.getDate()]).toEqual([2026, 7, 15]);
  });

  it('a data de uma tela do tenant é gravada como a de uma tela fixa', () => {
    const doTenant = formatAndValidateRecord(ctx, 'audiencias', { data: '2026-07-15' }).data.data;
    const fixa = formatAndValidateRecord(ctx, 'deadlines', { dueDate: '2026-07-15' }).data.dueDate;

    expect(doTenant).toEqual(fixa);
  });

  it('data vazia é ausência de data, não texto vazio', () => {
    expect(formatAndValidateRecord(ctx, 'audiencias', { data: '' }).data.data).toBeNull();
    expect(formatAndValidateRecord(ctx, 'audiencias', { data: null }).data.data).toBeNull();
  });

  it('preserva a Date que já chega pronta do motor de workflows', () => {
    const date = new Date(2026, 6, 15);
    expect(formatAndValidateRecord(ctx, 'audiencias', { data: date }).data.data).toBe(date);
  });

  it('número e booleano também seguem o tipo declarado', () => {
    const outcome = formatAndValidateRecord(ctx, 'audiencias', { sala: '12', virtual: 'true' });
    expect(outcome.data).toEqual({ sala: 12, virtual: true });
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
