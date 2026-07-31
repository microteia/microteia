import { describe, expect, it } from 'vitest';
import type { CustomFieldType, FieldDefinition } from '../../domain/entities';
import type { EntityKey } from '../../domain/schema/entityRegistry';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import { deriveBuiltinListRows, deriveFormFields, deriveListRows } from './deriveEntitySchema';
import { SCREEN_ICON_KEYS } from './screenIcons';

const CONTROL_TYPES: CustomFieldType[] = [
  'text', 'textarea', 'number', 'currency', 'date', 'checkbox', 'select', 'masked', 'reference', 'markdown',
];

const emptyCtx = createSchemaContext();

const byKey = (fields: FieldDefinition[]): Map<string, FieldDefinition> =>
  new Map(fields.map((field) => [field.key, field]));

describe('deriveFormFields — campos fixos derivam do ENTITY_REGISTRY como FieldDefinition', () => {
  const fields = deriveFormFields(emptyCtx, 'persons');
  const map = byKey(fields);

  it('todo campo derivado é um FieldDefinition válido (mesmo modelo dos campos dinâmicos)', () => {
    for (const field of fields) {
      expect(typeof field.key).toBe('string');
      expect(typeof field.label).toBe('string');
      expect(typeof field.required).toBe('boolean');
      expect(typeof field.order).toBe('number');
      expect(CONTROL_TYPES).toContain(field.type);
    }
  });

  it('control derivado do tipo/negócio; regras de negócio vindas do NativeFieldSpec', () => {
    expect(map.get('type')).toMatchObject({ type: 'select', required: true, optionsAllowUserAdd: true, lookupCollection: 'personTypes' });
    expect(map.get('name')).toMatchObject({ type: 'text', required: true });
    expect(map.get('cpf')?.type).toBe('masked');
    expect(map.get('cpf')?.mask).toBe('cpf');
    expect(map.get('cpf')?.logic?.hiddenWhen).toBeTruthy();
    expect(map.get('email')?.type).toBe('text');
    expect(map.get('birthDate')?.type).toBe('date');
    expect(map.get('notes')?.type).toBe('textarea');
  });

  it('achata objeto em chaves-com-ponto e preserva lookup/opções', () => {
    expect(map.get('address.city')).toMatchObject({ type: 'select', lookupCollection: 'personCities', section: 'Endereço' });
    expect(map.get('address.state')?.type).toBe('select');
    expect(map.get('address.state')?.options).toHaveLength(27);
    expect(map.get('address.zipCode')?.mask).toBe('cep');
  });

  it('respeita ui.form:false (status não entra no formulário)', () => {
    expect(map.has('status')).toBe(false);
  });

  it('não deriva o FK de etiquetas como campo (quem trata é o TagManager)', () => {
    expect(map.has('tagIds')).toBe(false);
  });
});

