import { describe, it, expect } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import type { WorkflowStep } from '../../entities/Workflow';
import { isCoreCollection, packageIssues, packageOutRefs, pendingEventRefs, validatePackage, workflowOutRefs } from './pluginReferences';

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
    // O que nasce de um passo diz QUAL passo; o gatilho não é de passo nenhum e nomeia só a automação.
    expect(refs).toEqual([
      { kind: 'script', id: 'scr-1', from: { origin: '@core.marketplace/ref.origin.workflow-step', name: 'W', step: 's1' } },
      { kind: 'workflow', id: 'wf-2', from: { origin: '@core.marketplace/ref.origin.workflow-step', name: 'W', step: 's2' } },
      { kind: 'screen', id: 'venda', from: { origin: '@core.marketplace/ref.origin.workflow', name: 'W' }, event: true },
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
      { kind: 'screen', id: 'com-microteia-vendas__produto', from: { origin: '@core.marketplace/ref.origin.workflow', name: 'W' }, event: true },
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

  it('a coleção que uma tela do próprio pacote descreve (dataCollection) satisfaz a referência pelo nome dela', () => {
    const pkg = base({
      screens: [
        { key: 'site', titleSingular: 'S', titlePlural: 'S', icon: 'apps', titleFieldKey: 'n', dataCollection: 'sites', fields: [
          { key: 'n', label: 'N', type: 'text', required: true, order: 0 },
        ] },
        { key: 'visit', titleSingular: 'V', titlePlural: 'V', icon: 'apps', titleFieldKey: 'n', parentEntity: 'sites', parentFieldKey: 'site', fields: [
          { key: 'n', label: 'N', type: 'text', required: true, order: 0 },
          { key: 'site', label: 'Site', type: 'reference', refEntity: 'sites', required: true, order: 1 },
        ] },
      ],
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

/**
 * A referência PENDURADA dentro de um laço ou de um ramo.
 *
 * Quatro travessias da árvore de passos existiam neste repositório e duas não desciam — esta e a da
 * exportação. Uma extensão em que toda chamada mora dentro de um laço passava pelo `check` sem uma
 * recusa sequer, instalava, e só falava na primeira execução como `step.script.not-found` num log.
 *
 * O último caso é o que impede a próxima ocorrência da CLASSE: um passo em cada profundidade, e a
 * afirmação de que `packageOutRefs` colhe todos. Sem ele, o próximo percurso novo volta a não descer.
 */
describe('validatePackage — referência dentro de laço e de ramo', () => {
  const scriptStep = (id: string, scriptId: string): WorkflowStep => ({
    id, stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true,
    configuration: { scriptId: { kind: 'Literal', value: scriptId } },
  });

  const callStep = (id: string, targetWorkflowId: string): WorkflowStep => ({
    id, stepDefinitionId: 'call-workflow', type: 'Action', order: 0, enabled: true,
    configuration: { targetWorkflowId: { kind: 'Literal', value: targetWorkflowId } },
  });

  const loop = (id: string, body: WorkflowStep[]): WorkflowStep => ({
    id, stepDefinitionId: '', type: 'Loop', order: 0, enabled: true, configuration: {},
    loop: { source: { kind: 'Literal', value: '[]' }, itemName: 'item', outputName: 'out', body },
  });

  const condition = (id: string, whenTrue: WorkflowStep[], whenFalse: WorkflowStep[] = []): WorkflowStep => ({
    id, stepDefinitionId: '', type: 'Condition', order: 0, enabled: true, configuration: {},
    condition: { kind: 'AlwaysTrue' }, branches: { whenTrue, whenFalse },
  });

  const withSteps = (steps: WorkflowStep[], overrides: Partial<MarketplacePlugin> = {}): MarketplacePlugin => base({
    workflows: [{
      templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1,
      condition: { kind: 'AlwaysTrue' }, steps,
    }],
    ...overrides,
  });

  it('script ausente chamado de dentro de um laço é recusado', () => {
    const issues = validatePackage(withSteps([loop('L', [scriptStep('s', 'scr-ausente')])]));
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.external']);
    expect(issues[0].ref).toMatchObject({ kind: 'script', id: 'scr-ausente' });
  });

  /**
   * A recusa NOMEIA o passo. Num fluxo com dois laços de cinco passos, "a automação X referencia o
   * script Y" manda o autor procurar; o passo é o que faz a frase apontar. Ele viaja pelo `origin`,
   * que é uma referência aninhada — nenhuma das mensagens de recusa mudou de forma para recebê-lo.
   */
  it('a recusa aninhada nomeia o passo, e a do gatilho não inventa um', () => {
    const dentro = validatePackage(withSteps([loop('L', [scriptStep('normaliza', 'scr-ausente')])]))[0];
    expect(dentro.messageParams).toMatchObject({
      origin: '@core.marketplace/ref.origin.workflow-step',
      step: 'normaliza',
      name: 'W',
    });

    const gatilho = validatePackage(base({
      workflows: [{
        templateId: 'wf-1', name: 'W', eventName: 'venda.saved', version: 1,
        condition: { kind: 'AlwaysTrue' }, steps: [],
      }],
    }))[0];
    expect(gatilho.messageParams?.origin).toBe('@core.marketplace/ref.origin.workflow');
    expect(gatilho.messageParams).not.toHaveProperty('step');
  });

  it('automação ausente chamada de dentro de um laço é recusada', () => {
    const issues = validatePackage(withSteps([loop('L', [callStep('s', 'wf-ausente')])]));
    expect(issues.map((i) => i.ref.id)).toEqual(['wf-ausente']);
  });

  it('script ausente chamado do ramo verdadeiro é recusado', () => {
    expect(validatePackage(withSteps([condition('C', [scriptStep('s', 'scr-ausente')])])).map((i) => i.ref.id))
      .toEqual(['scr-ausente']);
  });

  it('script ausente chamado do ramo falso é recusado', () => {
    expect(validatePackage(withSteps([condition('C', [], [scriptStep('s', 'scr-ausente')])])).map((i) => i.ref.id))
      .toEqual(['scr-ausente']);
  });

  it('referência qualificada sem a dependência declarada é recusada também dentro do laço', () => {
    const issues = validatePackage(withSteps([loop('L', [scriptStep('s', 'com.acme.utils/normalizar')])]));
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.undeclared']);
    expect(issues[0].messageParams?.plugin).toBe('com.acme.utils');
  });

  it('a referência aninhada satisfeita pelo pacote não vira recusa', () => {
    const pkg = withSteps([loop('L', [scriptStep('s', 'scr-1')])], {
      scripts: [{ templateId: 'scr-1', name: 'S', sourceTs: '', compiledJs: '', inputParams: [], outputParams: [] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('packageOutRefs colhe a referência de TODA profundidade da árvore', () => {
    const pkg = withSteps([
      scriptStep('topo', 'a'),
      loop('L', [scriptStep('corpo', 'b')]),
      condition('C', [scriptStep('verdadeiro', 'c')], [scriptStep('falso', 'd')]),
      condition('C2', [loop('L2', [scriptStep('laco-no-ramo', 'e')])]),
    ]);
    expect(packageOutRefs(pkg).map((ref) => ref.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

/**
 * O relatório aponta para uma COLEÇÃO, e é a perna que o portão do pacote precisa cobrar: sem ela, o
 * relatório viaja apontando para o que ninguém instala, e a falha aparece só no escritório do cliente
 * — um relatório abrindo vazio, sem nada acusando por quê.
 */
describe('validatePackage — a coleção que o relatório cobre', () => {
  const reportSpec = (table: string) => ({
    v: 1,
    dataset: {
      table,
      dimensions: [{ key: 'c', path: 'categoria' }],
      measures: [{ key: 't', op: 'sum' as const, path: 'preco' }],
    },
    shape: { kind: 'summary' as const, groupBy: [{ dimension: 'c' }], values: ['t'] },
  });

  const withReport = (table: string, extra: Partial<MarketplacePlugin> = {}): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'V' },
    workflows: [],
    reports: [{
      templateId: 'vendas',
      key: 'vendas',
      title: 'Vendas',
      spec: reportSpec(table),
      origin: 'plugin' as const,
    }],
    ...extra,
  });

  it('recusa o relatório sobre coleção que o pacote não leva nem declara', () => {
    const issues = validatePackage(withReport('produtos'));

    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.external']);
    expect(issues[0].messageParams).toMatchObject({
      origin: '@core.marketplace/ref.origin.report',
      name: 'vendas',
      id: 'produtos',
    });
  });

  it('aceita quando o pacote LEVA a tela daquela coleção', () => {
    const issues = validatePackage(withReport('produtos', {
      screens: [{
        key: 'produtos', titleSingular: 'Produto', titlePlural: 'Produtos', icon: 'apps',
        titleFieldKey: 'nome',
        fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 }],
      }],
    }));

    expect(issues).toEqual([]);
  });

  it('aceita quando uma DEPENDÊNCIA declara trazer a coleção', () => {
    const issues = validatePackage(withReport('produtos', {
      manifest: {
        id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'V',
        dependencies: { 'com.acme.catalogo': { version: '^1.0.0', collections: ['produtos'] } },
      },
    }));

    expect(issues).toEqual([]);
  });
});

/**
 * O relatório é conferido pela FORMA no empacotamento — a terceira porta do mesmo validador.
 *
 * Sem ela, um relatório que cita uma dimensão que ele não declara viaja no pacote e falha só no
 * escritório do cliente: uma tela que não abre, sem nada dizendo por quê.
 */
describe('packageIssues — a forma do relatório', () => {
  const withReport = (spec: unknown): MarketplacePlugin => ({
    summary: 'S',
    manifest: { id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'V' },
    workflows: [],
    screens: [{
      key: 'produtos', titleSingular: 'Produto', titlePlural: 'Produtos', icon: 'apps',
      titleFieldKey: 'nome',
      fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 },
        { key: 'preco', label: 'Preço', type: 'currency', required: false, order: 1 },
      ],
    }],
    reports: [{
      templateId: 'vendas', key: 'vendas', title: 'Vendas', origin: 'plugin' as const,
      spec: spec as never,
    }],
  });

  const valido = {
    v: 1,
    dataset: {
      table: 'produtos',
      dimensions: [{ key: 'nome', path: 'nome' }],
      measures: [{ key: 'total', op: 'sum', path: 'preco' }],
    },
    shape: { kind: 'summary', groupBy: [{ dimension: 'nome' }], values: ['total'] },
  };

  it('aceita o relatório bem formado', () => {
    expect(packageIssues(withReport(valido))).toEqual([]);
  });

  it('recusa a dobra que cita dimensão que o relatório não declara', () => {
    const issues = packageIssues(withReport({
      ...valido,
      shape: { kind: 'summary', groupBy: [{ dimension: 'fantasma' }], values: ['total'] },
    }));

    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/issue.report.invalid']);
    expect(issues[0].messageParams).toMatchObject({
      name: 'vendas',
      detail: '@core.reports/shape.dimension.unknown',
    });
  });

  it('recusa operação de medida que este kernel não tem', () => {
    const issues = packageIssues(withReport({
      ...valido,
      dataset: { ...valido.dataset, measures: [{ key: 'total', op: 'median', path: 'preco' }] },
    }));

    expect(issues.map((i) => i.messageParams?.detail))
      .toContain('@core.reports/measure.op.unsupported');
  });

  it('NÃO recusa por aviso — uma dobra que o kernel degrada é um relatório que roda', () => {
    // Recusar aqui contradiria a própria regra da degradação: `shape` desconhecida vira lista
    // simples, com aviso, e o relatório continua correto.
    expect(packageIssues(withReport({ ...valido, shape: { kind: 'funnel' } }))).toEqual([]);
  });

  it('recusa o `requires` escrito à MENOS — é o único jeito de escapar do portão de capacidade', () => {
    // `unsupportedReportCapabilities` prefere o `requires` declarado à derivação. Um `requires`
    // omisso fazia o kernel executar o relatório sem o recurso que lhe falta, em vez de recusá-lo
    // pelo nome dele — e devolver outro número com o mesmo rótulo.
    const issues = packageIssues(withReport({
      ...valido,
      dataset: {
        ...valido.dataset,
        measures: [{ key: 'ticket', kind: 'computed', expression: 'a / b' }],
      },
      requires: ['dataset.collection', 'shape.summary'],
    }));

    expect(issues.map((i) => i.message)).toContain('@core.marketplace/issue.report.requires');
    expect(issues.find((i) => i.message === '@core.marketplace/issue.report.requires')?.messageParams)
      .toMatchObject({ name: 'vendas', capability: 'measure.computed' });
  });

  it('aceita o `requires` que bate com a derivação, e o que traz token A MAIS', () => {
    // Token a mais é o pacote escrito num SDK que deriva mais que este kernel. O caminho dele já
    // existe, e é o kernel recusar o relatório pelo nome da capacidade que não tem.
    expect(packageIssues(withReport({
      ...valido,
      requires: ['dataset.collection', 'measure.aggregate', 'shape.summary'],
    }))).toEqual([]);

    expect(packageIssues(withReport({
      ...valido,
      requires: ['dataset.collection', 'measure.aggregate', 'shape.summary', 'shape.sankey'],
    }))).toEqual([]);
  });

  it('não estoura com relatório sem spec', () => {
    const issues = packageIssues(withReport(undefined));

    expect(() => packageIssues(withReport(undefined))).not.toThrow();
    expect(issues.length).toBeGreaterThan(0);
  });
});

/**
 * O gatilho que escuta OUTRA extensão: `case.saved` é emitido pela tela de coleção `cases` da extensão
 * Processos, e `case` não é coleção de ninguém. O pacote sozinho não tem como resolver o prefixo —
 * só recusa quando não há dependência nenhuma a consultar.
 */
describe('validatePackage — gatilho no evento de outra extensão', () => {
  const pushes = (dependencies?: MarketplacePlugin['manifest']['dependencies']): MarketplacePlugin => base({
    manifest: { id: 'com.microteia.push', version: '1.0.0', kernel: '^2.0.0', name: 'Pushes', ...(dependencies ? { dependencies } : {}) },
    workflows: [{
      templateId: 'vincular', name: 'Vincular pushes ao processo cadastrado', eventName: 'case.saved', version: 1,
      condition: { kind: 'AlwaysTrue' }, steps: [],
    }],
  });

  it('com a dependência declarada, o pacote não recusa e deixa o prefixo pendente', () => {
    const pkg = pushes({ 'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] } });
    expect(validatePackage(pkg)).toEqual([]);
    expect(pendingEventRefs(pkg).map((ref) => ref.id)).toEqual(['case']);
  });

  it('sem dependência nenhuma, recusa nomeando o PREFIXO de evento', () => {
    const issues = validatePackage(pushes());
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.event-unresolved']);
    expect(issues[0].messageParams).toEqual({
      origin: '@core.marketplace/ref.origin.workflow',
      name: 'Vincular pushes ao processo cadastrado',
      prefix: 'case',
    });
  });

  it('o prefixo que coincide com uma coleção declarada continua coberto pelo pacote', () => {
    const pkg = base({
      manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X', dependencies: { 'com.acme.v': { version: '^1.0.0', collections: ['vendas'] } } },
      workflows: [{ templateId: 'w', name: 'W', eventName: 'vendas.saved', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
    expect(pendingEventRefs(pkg)).toEqual([]);
  });

  it('o pacote que escuta o próprio evento não deixa nada pendente', () => {
    const pkg = base({
      screens: [{
        key: 'prazos', titleSingular: 'Prazo', titlePlural: 'Prazos', icon: 'event', titleFieldKey: 'n',
        dataCollection: 'deadlines', eventPrefix: 'deadline',
        fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }],
      }],
      workflows: [{ templateId: 'w', name: 'W', eventName: 'deadline.saved', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
    });
    expect(validatePackage(pkg)).toEqual([]);
    expect(pendingEventRefs(pkg)).toEqual([]);
  });
});
