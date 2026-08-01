import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_EVENT_CATALOG,
  WORKFLOW_CALLED_EVENT,
  buildWorkflowEventCatalog,
  splitEntityEventName,
  eventNameToEntityKey,
  eventNameToRoot,
  getWorkflowEventFields,
  workflowParametersToRoot,
  workflowParametersToFieldOptions,
} from './eventCatalog';
import { createSchemaContext, resolvePath, parsePath } from './pathResolver';
import type { WorkflowParameter } from '../entities/Workflow';

const entry = (name: string) => WORKFLOW_EVENT_CATALOG.find((e) => e.name === name);
const paths = (name: string) => (entry(name)?.fields ?? []).map((f) => f.path);

const tenantCtx = createSchemaContext([
  // Processo vem de extensão: coleção `cases`, eventos `case.*`, campos declarados no pacote.
  {
    id: 'processos',
    collection: 'cases',
    eventPrefix: 'case',
    titleSingular: 'Processo',
    titleFieldKey: 'title',
    fields: [
      { key: 'title', label: 'Título', type: 'text', required: true, order: 0, origin: 'plugin' },
      { key: 'caseNumber', label: 'Número', type: 'text', required: true, order: 1, origin: 'plugin' },
      { key: 'contractId', label: 'Contrato', type: 'reference', refEntity: 'contracts', refDenormKey: 'contract', required: false, order: 2, origin: 'plugin' },
      { key: 'tarefa', label: 'Tarefa', type: 'text', required: false, order: 3, origin: 'design' },
    ],
  },
  {
    // Pessoa também vem de extensão: coleção `persons`, eventos `person.*`, endereço declarado em
    // caminho pontilhado — é o objeto aninhado nascendo de uma declaração de tela.
    id: 'pessoas',
    collection: 'persons',
    eventPrefix: 'person',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, order: 0, origin: 'plugin' },
      { key: 'address.city', label: 'Cidade', type: 'text', required: false, order: 1, origin: 'plugin' },
    ],
  },
  {
    // Contrato também vem de extensão: coleção `contracts`, eventos `contract.*`, e a relação com
    // Pessoa pelo nome de navegação que as automações do escritório já usam.
    id: 'contratos',
    collection: 'contracts',
    eventPrefix: 'contract',
    titleSingular: 'Contrato',
    titleFieldKey: 'title',
    fields: [
      { key: 'number', label: 'Número', type: 'text', required: true, order: 0, origin: 'plugin' },
      { key: 'title', label: 'Título', type: 'text', required: true, order: 1, origin: 'plugin' },
      { key: 'clientId', label: 'Cliente', type: 'reference', refEntity: 'persons', refDenormKey: 'client', required: false, order: 2, origin: 'plugin' },
    ],
  },
  {
    id: 'medico',
    titleSingular: 'Médico',
    titlePlural: 'Médicos',
    titleFieldKey: 'nome',
    fields: [{ key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' }],
  },
]);

describe('eventCatalog — derivação do registry', () => {
  it('mantém os eventos das entidades com rótulos PT-BR', () => {
    expect(entry('deadline.saved')?.label).toBe('Ao salvar: Prazo');
    expect(entry('financial.deleted')?.label).toBe('Ao excluir: Financeiro');
    expect(entry('lookup.saved')?.label).toBe('Ao salvar: Item de Lista');
    // Processo, Pessoa e Contrato saíram do kernel: os eventos deles só existem no catálogo do
    // escritório que instalou as extensões.
    expect(entry('case.saved')).toBeUndefined();
    expect(entry('person.saved')).toBeUndefined();
    expect(entry('contract.saved')).toBeUndefined();
  });

  it('deriva os caminhos denormalizados das FKs (fim do hardcode)', () => {
    expect(paths('deadline.saved')).toEqual(expect.arrayContaining(['case.caseNumber', 'case.title', 'case.area']));
    expect(paths('financial.saved')).toEqual(expect.arrayContaining(['person.name', 'contract.number', 'personId']));
    // O RÓTULO do campo apontado sai do registro; com Pessoa fora dele, resta a chave crua. O
    // caminho continua resolvendo — é ele que a automação usa.
    expect(entry('financial.saved')?.fields.map((f) => f.path)).toEqual(expect.arrayContaining(['person.name']));
  });

  it('inclui old apenas em eventos saved', () => {
    expect(paths('financial.saved')).toContain('old');
    expect(paths('financial.deleted')).not.toContain('old');
  });

  /**
   * O objeto aninhado agora nasce de uma DECLARAÇÃO de tela: os campos vêm em caminho pontilhado
   * (`address.city`), a resolução os aninha e o catálogo os achata de volta.
   */
  it('achata campos de objeto aninhado declarados por tela', () => {
    const fields = getWorkflowEventFields('person.saved', tenantCtx).map((f) => f.path);
    expect(fields).toContain('address.city');
  });

  it('não oferece eventos de news (nunca publicados pelo backend)', () => {
    expect(entry('news.saved')).toBeUndefined();
  });

  it('gera eventos de nota/documento com pai denormalizado do registry', () => {
    expect(paths('deadline_note.saved')).toEqual(expect.arrayContaining(['content', 'parent.id', 'parent.type']));
    expect(paths('financial_document.deleted')).toEqual(expect.arrayContaining(['fileName', 'parent.amount']));
    expect(entry('deadline_document.saved')).toBeUndefined();
  });
});

