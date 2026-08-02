import { describe, expect, it } from 'vitest';
import type { CustomFieldType, FieldDefinition } from '../../domain/entities';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import { deriveFormFields, deriveListRows } from './deriveEntitySchema';
import { SCREEN_ICON_KEYS } from './screenIcons';
import { MARKETPLACE_CATALOG } from '../../plugins/marketplace/catalog';
import { pessoaPlugin } from '../../plugins/marketplace/pessoa';
import { prazoPlugin } from '../../plugins/marketplace/prazo';

const CONTROL_TYPES: CustomFieldType[] = [
  'text', 'textarea', 'number', 'currency', 'date', 'checkbox', 'select', 'masked', 'reference', 'markdown',
];

const emptyCtx = createSchemaContext();

/**
 * Pessoa saiu do kernel: o formulário e o card dela nascem da TELA que a extensão declara. O
 * contexto abaixo é o pacote real — é o que prova que a extensão reproduz o que o registro fazia.
 */
const pessoaScreen = pessoaPlugin.screens![0];
const pessoaCtx = createSchemaContext([{
  id: pessoaScreen.key,
  collection: pessoaScreen.dataCollection,
  titleSingular: pessoaScreen.titleSingular,
  titlePlural: pessoaScreen.titlePlural,
  titleFieldKey: pessoaScreen.titleFieldKey,
  fields: pessoaScreen.fields.map((field) => ({ ...field, origin: 'plugin' as const })),
}]);

/** Prazo saiu do kernel junto com Pessoa — e é ele que traz relações (processo, advogado). */
const prazoScreen = prazoPlugin.screens![0];
const prazoCtx = createSchemaContext([{
  id: prazoScreen.key,
  collection: prazoScreen.dataCollection,
  titleSingular: prazoScreen.titleSingular,
  titlePlural: prazoScreen.titlePlural,
  titleFieldKey: prazoScreen.titleFieldKey,
  fields: prazoScreen.fields.map((field) => ({ ...field, origin: 'plugin' as const })),
}]);

const byKey = (fields: FieldDefinition[]): Map<string, FieldDefinition> =>
  new Map(fields.map((field) => [field.key, field]));

describe('deriveFormFields — a tela declarada vira FieldDefinition, como os campos fixos', () => {
  const fields = deriveFormFields(pessoaCtx, 'persons');
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

  it('não deriva o FK de etiquetas como campo (quem trata é o TagManager)', () => {
    expect(map.has('tagIds')).toBe(false);
  });
});

describe('deriveFormFields — a relação declarada vira campo reference', () => {
  const map = byKey(deriveFormFields(prazoCtx, 'deadlines'));

  it('a relação aponta para a coleção alvo', () => {
    expect(map.get('caseId')).toMatchObject({ type: 'reference', refEntity: 'cases', required: true });
    expect(map.get('responsibleLawyerId')).toMatchObject({ type: 'reference', refEntity: 'persons' });
  });

  it('mantém os campos na ordem declarada', () => {
    const fields = deriveFormFields(prazoCtx, 'deadlines');
    const orders = fields.map((f) => f.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(fields.map((f) => f.key)).toEqual(
      ['type', 'priority', 'status', 'caseId', 'dueDate', 'completedAt', 'responsibleLawyerId', 'description'],
    );
  });
});

// `listIcon` é string livre: um nome errado cai no ícone de fallback silenciosamente.
describe('todo ícone de listagem declarado por uma extensão existe no catálogo', () => {
  it.each(MARKETPLACE_CATALOG.map((plugin) => [plugin.manifest.name, plugin] as const))(
    '%s',
    (_name, plugin) => {
      for (const screen of plugin.screens ?? []) {
        for (const field of screen.fields) {
          if (!field.listIcon) continue;
          expect(SCREEN_ICON_KEYS, `ícone "${field.listIcon}" (campo ${field.key})`).toContain(field.listIcon);
        }
      }
    },
  );
});

describe('deriveListRows — linhas do card derivam de ui.list, ordenadas', () => {
  it('retorna as linhas na ordem configurada, com ícone', () => {
    const rows = deriveListRows(pessoaCtx, 'persons').filter((row) => row.key !== 'type');
    expect(rows.map((r) => r.key)).toEqual(['cpf', 'cnpj', 'email', 'phone', 'occupation', 'address.city']);
    for (const row of rows) expect(row.icon).toBeTruthy();
  });

  it('carrega o controle do campo, para o card formatar moeda/data', () => {
    const rows = deriveListRows(prazoCtx, 'deadlines');
    expect(rows.find((r) => r.key === 'dueDate')?.type).toBe('date');
  });

  it('deriva também as relações, marcando a entidade alvo para resolver o rótulo', () => {
    const rows = deriveListRows(prazoCtx, 'deadlines');
    expect(rows.find((r) => r.key === 'responsibleLawyerId')).toMatchObject({
      type: 'reference',
      refEntity: 'persons',
    });
  });

  it('ordena campos e relações juntos pelo ui.list.order', () => {
    const keys = deriveListRows(pessoaCtx, 'persons').filter((row) => row.key !== 'type').map((r) => r.key);
    expect(keys).toStrictEqual(['cpf', 'cnpj', 'email', 'phone', 'occupation', 'address.city']);
  });
});

describe('deriveListRows — coleção sem entidade no registro', () => {
  it('não tem linha declarada em código: devolve vazio em vez de estourar', () => {
    expect(deriveListRows(emptyCtx, 'medico')).toEqual([]);
  });
});

describe('a marca de filtro atravessa a derivação', () => {
  it('a declaração de tela leva o sinal até o campo derivado', () => {
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