describe('deriveFormFields — relações (fks) viram campos reference', () => {
  const map = byKey(deriveFormFields(emptyCtx, 'deadlines'));

  it('deriva o FK como reference apontando para a coleção alvo', () => {
    expect(map.get('caseId')).toMatchObject({ type: 'reference', refEntity: 'cases', required: true });
    expect(map.get('responsibleLawyerId')).toMatchObject({ type: 'reference', refEntity: 'persons' });
  });

  it('mantém campos e relações ordenados por ui.order', () => {
    const fields = deriveFormFields(emptyCtx, 'deadlines');
    const orders = fields.map((f) => f.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(fields.map((f) => f.key)).toEqual(
      ['type', 'priority', 'caseId', 'dueDate', 'completedAt', 'responsibleLawyerId', 'description'],
    );
  });

  it('campos derivados (status) e observações ficam fora do formulário', () => {
    expect(map.has('status')).toBe(false);
    expect(map.has('notes')).toBe(false);
  });
});

describe('deriveFormFields — financials', () => {
  const map = byKey(deriveFormFields(emptyCtx, 'financials'));

  it('valor usa controle de moeda e obrigatórios vêm do registry', () => {
    expect(map.get('amount')).toMatchObject({ type: 'currency', required: true });
    expect(map.get('category')).toMatchObject({ type: 'select', required: true, lookupCollection: 'financialCategories' });
    expect(map.get('status')).toMatchObject({ type: 'select', required: true, optionsColored: true });
    expect(map.get('dueDate')).toMatchObject({ type: 'date', required: true });
  });

  it('centro de custo aponta para o lookup compartilhado com Contratos', () => {
    expect(map.get('costCenter')?.lookupCollection).toBe('contractCostCenters');
  });

  it('as três relações viram campos reference', () => {
    expect(map.get('caseId')).toMatchObject({ type: 'reference', refEntity: 'cases' });
    expect(map.get('personId')).toMatchObject({ type: 'reference', refEntity: 'persons' });
    expect(map.get('contractId')).toMatchObject({ type: 'reference', refEntity: 'contracts' });
  });
});

describe('deriveFormFields — contracts', () => {
  const map = byKey(deriveFormFields(emptyCtx, 'contracts'));

  it('as partes são relações múltiplas para pessoas', () => {
    expect(map.get('contractorIds')).toMatchObject({ type: 'reference', refEntity: 'persons', multi: true });
    expect(map.get('witnessIds')).toMatchObject({ type: 'reference', refEntity: 'persons', multi: true });
  });

  it('o tipo vem de uma lista e o valor total é moeda', () => {
    expect(map.get('type')).toMatchObject({ type: 'select', lookupCollection: 'contractTypes' });
    expect(map.get('totalValue')?.type).toBe('currency');
  });
});

// `ui.list.icon` é string livre: um nome errado cai no ícone de fallback silenciosamente.
describe('todo ícone declarado em ui.list existe no catálogo', () => {
  const ENTITIES: EntityKey[] = ['persons', 'contracts', 'deadlines', 'financials'];

  it.each(ENTITIES)('%s', (entity) => {
    for (const row of deriveBuiltinListRows(entity)) {
      expect(SCREEN_ICON_KEYS, `ícone "${row.icon}" (campo ${row.key})`).toContain(row.icon);
    }
  });
});

describe('nenhuma entidade expõe o FK de etiquetas no formulário', () => {
  it.each(['persons', 'contracts', 'financials'] as const)('%s', (entity) => {
    expect(deriveFormFields(emptyCtx, entity).some((f) => f.key === 'tagIds')).toBe(false);
  });
});

describe('deriveListRows — linhas do card derivam de ui.list, ordenadas', () => {
  it('retorna as linhas na ordem configurada, com ícone', () => {
    const rows = deriveBuiltinListRows('persons');
    expect(rows.map((r) => r.key)).toEqual(['cpf', 'cnpj', 'email', 'phone', 'occupation', 'address.city']);
    for (const row of rows) expect(row.icon).toBeTruthy();
  });

  it('carrega o controle do campo, para o card formatar moeda/data', () => {
    const rows = deriveBuiltinListRows('contracts');
    expect(rows.find((r) => r.key === 'totalValue')?.type).toBe('currency');
  });

  it('deriva também as relações, marcando a entidade alvo para resolver o rótulo', () => {
    const rows = deriveBuiltinListRows('deadlines');
    expect(rows.find((r) => r.key === 'responsibleLawyerId')).toMatchObject({
      type: 'reference',
      refEntity: 'persons',
    });
  });

  it('ordena campos e relações juntos pelo ui.list.order', () => {
    const keys = deriveBuiltinListRows('persons').map((r) => r.key);
    expect(keys).toStrictEqual(['cpf', 'cnpj', 'email', 'phone', 'occupation', 'address.city']);
  });
});

describe('deriveListRows — coleção sem entidade no registro', () => {
  it('não tem linha declarada em código: devolve vazio em vez de estourar', () => {
    expect(deriveBuiltinListRows('medico')).toEqual([]);
  });
});

describe('ui.filter vira filtro da listagem', () => {
  it('os campos que o registro marca com ui.filter chegam filtráveis', () => {
    const fields = deriveFormFields(emptyCtx, 'contracts');
    expect(fields.some((field) => field.filterable)).toBe(false);
  });

  it('a declaração de tela leva o mesmo sinal', () => {
    const ctx = createSchemaContext([{
      id: 'processos', collection: 'cases', titleSingular: 'Processo', titleFieldKey: 'title',
      fields: [
        { key: 'title', label: 'Título', type: 'text', required: true, order: 0, origin: 'plugin' },
        { key: 'status', label: 'Status', type: 'select', required: false, order: 1, origin: 'plugin', filterable: true },
      ],
    }]);
    const fields = deriveFormFields(ctx, 'cases');
    expect(fields.find((field) => field.key === 'status')?.filterable).toBe(true);
    expect(fields.find((field) => field.key === 'title')?.filterable).toBe(false);
  });
});

/**
 * O teste que guarda o objetivo da migração: uma TELA sozinha — sem nenhuma entrada no
 * `entityRegistry` — precisa descrever a coleção por inteiro, card incluído. É essa propriedade que
 * permitirá remover `cases` (e as demais entidades de escritório) do kernel sem perder nada.
 */
describe('uma tela declara a coleção sem ajuda do registro', () => {
  const declared: FieldDefinition[] = [
    { key: 'title', label: 'Título', type: 'text', required: true, order: 0, origin: 'plugin' },
    {
      key: 'area', label: 'Área', type: 'select', required: false, order: 1, origin: 'plugin',
      lookupCollection: 'caseAreas', showInList: true, listIcon: 'scales', filterable: true,
    },
    {
      key: 'responsibleLawyerId', label: 'Advogado responsável', type: 'reference', required: false,
      order: 2, origin: 'plugin', refEntity: 'persons', showInList: true, listIcon: 'scales',
    },
  ];
  const ctx = createSchemaContext([
    { id: 'processos_ext', collection: 'processos', titleSingular: 'Processo', titleFieldKey: 'title', fields: declared },
  ]);

  it('os campos declarados viram o formulário da coleção', () => {
    expect(deriveFormFields(ctx, 'processos').map((field) => field.key))
      .toEqual(['title', 'area', 'responsibleLawyerId']);
  });

  it('o ícone de listagem declarado vira meta-linha do card, como o ui.list do registro', () => {
    expect(deriveListRows(ctx, 'processos')).toEqual([
      { key: 'area', icon: 'scales', type: 'select', refEntity: undefined },
      { key: 'responsibleLawyerId', icon: 'scales', type: 'reference', refEntity: 'persons' },
    ]);
  });

  it('a tela não reivindica o próprio nome como coleção', () => {
    expect(deriveFormFields(ctx, 'processos_ext')).toEqual([]);
  });
});

describe('duas telas descrevendo a mesma coleção', () => {
  const pluginScreen = {
    id: 'processos',
    collection: 'cases',
    titleSingular: 'Processo',
    titlePlural: 'Processos',
    titleFieldKey: 'title',
    fields: [{ key: 'area', label: 'Área do processo', type: 'select' as const, required: false, order: 1, origin: 'plugin' as const }],
  };
  const tenantScreen = {
    id: 'cases',
    titleSingular: 'Processo',
    titleFieldKey: 'title',
    fields: [{ key: 'area', label: 'Área (ajustada)', type: 'select' as const, required: false, order: 1, origin: 'design' as const }],
  };

  it('o ajuste do escritório prevalece sobre o que a extensão declara', () => {
    const ctx = createSchemaContext([pluginScreen, tenantScreen]);
    expect(byKey(deriveFormFields(ctx, 'cases')).get('area')?.label).toBe('Área (ajustada)');
  });

  it('sem tela dona do nome, a declaração que sobrou é a que vale', () => {
    const ctx = createSchemaContext([pluginScreen]);
    expect(byKey(deriveFormFields(ctx, 'cases')).get('area')?.label).toBe('Área do processo');
  });
});

/**
 * O estado REAL quando a extensão de Processos está instalada: a declaração dela chega pela
 * coleção `cases`, sobre o que o registro do kernel já declara. O card e o formulário precisam sair
 * idênticos aos da tela nativa — nem linha a mais, nem relação duplicada.
 */
describe('extensão descrevendo uma coleção que o registro também descreve', () => {
  const screenFields: FieldDefinition[] = [
    {
      key: 'area', label: 'Área', type: 'select', required: false, order: 4, origin: 'plugin',
      lookupCollection: 'caseAreas', showInList: true, listIcon: 'scales', listOrder: 1,
    },
    {
      key: 'responsibleLawyerId', label: 'Advogado responsável', type: 'reference', required: false,
      order: 14, origin: 'plugin', refEntity: 'persons', showInList: true, listIcon: 'scales', listOrder: 0,
    },
  ];
  const ctx = createSchemaContext([
    {
      id: 'processos', collection: 'cases', titleSingular: 'Processo',
      titleFieldKey: 'title', fields: screenFields,
    },
  ]);

  it('as meta-linhas do card saem da declaração da tela, na ordem declarada', () => {
    expect(deriveListRows(ctx, 'cases').map((row) => row.key))
      .toEqual(['responsibleLawyerId', 'area']);
  });

  it('a relação declarada pela tela não duplica a `fk` de mesmo nome', () => {
    const keys = deriveFormFields(ctx, 'cases').map((field) => field.key);
    expect(keys.filter((key) => key === 'responsibleLawyerId')).toHaveLength(1);
    expect(keys).toHaveLength(new Set(keys).size);
  });

  it('a declaração da extensão vence a do registro no campo que as duas descrevem', () => {
    const rows = deriveListRows(ctx, 'cases');
    expect(rows.find((row) => row.key === 'responsibleLawyerId')?.refEntity).toBe('persons');
  });
});
