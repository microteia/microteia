import { describe, expect, it } from 'vitest';
import type { CustomFieldType, FieldDefinition } from '../../domain/entities';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import { deriveFormFields, deriveListRows } from './deriveEntitySchema';
import { SCREEN_ICON_KEYS } from './screenIcons';
import { MARKETPLACE_CATALOG } from '../../plugins/marketplace/catalog';

const CONTROL_TYPES: CustomFieldType[] = [
  'text', 'textarea', 'number', 'currency', 'date', 'checkbox', 'select', 'masked', 'reference', 'markdown',
];

const emptyCtx = createSchemaContext();

/**
 * Duas telas declaradas à mão, no lugar dos pacotes de extensão que este arquivo usava como fixture e
 * que hoje são mantidos fora deste repositório.
 *
 * A troca é uma melhora, não um remendo: o que se testa aqui é a DERIVAÇÃO — uma tela declarada virar
 * `FieldDefinition` e meta-linha de cartão —, e amarrá-la ao esquema de um negócio específico fazia o
 * teste falhar quando aquele negócio mudasse de campo, por um motivo que nada tem a ver com a
 * derivação. Cada declaração abaixo existe por um caso: máscara com regra de exibição, chave com
 * ponto (objeto achatado) com seção e opções literais, textarea, data, lista do escritório, relação, e
 * a ordem do cartão diferente da do formulário.
 */
const CADASTRO_FIELDS: FieldDefinition[] = [
  {
    key: 'kind', label: 'Tipo', type: 'select', required: true, order: 0, origin: 'plugin',
    lookupCollection: 'exampleKinds', optionsAllowUserAdd: true, filterable: true, listIcon: 'user',
  },
  { key: 'name', label: 'Nome', type: 'text', required: true, order: 1, origin: 'plugin' },
  {
    key: 'document', label: 'Documento', type: 'masked', required: false, order: 2, origin: 'plugin',
    mask: 'cpf', logic: { hiddenWhen: 'kind != "individual"' },
    showInList: true, listIcon: 'contacts', listOrder: 0,
  },
  {
    key: 'email', label: 'E-mail', type: 'text', required: false, order: 3, origin: 'plugin',
    showInList: true, listIcon: 'mail', listOrder: 1,
  },
  { key: 'birthDate', label: 'Nascimento', type: 'date', required: false, order: 4, origin: 'plugin' },
  {
    key: 'address.zipCode', label: 'CEP', type: 'masked', required: false, order: 5, origin: 'plugin',
    section: 'Endereço', mask: 'cep',
  },
  {
    key: 'address.city', label: 'Cidade', type: 'select', required: false, order: 6, origin: 'plugin',
    section: 'Endereço', lookupCollection: 'exampleCities',
    showInList: true, listIcon: 'map', listOrder: 2,
  },
  {
    key: 'address.state', label: 'Estado', type: 'select', required: false, order: 7, origin: 'plugin',
    section: 'Endereço',
    options: [{ key: 'BA', label: 'BA' }, { key: 'MA', label: 'MA' }, { key: 'SP', label: 'SP' }],
  },
  { key: 'notes', label: 'Observações', type: 'textarea', required: false, order: 8, origin: 'plugin' },
];

const cadastroCtx = createSchemaContext([{
  id: 'cadastros',
  collection: 'cadastros',
  titleSingular: 'Cadastro',
  titlePlural: 'Cadastros',
  titleFieldKey: 'name',
  fields: CADASTRO_FIELDS,
}]);

/** A tela que traz RELAÇÕES — e cujo cartão está em ordem diferente da do formulário. */
const TAREFA_FIELDS: FieldDefinition[] = [
  { key: 'title', label: 'Assunto', type: 'text', required: true, order: 0, origin: 'plugin' },
  {
    key: 'state', label: 'Situação', type: 'select', required: false, order: 1, origin: 'plugin',
    lookupCollection: 'exampleStates', filterable: true,
  },
  {
    key: 'parentId', label: 'Cadastro', type: 'reference', required: true, order: 2, origin: 'plugin',
    refEntity: 'cadastros',
  },
  {
    key: 'dueDate', label: 'Vencimento', type: 'date', required: false, order: 3, origin: 'plugin',
    filterable: true, showInList: true, listIcon: 'calendar', listOrder: 1,
  },
  {
    key: 'ownerId', label: 'Responsável', type: 'reference', required: false, order: 4, origin: 'plugin',
    refEntity: 'cadastros', showInList: true, listIcon: 'user', listOrder: 0,
  },
];

