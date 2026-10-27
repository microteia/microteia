import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_EVENT_CATALOG,
  WORKFLOW_CALLED_EVENT,
  buildWorkflowEventCatalog,
  entityDateFieldKeys,
  eventEntity,
  resolveEventCatalogLabel,
  splitEntityEventName,
  splitChildRecordEventName,
  eventNameToEntityKey,
  eventNameToRoot,
  getWorkflowEventFields,
  portalViewedEventName,
  workflowParametersToRoot,
  workflowParametersToFieldOptions,
} from './eventCatalog';
import { createSchemaContext, resolvePath, parsePath, suggestNextSegments } from './pathResolver';
import { resolveLabel } from './i18n/messageRef';
import type { MessageCatalog, MessageParams } from './i18n/messages';
import type { WorkflowParameter } from '../entities/Workflow';

const entry = (name: string) => WORKFLOW_EVENT_CATALOG.find((e) => e.name === name);

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
      { key: 'hearingDate', label: 'Audiência', type: 'date', required: false, order: 4, origin: 'plugin' },
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
  /**
   * O rótulo deixou de ser frase e virou REFERÊNCIA + parâmetro: este módulo é compartilhado com o
   * backend e não pode conhecer catálogo de idioma, então a composição ("Ao salvar: X") acontece no
   * ponto de render.
   */
  it('declara o evento como referência de mensagem, com a parte variável em labelParams', () => {
    expect(entry('lookup.saved')?.label).toBe('@core.automation/event.on-save');
    expect(entry('lookup.saved')?.labelParams).toEqual({ name: '@core.automation/event.lookup-item' });
    // Processo, Pessoa, Contrato, Financeiro, Prazo e Push saíram do kernel: os eventos deles só
    // existem no catálogo do escritório que instalou as extensões.
    expect(entry('push.saved')).toBeUndefined();
    expect(entry('case.saved')).toBeUndefined();
    expect(entry('person.saved')).toBeUndefined();
    expect(entry('contract.saved')).toBeUndefined();
    expect(entry('financial.saved')).toBeUndefined();
    expect(entry('deadline.saved')).toBeUndefined();
  });

  /**
   * Os caminhos denormalizados (`case.caseNumber`) eram derivados das `fks` do REGISTRO, e saíram
   * junto com a última entidade que as tinha. Numa tela declarada, o evento oferece o campo de
   * relação — o ID —, e o registro apontado é resolvido na hora em que a expressão o pede
   * (`WorkflowContextHydrator`), não listado de antemão.
   */
  it('a relação declarada pela tela chega ao evento pelo campo de id', () => {
    const fields = getWorkflowEventFields('case.saved', tenantCtx).map((f) => f.path);
    expect(fields).toContain('contractId');
  });

  it('inclui old apenas em eventos saved', () => {
    const fieldsOf = (name: string) => getWorkflowEventFields(name, tenantCtx).map((f) => f.path);
    expect(fieldsOf('medico.saved')).toContain('old');
    expect(fieldsOf('medico.deleted')).not.toContain('old');
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

  /**
   * Nota e documento de entidade FIXA não existem mais: a última que os tinha (Prazo) saiu do
   * kernel. As anotações de um registro seguem existindo — só que a tela que as declara é de
   * extensão, e o evento nasce do `eventPrefix` dela.
   */
  it('não há mais nota nem documento de entidade fixa no catálogo do kernel', () => {
    expect(WORKFLOW_EVENT_CATALOG.filter((e) => /_note\.|_document\./.test(e.name))).toEqual([]);
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
    expect(names).toEqual(expect.arrayContaining(['lookup.saved', 'medico.saved', 'medico.deleted']));
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

  it('não são eventos de coleção: listas e chamada de workflow', () => {
    expect(splitEntityEventName('lookup.saved')).toBeNull();
    expect(splitEntityEventName('workflow.called')).toBeNull();
  });

  /**
   * Chave com underscore é o normal de uma tela trazida por dependência. O que distingue um evento
   * de filho é o SUFIXO (`_note`/`_document`), não o caractere.
   */
  it('a chave namespaced de uma dependência é um evento de coleção', () => {
    expect(splitEntityEventName('com-microteia-vendas__produto.saved')).toEqual({
      prefix: 'com-microteia-vendas__produto',
      action: 'saved',
    });
    expect(splitEntityEventName('medico_note.saved')).toBeNull();
    expect(splitEntityEventName('medico_document.deleted')).toBeNull();
  });
});

describe('eventos de nota e documento de qualquer tela', () => {
  const ctx = createSchemaContext([
    {
      id: 'pedidos',
      collection: 'orders',
      eventPrefix: 'order',
      titleSingular: 'Pedido',
      titleFieldKey: 'code',
      hasNotes: true,
      hasDocuments: true,
      fields: [{ key: 'code', label: 'Código', type: 'text', required: true, order: 0, origin: 'plugin' }],
    },
    {
      id: 'medico',
      titleSingular: 'Médico',
      titleFieldKey: 'name',
      hasDocuments: true,
      fields: [{ key: 'name', label: 'Nome', type: 'text', required: true, order: 0, origin: 'design' }],
    },
  ]);

  it('separa o prefixo do pai, o filho e a ação', () => {
    expect(splitChildRecordEventName('order_document.saved')).toEqual({ parentPrefix: 'order', kind: 'document', action: 'saved' });
    expect(splitChildRecordEventName('vendas__item_note.deleted')).toEqual({ parentPrefix: 'vendas__item', kind: 'note', action: 'deleted' });
    expect(splitChildRecordEventName('order.saved')).toBeNull();
    expect(splitChildRecordEventName('_note.saved')).toBeNull();
    expect(splitChildRecordEventName('order_note.dateReached')).toBeNull();
  });

  it('o catálogo oferece só os filhos que a tela mostra, pelo prefixo dela', () => {
    const names = buildWorkflowEventCatalog(ctx).map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining([
      'order_note.saved', 'order_note.deleted', 'order_document.saved', 'order_document.deleted',
      'medico_document.saved', 'medico_document.deleted',
    ]));
    expect(names).not.toContain('medico_note.saved');
    expect(names).not.toContain('orders_note.saved');
  });

  it('os campos são os gravados de verdade, mais o pai com o campo que dá nome a ele', () => {
    const paths = getWorkflowEventFields('order_document.saved', ctx).map((field) => field.path);
    expect(paths).toEqual(expect.arrayContaining([
      'id', 'changeType', 'old', 'parentId', 'parentType', 'name', 'type', 'size', 'createdBy', 'portalShared',
      'parent.id', 'parent.code',
    ]));
    expect(getWorkflowEventFields('order_note.deleted', ctx).map((field) => field.path))
      .toEqual(expect.arrayContaining(['title', 'text', 'parent.code']));
    expect(getWorkflowEventFields('unknown_note.saved', ctx)).toEqual([]);
  });
});

describe('abertura pelo portal — `<prefixo>.portalViewed`', () => {
  const screens = [
    {
      id: 'notificacoes',
      collection: 'notices',
      eventPrefix: 'notice',
      titleSingular: 'Notificação',
      titleFieldKey: 'number',
      tracksPortalViews: true,
      fields: [
        { key: 'number', label: 'Número', type: 'text' as const, required: true, order: 0, origin: 'plugin' as const },
        { key: 'readAt', label: 'Lida em', type: 'date' as const, required: false, order: 1, origin: 'plugin' as const },
      ],
    },
    {
      id: 'medico',
      titleSingular: 'Médico',
      titleFieldKey: 'name',
      fields: [{ key: 'name', label: 'Nome', type: 'text' as const, required: true, order: 0, origin: 'design' as const }],
    },
  ];
  const ctx = createSchemaContext(screens);

  it('é um gatilho de registro, com o prefixo da tela', () => {
    expect(portalViewedEventName('notice')).toBe('notice.portalViewed');
    expect(splitEntityEventName('notice.portalViewed')).toEqual({ prefix: 'notice', action: 'portalViewed' });
  });

  it('o catálogo o oferece só à coleção cuja tela registra as aberturas', () => {
    const names = buildWorkflowEventCatalog(ctx).map((e) => e.name);
    expect(names).toContain('notice.portalViewed');
    expect(names).not.toContain('medico.portalViewed');
  });

  it('a tela que registra pode não ser a dona do nome da coleção — vale a coleção', () => {
    const merged = createSchemaContext([
      { id: 'notices', titleSingular: 'notices', titleFieldKey: '', fields: [] },
      ...screens,
    ]);
    expect(merged.screens.get('notices')?.tracksPortalViews).toBe(true);
  });

  it('o payload é o registro mais `portalView`, sem `old` — e os caminhos resolvem com o tipo certo', () => {
    const paths = getWorkflowEventFields('notice.portalViewed', ctx).map((field) => field.path);
    expect(paths).toEqual(expect.arrayContaining([
      'id', 'number', 'readAt', 'portalView.at', 'portalView.email', 'portalView.documentId', 'portalView.documentName',
      'portalView.documentType',
    ]));
    expect(paths).not.toContain('old');
    const root = eventNameToRoot('notice.portalViewed', ctx)!;
    expect(resolvePath(ctx, root, parsePath('portalView.at')).node).toMatchObject({ kind: 'scalar', type: 'date' });
    expect(resolvePath(ctx, root, parsePath('number')).node).toMatchObject({ kind: 'scalar' });
    expect(resolvePath(ctx, root, parsePath('readAt.portalView')).valid).toBe(false);
  });

  it('o editor sugere `portalView` só na raiz', () => {
    const root = eventNameToRoot('notice.portalViewed', ctx)!;
    expect(suggestNextSegments(ctx, root, []).map((one) => one.insertText)).toEqual(expect.arrayContaining(['id', 'number', 'portalView']));
    expect(suggestNextSegments(ctx, root, parsePath('portalView')).map((one) => one.insertText))
      .toEqual(['at', 'email', 'documentId', 'documentName', 'documentType']);
    expect(suggestNextSegments(ctx, eventNameToRoot('notice.saved', ctx)!, []).map((one) => one.insertText)).not.toContain('portalView');
  });
});

describe('eventNameToRoot / eventNameToEntityKey', () => {
  it('resolve raiz de entidade com hasOld por ação', () => {
    expect(eventNameToRoot('medico.saved', tenantCtx)).toMatchObject({ kind: 'entity', entityKey: 'medico', hasOld: true });
    expect(eventNameToRoot('medico.deleted', tenantCtx)).toMatchObject({ hasOld: false });
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
    expect(eventNameToRoot('push_note.saved')).toBeNull();
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
    expect(entry?.label).toBe('@core.automation/event.called');
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

/**
 * O rótulo de evento é COMPOSTO — "Ao salvar: {name}" —, e `name` é ele mesmo ou outra referência
 * (entidade nativa) ou o nome que o escritório digitou no Form Design. As duas voltas moravam dentro
 * do seletor de gatilho; a tela de menção tinha só uma volta, e mostrava a chave.
 */
describe('resolveEventCatalogLabel — as voltas da composição', () => {
  /**
   * O resolvedor é o REAL, e não um fake, de propósito: o que este teste guarda é a composição
   * aninhada, e ela é feita por `resolveParam` — referência dentro de parâmetro, com os irmãos
   * descendo para a mensagem de dentro. Um fake que interpola à mão passaria mesmo se o motor
   * deixasse de fazer isso, que foi justamente o defeito.
   */
  const catalog: MessageCatalog = {
    locale: 'pt-BR',
    messages: {
      'core.automation/event.on-save': 'Ao salvar: {name}',
      'core.automation/event.manual': 'Chamado por uma Ação',
      'core.automation/event.nested-item': '{item} de {parent}',
      'core.automation/event.note': 'Nota',
      'core.data/member.singular': 'Membro',
      'com.acme.auto/screen.request': 'Solicitação',
    },
  };
  const label = (value: string, params?: Record<string, unknown>): string =>
    resolveLabel(catalog, value, params as MessageParams | undefined);

  it('resolve a referência de dentro do parâmetro, e não só a de fora', () => {
    const resolved = resolveEventCatalogLabel(label, {
      label: '@core.automation/event.on-save',
      labelParams: { name: '@com.acme.auto/screen.request' },
    });
    expect(resolved).toBe('Ao salvar: Solicitação');
  });

  it('o nome que o escritório digitou entra como está', () => {
    const resolved = resolveEventCatalogLabel(label, {
      label: '@core.automation/event.on-save',
      labelParams: { name: 'Contrato de Locação' },
    });
    expect(resolved).toBe('Ao salvar: Contrato de Locação');
  });

  it('sem parâmetro, resolve só o rótulo', () => {
    expect(resolveEventCatalogLabel(label, { label: '@core.automation/event.manual' }))
      .toBe('Chamado por uma Ação');
  });

  it('a volta de DENTRO também resolve: "{item} de {parent}" com os dois irmãos', () => {
    const resolved = resolveEventCatalogLabel(label, {
      label: '@core.automation/event.on-save',
      labelParams: {
        name: '@core.automation/event.nested-item',
        item: '@core.automation/event.note',
        parent: '@core.data/member.singular',
      },
    });
    expect(resolved).toBe('Ao salvar: Nota de Membro');
  });

  /**
   * A regra que faltava no dia em que o rótulo de nota e documento era montado por concatenação:
   * `${prefix} de ${parent.labelSingular}`. Um rótulo montado assim não começa com `@`, então a
   * asserção seguinte — a de que nada chega cru à tela — passava por ele sem ver o português.
   */
  it('o rótulo de toda entrada é REFERÊNCIA, nunca texto montado', () => {
    WORKFLOW_EVENT_CATALOG.forEach((catalogEntry) => {
      expect(catalogEntry.label.startsWith('@'), catalogEntry.name).toBe(true);
    });
  });

  it('nenhuma entrada do catálogo fixo sobrevive com a referência na tela', () => {
    WORKFLOW_EVENT_CATALOG.forEach((catalogEntry) => {
      expect(resolveEventCatalogLabel(label, catalogEntry).startsWith('@')).toBe(false);
    });
  });
});

describe('gatilho de data — `<coleção>.dateReached`', () => {
  it('existe para a tela com campo de data, pelo prefixo que ela emite, e não para a que não tem', () => {
    const names = buildWorkflowEventCatalog(tenantCtx).map((e) => e.name);
    expect(names).toContain('case.dateReached');
    expect(names).not.toContain('medico.dateReached');
    expect(entityDateFieldKeys(eventEntity('case.dateReached', tenantCtx) as NonNullable<ReturnType<typeof eventEntity>>)).toEqual(['hearingDate']);
  });

  it('o payload é o registro, sem `old` nem `changeType`', () => {
    expect(eventNameToRoot('case.dateReached', tenantCtx)).toMatchObject({ kind: 'entity', entityKey: 'cases', hasOld: false });
  });

  it('é evento de coleção para o empacotamento — o prefixo se remapeia como o de `.saved`', () => {
    expect(splitEntityEventName('case.dateReached')).toEqual({ prefix: 'case', action: 'dateReached' });
  });
});
