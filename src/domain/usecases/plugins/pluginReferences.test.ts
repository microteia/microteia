import { describe, it, expect } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import { isCoreCollection, packageIssues, validatePackage, workflowOutRefs } from './pluginReferences';

const base = (overrides: Partial<MarketplacePlugin>): MarketplacePlugin => ({
  summary: '',
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X' },
  workflows: [],
  ...overrides,
});

describe('isCoreCollection', () => {
  it('reconhece entidades fixas e lookups', () => {
    expect(isCoreCollection('members')).toBe(true);
    expect(isCoreCollection('documentTypes')).toBe(true);
    // Contrato saiu do kernel: `contracts` deixa de ser nome do core e vira referência a cobrir
    // por dependência declarada.
    expect(isCoreCollection('contracts')).toBe(false);
  });
  it('não reconhece chave de tela namespaced', () => {
    expect(isCoreCollection('com-acme-vendas__produto')).toBe(false);
  });
});

describe('workflowOutRefs', () => {
  it('extrai scriptId, targetWorkflowId e a tela do gatilho', () => {
    const refs = workflowOutRefs({
      templateId: 'wf',
      name: 'W',
      eventName: 'venda.saved',
      version: 1,
      condition: { kind: 'AlwaysTrue' },
      steps: [
        { id: 's1', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true, configuration: { scriptId: { kind: 'Literal', value: 'scr-1' } } },
        { id: 's2', stepDefinitionId: 'call-workflow', type: 'Action', order: 1, enabled: true, configuration: { targetWorkflowId: { kind: 'Literal', value: 'wf-2' } } },
      ],
    });
    expect(refs).toEqual([
      { kind: 'script', id: 'scr-1', from: { origin: '@core.marketplace/ref.origin.workflow', name: 'W' } },
      { kind: 'workflow', id: 'wf-2', from: { origin: '@core.marketplace/ref.origin.workflow', name: 'W' } },
      { kind: 'screen', id: 'venda', from: { origin: '@core.marketplace/ref.origin.workflow', name: 'W' } },
    ]);
  });

  /**
   * O nome do evento deixou de ser a chave da tela quando ela passou a poder declarar o prefixo. A
   * referência tem de achar a tela pelo que ela EMITE — senão o gatilho `case.saved` da extensão
   * Processos acusaria uma tela "case" que nunca existiu.
   */
  it('acha a tela do gatilho pelo prefixo declarado, não pelo nome do evento', () => {
    const workflow = {
      templateId: 'wf', name: 'W', eventName: 'case.saved', version: 1,
      condition: { kind: 'AlwaysTrue' } as const, steps: [],
    };
    const processos = {
      key: 'processos', titleSingular: 'Processo', titlePlural: 'Processos', icon: 'gavel',
      titleFieldKey: 'title', dataCollection: 'cases', eventPrefix: 'case',
      fields: [{ key: 'title', label: 'Título', type: 'text' as const, required: true, order: 0 }],
    };
    expect(workflowOutRefs(workflow, [processos])).toEqual([
      { kind: 'screen', id: 'processos', from: { origin: '@core.marketplace/ref.origin.workflow', name: 'W' } },
    ]);
  });

  it('gatilho de tela trazida por dependência não passa despercebido', () => {
    const refs = workflowOutRefs({
      templateId: 'wf', name: 'W', eventName: 'com-microteia-vendas__produto.saved', version: 1,
      condition: { kind: 'AlwaysTrue' }, steps: [],
    });
    expect(refs).toEqual([
      { kind: 'screen', id: 'com-microteia-vendas__produto', from: { origin: '@core.marketplace/ref.origin.workflow', name: 'W' } },
    ]);
  });
});