const tarefaCtx = createSchemaContext([{
  id: 'tarefas',
  collection: 'tarefas',
  titleSingular: 'Tarefa',
  titlePlural: 'Tarefas',
  titleFieldKey: 'title',
  fields: TAREFA_FIELDS,
}]);

const byKey = (fields: FieldDefinition[]): Map<string, FieldDefinition> =>
  new Map(fields.map((field) => [field.key, field]));

describe('deriveFormFields — a tela declarada vira FieldDefinition, como os campos fixos', () => {
  const fields = deriveFormFields(cadastroCtx, 'cadastros');
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

  it('o controle sai do tipo declarado, e a regra de exibição atravessa junto', () => {
    expect(map.get('kind')).toMatchObject({ type: 'select', required: true, optionsAllowUserAdd: true, lookupCollection: 'exampleKinds' });
    expect(map.get('name')).toMatchObject({ type: 'text', required: true });
    expect(map.get('document')?.type).toBe('masked');
    expect(map.get('document')?.mask).toBe('cpf');
    expect(map.get('document')?.logic?.hiddenWhen).toBeTruthy();
    expect(map.get('email')?.type).toBe('text');
    expect(map.get('birthDate')?.type).toBe('date');
    expect(map.get('notes')?.type).toBe('textarea');
  });

  it('achata objeto em chaves-com-ponto e preserva seção, lookup e opções literais', () => {
    expect(map.get('address.city')).toMatchObject({ type: 'select', lookupCollection: 'exampleCities', section: 'Endereço' });
    expect(map.get('address.state')?.type).toBe('select');
    expect(map.get('address.state')?.options).toHaveLength(3);
    expect(map.get('address.zipCode')?.mask).toBe('cep');
  });

  it('não deriva o FK de etiquetas como campo (quem trata é o TagManager)', () => {
    expect(map.has('tagIds')).toBe(false);
  });
});

describe('deriveFormFields — a relação declarada vira campo reference', () => {
  const map = byKey(deriveFormFields(tarefaCtx, 'tarefas'));

  it('a relação aponta para a coleção alvo', () => {
    expect(map.get('parentId')).toMatchObject({ type: 'reference', refEntity: 'cadastros', required: true });
    expect(map.get('ownerId')).toMatchObject({ type: 'reference', refEntity: 'cadastros' });
  });

  it('mantém os campos na ordem declarada', () => {
    const fields = deriveFormFields(tarefaCtx, 'tarefas');
    const orders = fields.map((field) => field.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(fields.map((field) => field.key))
      .toEqual(['title', 'state', 'parentId', 'dueDate', 'ownerId']);
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
    const rows = deriveListRows(cadastroCtx, 'cadastros').filter((row) => row.key !== 'kind');
    expect(rows.map((row) => row.key)).toEqual(['document', 'email', 'address.city']);
    for (const row of rows) expect(row.icon).toBeTruthy();
  });

  it('carrega o controle do campo, para o card formatar moeda/data', () => {
    const rows = deriveListRows(tarefaCtx, 'tarefas');
    expect(rows.find((row) => row.key === 'dueDate')?.type).toBe('date');
  });

  it('deriva também as relações, marcando a entidade alvo para resolver o rótulo', () => {
    const rows = deriveListRows(tarefaCtx, 'tarefas');
    expect(rows.find((row) => row.key === 'ownerId')).toMatchObject({
      type: 'reference',
      refEntity: 'cadastros',
    });
  });

  /** A ordem do CARTÃO é a de `listOrder`, e não a do formulário — aqui as duas divergem de propósito. */
  it('ordena campos e relações juntos pela ordem do cartão, não pela do formulário', () => {
    expect(deriveListRows(tarefaCtx, 'tarefas').map((row) => row.key))
      .toStrictEqual(['ownerId', 'dueDate']);
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