describe('getWorkflowEventFields', () => {
  it('oferece os campos declarados pelo tenant na raiz, sem envelope', () => {
    const fields = getWorkflowEventFields('case.saved', tenantCtx).map((f) => f.path);
    expect(fields).toContain('tarefa');
    expect(fields).toContain('caseNumber');
    expect(fields).not.toContain('customValues');
  });

  it('trata a tela do Form Design como qualquer outra entidade', () => {
    const fields = getWorkflowEventFields('medico.saved', tenantCtx).map((f) => f.path);
    expect(fields).toEqual(expect.arrayContaining(['id', 'changeType', 'old', 'nome']));
    expect(fields).not.toContain('values');
  });
});

describe('buildWorkflowEventCatalog', () => {
  it('acrescenta um par de eventos por tela do tenant, sem duplicar as fixas', () => {
    const names = buildWorkflowEventCatalog(tenantCtx).map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['financial.saved', 'medico.saved', 'medico.deleted']));
    expect(names.filter((n) => n === 'person.saved')).toHaveLength(1);
    expect(names.filter((n) => n === 'contract.saved')).toHaveLength(1);
    expect(names.filter((n) => n === 'case.saved')).toHaveLength(1);
    expect(names).not.toContain('cases.saved');
  });

  /**
   * A forma real do escritório: além da tela da extensão, existe o documento que leva o nome da
   * coleção, criado na instalação para as Security Rules lerem a permissão. Ele não declara evento
   * nenhum — e não pode roubar o nome dos eventos, senão o gatilho oferece `cases.saved` enquanto o
   * motor publica `case.saved` e nenhuma automação dispara.
   */
  it('a tela de permissão da coleção não renomeia os eventos', () => {
    const ctx = createSchemaContext([
      {
        id: 'cases',
        titleSingular: 'Processo',
        titleFieldKey: 'title',
        fields: [],
      },
      {
        id: 'processos',
        collection: 'cases',
        eventPrefix: 'case',
        titleSingular: 'Processo',
        titleFieldKey: 'title',
        fields: [{ key: 'caseNumber', label: 'Número', type: 'text', required: true, order: 0, origin: 'plugin' }],
      },
    ]);
    const names = buildWorkflowEventCatalog(ctx).map((e) => e.name);
    expect(names).toContain('case.saved');
    expect(names).toContain('case.deleted');
    expect(names).not.toContain('cases.saved');
    expect(eventNameToRoot('case.saved', ctx)).toMatchObject({ kind: 'entity', entityKey: 'cases' });
  });
});

describe('splitEntityEventName', () => {
  it('separa prefixo e ação', () => {
    expect(splitEntityEventName('case.saved')).toEqual({ prefix: 'case', action: 'saved' });
    expect(splitEntityEventName('medico.deleted')).toEqual({ prefix: 'medico', action: 'deleted' });
  });

  it('não são eventos de coleção: filhos das fixas, listas e chamada de workflow', () => {
    expect(splitEntityEventName('deadline_note.saved')).toBeNull();
    expect(splitEntityEventName('financial_document.deleted')).toBeNull();
    expect(splitEntityEventName('lookup.saved')).toBeNull();
    expect(splitEntityEventName('workflow.called')).toBeNull();
  });

  /**
   * Chave com underscore é o normal de uma tela trazida por dependência. O que a distingue de um
   * evento de filho é a composição (prefixo de entidade fixa + `_note`/`_document`), não o caractere.
   */
  it('a chave namespaced de uma dependência é um evento de coleção', () => {
    expect(splitEntityEventName('com-microteia-vendas__produto.saved')).toEqual({
      prefix: 'com-microteia-vendas__produto',
      action: 'saved',
    });
    expect(splitEntityEventName('medico_note.saved')).toMatchObject({ prefix: 'medico_note' });
    // `person` deixou de ser prefixo do registro, então `person_note` volta a ser nome de coleção.
    expect(splitEntityEventName('person_note.saved')).toMatchObject({ prefix: 'person_note' });
  });
});