describe('validatePackage — prefixo de eventos', () => {
  const screen = (overrides: Partial<ScreenModuleTemplate> & { key: string }): ScreenModuleTemplate => ({
    titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n',
    fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }],
    ...overrides,
  });

  it('a entidade que sai do kernel mantém o próprio prefixo', () => {
    const pkg = base({
      screens: [screen({ key: 'processos', dataCollection: 'cases', eventPrefix: 'case' })],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('recusa o prefixo de uma entidade fixa em outra coleção', () => {
    const pkg = base({ screens: [screen({ key: 'medico', eventPrefix: 'lookup' })] });
    const issues = validatePackage(pkg);
    expect(issues).toHaveLength(1);
  });

  it('recusa duas coleções publicando o mesmo evento', () => {
    const pkg = base({
      screens: [
        screen({ key: 'medico', eventPrefix: 'atendimento' }),
        screen({ key: 'clinica', eventPrefix: 'atendimento' }),
      ],
    });
    expect(validatePackage(pkg).map((i) => i.ref.id)).toEqual(['clinica']);
  });

  it('duas telas sobre a MESMA coleção emitem o mesmo evento sem colidir', () => {
    const pkg = base({
      screens: [
        screen({ key: 'processos', dataCollection: 'cases', eventPrefix: 'case' }),
        screen({ key: 'processos_kanban', dataCollection: 'cases', eventPrefix: 'case' }),
      ],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('recusa nome reservado pelo motor', () => {
    const pkg = base({ screens: [screen({ key: 'medico', eventPrefix: 'lookup' })] });
    expect(validatePackage(pkg)).toHaveLength(1);
  });
});

describe('validatePackage', () => {
  it('pacote autocontido é válido', () => {
    const pkg = base({
      scripts: [{ templateId: 'scr-1', name: 'S', sourceTs: '', compiledJs: '', inputParams: [], outputParams: [] }],
      workflows: [{ templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [{ id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true, configuration: { scriptId: { kind: 'Literal', value: 'scr-1' } } }] }],
      actions: [{ templateId: 'act-1', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-1', danger: false, enabled: true, order: 0 }],
      screens: [{ key: 'tela', titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n', viewActionIds: ['act-1'], fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('referência ao core (members) é sempre satisfeita', () => {
    const pkg = base({
      screens: [{ key: 'venda', titleSingular: 'V', titlePlural: 'V', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'n', label: 'N', type: 'text', required: true, order: 0 },
        { key: 'lancamento', label: 'Lançamento', type: 'reference', refEntity: 'members', required: false, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('aponta action não incluída', () => {
    const pkg = base({
      screens: [{ key: 'tela', titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n', viewActionIds: ['act-sumida'], fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }] }],
    });
    const issues = validatePackage(pkg);
    expect(issues).toHaveLength(1);
    expect(issues[0].ref).toMatchObject({ kind: 'action', id: 'act-sumida' });
  });

  it('aponta script não incluído referenciado por workflow', () => {
    const pkg = base({
      workflows: [{ templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [{ id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true, configuration: { scriptId: { kind: 'Literal', value: 'scr-ausente' } } }] }],
    });
    expect(validatePackage(pkg).map((i) => i.ref.id)).toEqual(['scr-ausente']);
  });

  it('referência a tela de outro plugin é satisfeita por dependência declarada', () => {
    const pkg = base({
      manifest: { id: 'com.acme.pedidos', version: '1.0.0', kernel: '^2.0.0', name: 'Pedidos', dependencies: { 'com.microteia.vendas': '^1.0.0' } },
      screens: [{ key: 'pedido', titleSingular: 'P', titlePlural: 'P', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'n', label: 'N', type: 'text', required: true, order: 0 },
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com-microteia-vendas__produto', required: false, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  /**
   * Uma entidade que saiu do kernel mantém o nome global da coleção. A dependência declara O QUE
   * traz — sem isso, `persons` seria indistinguível de uma tela que ninguém tem.
   */
  it('coleção de uma dependência declarada satisfaz a referência', () => {
    const pkg = base({
      manifest: {
        id: 'com.acme.processos', version: '1.0.0', kernel: '^2.0.0', name: 'Processos',
        dependencies: { 'com.example.cadastro': { version: '^1.0.0', collections: ['persons'] } },
      },
      screens: [{ key: 'processo', titleSingular: 'P', titlePlural: 'P', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'n', label: 'N', type: 'text', required: true, order: 0 },
        { key: 'advogado', label: 'Advogado', type: 'reference', refEntity: 'persons', required: false, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('a mesma referência sem a dependência declarada é pendente', () => {
    const pkg = base({
      screens: [{ key: 'processo', titleSingular: 'P', titlePlural: 'P', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'advogado', label: 'Advogado', type: 'reference', refEntity: 'persons', required: false, order: 0 },
        { key: 'n', label: 'N', type: 'text', required: true, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg).map((i) => i.ref.id)).toEqual(['persons']);
  });

  it('referência a outro plugin SEM dependência declarada é pendente', () => {
    const pkg = base({
      screens: [{ key: 'pedido', titleSingular: 'P', titlePlural: 'P', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com-microteia-vendas__produto', required: false, order: 0 },
        { key: 'n', label: 'N', type: 'text', required: true, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg).map((i) => i.ref.id)).toEqual(['com-microteia-vendas__produto']);
  });
});

/**
 * A referência QUALIFICADA — o artefato de outra extensão. Ver `artifactRef`: aqui só se confere a
 * FORMA e a dependência declarada; se o `sourceId` está mesmo no `exports` da dona é pergunta do
 * portão de instalação, que enxerga o escritório.
 */
describe('validatePackage — referência a artefato de outra extensão', () => {
  const dependent = (value: string, overrides: Partial<MarketplacePlugin> = {}): MarketplacePlugin => base({
    manifest: {
      id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'Vendas',
      dependencies: { 'com.acme.utils': '^1.0.0' },
    },
    workflows: [{
      templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1,
      condition: { kind: 'AlwaysTrue' },
      steps: [{
        id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true,
        configuration: { scriptId: { kind: 'Literal', value } },
      }],
    }],
    ...overrides,
  });

  it('script de uma dependência declarada é aceito', () => {
    expect(validatePackage(dependent('com.acme.utils/normalizar-cpf'))).toEqual([]);
  });

  it('automação de uma dependência declarada é aceita', () => {
    const pkg = base({
      manifest: {
        id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'Vendas',
        dependencies: { 'com.acme.utils': '^1.0.0' },
      },
      actions: [{ templateId: 'act-1', key: 'a', title: 'A', icon: 'apps', workflowId: 'com.acme.utils/avisar', danger: false, enabled: true, order: 0 }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('sem a dependência declarada, recusa NOMEANDO a extensão dona', () => {
    const pkg = base({
      manifest: { id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'Vendas' },
      workflows: [{
        templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1,
        condition: { kind: 'AlwaysTrue' },
        steps: [{
          id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true,
          configuration: { scriptId: { kind: 'Literal', value: 'com.acme.utils/normalizar-cpf' } },
        }],
      }],
    });
    const issues = validatePackage(pkg);
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.undeclared']);
    expect(issues[0].messageParams).toMatchObject({ plugin: 'com.acme.utils' });
  });

  it('barra que não forma referência válida é erro de digitação, não referência externa', () => {
    const issues = validatePackage(dependent('com.acme.utils/Normalizar CPF'));
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.malformed']);
  });

  it('apontar para si pelo próprio id é recusado — dentro do pacote o nome é direto', () => {
    const pkg = base({
      manifest: { id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'Vendas' },
      scripts: [{ templateId: 'normalizar-cpf', name: 'S', sourceTs: '', compiledJs: '', inputParams: [], outputParams: [] }],
      workflows: [{
        templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1,
        condition: { kind: 'AlwaysTrue' },
        steps: [{
          id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true,
          configuration: { scriptId: { kind: 'Literal', value: 'com.acme.vendas/normalizar-cpf' } },
        }],
      }],
    });
    expect(validatePackage(pkg).map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.self']);
  });

  /** A identidade de uma tela é o nome da coleção, e `com.x/produtos` não é um nome de coleção. */
  it('tela na forma qualificada é recusada, e a mensagem aponta o outro mecanismo', () => {
    const pkg = base({
      manifest: {
        id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'Vendas',
        dependencies: { 'com.acme.utils': '^1.0.0' },
      },
      screens: [{ key: 'pedido', titleSingular: 'P', titlePlural: 'P', icon: 'apps', titleFieldKey: 'n', fields: [
        { key: 'n', label: 'N', type: 'text', required: true, order: 0 },
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com.acme.utils/produtos', required: false, order: 1 },
      ] }],
    });
    expect(validatePackage(pkg).map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.screen-qualified']);
  });
});

describe('validatePackage — complementos de tela', () => {
  const patch = (over: Partial<MarketplacePlugin['screenPatches'] extends (infer T)[] | undefined ? T : never>) => ({
    target: 'members',
    fields: [{ key: 'crm', label: 'CRM', type: 'text' as const, required: false, order: 0 }],
    ...over,
  });

  it('aceita alvo em coleção fixa do sistema', () => {
    expect(validatePackage(base({ screenPatches: [patch({})] }))).toEqual([]);
  });

  it('aceita alvo por sourceId sem conferir (a tela alvo vive no destino)', () => {
    expect(validatePackage(base({
      screenPatches: [patch({ target: 'src-produtos', targetKind: 'sourceId' })],
    }))).toEqual([]);
  });

  it('recusa alvo que não é coleção fixa nem sourceId', () => {
    const issues = validatePackage(base({ screenPatches: [patch({ target: 'minhaTela' })] }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('@core.marketplace/issue.patch.unknown-target');
  });

  it('recusa complemento que aponta para uma tela do próprio pacote', () => {
    const issues = validatePackage(base({
      screens: [{
        key: 'produtos', titleSingular: 'Produto', titlePlural: 'Produtos', icon: 'apps',
        titleFieldKey: 'nome', fields: [],
      }],
      screenPatches: [patch({ target: 'produtos' })],
    }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('@core.marketplace/issue.patch.own-screen');
  });

  it('campo do complemento que referencia tela fora do pacote é apontado', () => {
    const issues = validatePackage(base({
      screenPatches: [patch({
        fields: [{ key: 'prod', label: 'Produto', type: 'reference', refEntity: 'produtos', required: false, order: 0 }],
      })],
    }));
    expect(issues).toHaveLength(1);
    expect(issues[0].ref.id).toBe('produtos');
  });
});

describe('validatePackage — complemento sobre a tela do próprio pacote', () => {
  it('recusa também quando o alvo é o sourceId de uma tela do pacote', () => {
    const issues = validatePackage(base({
      screens: [{
        key: 'produtos', sourceId: 'src-produtos', titleSingular: 'Produto', titlePlural: 'Produtos',
        icon: 'apps', titleFieldKey: 'nome', fields: [],
      }],
      screenPatches: [{
        target: 'src-produtos', targetKind: 'sourceId',
        fields: [{ key: 'novo', label: 'Novo', type: 'text', required: false, order: 0 }],
      }],
    }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('@core.marketplace/issue.patch.own-screen');
  });
});

/**
 * `packageIssues` é a porta única das validações que não apontam para um artefato. Ela existe para que
 * uma validação nova (aqui, a fila de migração) valha no export e no import sem ter de ser lembrada em
 * cada chamador — que é como uma checagem passa a valer só em metade dos caminhos.
 */
describe('packageIssues — a porta compartilhada por export e import', () => {
  it('não reclama de um pacote sem migração', () => {
    expect(packageIssues(base({}))).toEqual([]);
  });

  it('reprova a fila de migração malformada', () => {
    const issues = packageIssues(base({
      migrations: [
        { id: 'ok', version: '1.0.0', name: 'Ok', sourceTs: 'main()' },
        { id: 'Errado', version: '1.1.0', name: 'X', sourceTs: 'main()' },
      ],
    }));
    expect(issues.map((issue) => issue.message)).toEqual(['@core.marketplace/issue.migration.id-invalid']);
  });
});