describe('eventNameToRoot / eventNameToEntityKey', () => {
  it('resolve raiz de entidade com hasOld por ação', () => {
    expect(eventNameToRoot('financial.saved')).toMatchObject({ kind: 'entity', entityKey: 'financials', hasOld: true });
    expect(eventNameToRoot('financial.deleted')).toMatchObject({ hasOld: false });
  });

  /**
   * O evento da entidade que saiu do kernel: o nome vem do `eventPrefix` que a tela declara, e a
   * raiz é a COLEÇÃO dela. É o que mantém `case.saved` valendo depois da migração.
   */
  it('resolve o evento pelo prefixo que a tela declara', () => {
    expect(eventNameToRoot('case.saved', tenantCtx)).toMatchObject({
      kind: 'entity',
      entityKey: 'cases',
      hasOld: true,
    });
    expect(eventNameToRoot('case.saved')).toBeNull();
  });

  it('resolve a tela do tenant como entidade própria', () => {
    expect(eventNameToRoot('medico.saved', tenantCtx)).toMatchObject({
      kind: 'entity',
      entityKey: 'medico',
      hasOld: true,
    });
  });

  it('resolve raiz de campos para eventos de sistema e lookup', () => {
    expect(eventNameToRoot('lookup.saved')?.kind).toBe('fields');
    expect(eventNameToRoot('deadline_note.saved')?.kind).toBe('fields');
    expect(eventNameToRoot('desconhecido.saved', tenantCtx)).toBeNull();
  });

  it('mantém o mapeamento legado de entityKey', () => {
    expect(eventNameToEntityKey('case.saved', tenantCtx)).toBe('cases');
    expect(eventNameToEntityKey('lookup.saved')).toBe('lookups');
    expect(eventNameToEntityKey('medico.saved', tenantCtx)).toBe('medico');
    expect(eventNameToEntityKey('desconhecido.saved', tenantCtx)).toBeNull();
  });
});

describe('workflow.called — parâmetros dinâmicos', () => {
  const parameters: WorkflowParameter[] = [
    { key: 'titulo', label: 'Título', type: 'String' },
    { key: 'processo', label: 'Processo', type: 'EntityReference', entityType: 'cases' },
  ];

  it('oferece o evento "Chamado por outro workflow" com raiz de campos', () => {
    const entry = WORKFLOW_EVENT_CATALOG.find((e) => e.name === WORKFLOW_CALLED_EVENT);
    expect(entry?.label).toBe('Chamado por outro workflow');
    expect(eventNameToRoot(WORKFLOW_CALLED_EVENT)?.kind).toBe('fields');
  });

  it('constrói a raiz a partir dos parâmetros declarados', () => {
    const root = workflowParametersToRoot(parameters);
    expect(root.kind).toBe('fields');
    if (root.kind !== 'fields') return;
    expect(root.fields.map((f) => f.key)).toEqual(['titulo', 'processo']);
    expect(root.fields.find((f) => f.key === 'processo')).toMatchObject({ refEntity: 'cases' });
  });

  it('hidrata um parâmetro-referência: event.processo.title gera hop para cases', () => {
    // A coleção alvo é descrita por uma tela: sem ela no contexto, o salto existe mas o campo do
    // destino é desconhecido — exatamente como para qualquer entidade não instalada.
    const ctx = tenantCtx;
    const root = workflowParametersToRoot(parameters);
    const resolution = resolvePath(ctx, root, parsePath('processo.title'));
    expect(resolution.valid).toBe(true);
    expect(resolution.node.kind).toBe('scalar');
    expect(resolution.hops).toEqual(
      expect.arrayContaining([expect.objectContaining({ targetCollection: 'cases', materializeAt: 'processo' })]),
    );
  });

  it('lista opções de campo com drill nas referências', () => {
    const options = workflowParametersToFieldOptions(parameters).map((o) => o.path);
    expect(options).toContain('titulo');
    expect(options).toContain('processo');
    expect(options).toContain('processo.id');
  });
});
