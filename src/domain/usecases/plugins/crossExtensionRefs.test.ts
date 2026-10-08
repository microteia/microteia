import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { crossExtensionRefIssues, dependentRefIssues, emittedEventPrefixes, exportedSurface } from './crossExtensionRefs';

const consumer = (scriptId: string): MarketplacePlugin => ({
  summary: '',
  manifest: {
    id: 'com.acme.vendas', version: '1.0.0', kernel: '^2.0.0', name: 'Vendas',
    dependencies: { 'com.acme.utils': '^1.0.0' },
  },
  workflows: [{
    templateId: 'wf-1', name: 'W', eventName: 'workflow.called', version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps: [{
      id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true,
      configuration: { scriptId: { kind: 'Literal', value: scriptId } },
    }],
  }],
});

const utils = (overrides: Partial<{ version: string; exports: string[] }> = {}) => ({
  id: 'com.acme.utils',
  version: '1.2.0',
  exports: ['normalizar-cpf'],
  ...overrides,
});

describe('portão da referência a outra extensão', () => {
  it('passa quando a dona está instalada, na faixa, e exporta o artefato', () => {
    expect(crossExtensionRefIssues(consumer('com.acme.utils/normalizar-cpf'), [utils()])).toEqual([]);
  });

  it('recusa quando a extensão dona não está instalada', () => {
    const issues = crossExtensionRefIssues(consumer('com.acme.utils/normalizar-cpf'), []);
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/install.dependency-missing']);
    expect(issues[0].messageParams).toMatchObject({ plugin: 'com.acme.utils', id: 'normalizar-cpf' });
  });

  it('recusa quando a versão instalada não satisfaz a faixa declarada', () => {
    const issues = crossExtensionRefIssues(
      consumer('com.acme.utils/normalizar-cpf'),
      [utils({ version: '2.0.0' })],
    );
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/diagnostic.dependency.unsatisfied']);
    expect(issues[0].messageParams).toMatchObject({ range: '^1.0.0', installed: '2.0.0' });
  });

  /** Ausência de `exports` é superfície VAZIA, não superfície total. */
  it('recusa o artefato que a dona não declara em exports', () => {
    const undeclared = crossExtensionRefIssues(
      consumer('com.acme.utils/interno-cache'),
      [utils()],
    );
    expect(undeclared.map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.not-exported']);

    const nothingDeclared = crossExtensionRefIssues(
      consumer('com.acme.utils/normalizar-cpf'),
      [{ id: 'com.acme.utils', version: '1.2.0' }],
    );
    expect(nothingDeclared.map((i) => i.message)).toEqual(['@core.marketplace/issue.ref.not-exported']);
  });

  it('ignora referência local — o portão só existe para a qualificada', () => {
    expect(crossExtensionRefIssues(consumer('normalizar-cpf'), [])).toEqual([]);
  });

  it('o mesmo artefato referenciado duas vezes é um problema só', () => {
    const pkg = consumer('com.acme.utils/normalizar-cpf');
    pkg.workflows.push({ ...pkg.workflows[0], templateId: 'wf-2', name: 'W2' });
    expect(crossExtensionRefIssues(pkg, [])).toHaveLength(1);
  });
});

const utilsPackage = (scriptIds: string[]): MarketplacePlugin => ({
  summary: '',
  manifest: { id: 'com.acme.utils', version: '1.1.0', kernel: '^2.0.0', name: 'Utils', exports: scriptIds },
  workflows: [],
  scripts: scriptIds.map((templateId) => ({
    templateId, name: templateId, sourceTs: '', compiledJs: '', inputParams: [], outputParams: [],
  })),
});

const dependent = (scriptId: string) => ({
  id: 'com.acme.vendas',
  package: consumer(scriptId),
});

describe('portão da versão que deixa de trazer um artefato em uso', () => {
  it('passa quando a versão nova continua trazendo o artefato referenciado', () => {
    expect(dependentRefIssues(utilsPackage(['normalizar-cpf']), [dependent('com.acme.utils/normalizar-cpf')]))
      .toEqual([]);
  });

  it('recusa quando o artefato referenciado sumiu do pacote', () => {
    const issues = dependentRefIssues(utilsPackage([]), [dependent('com.acme.utils/normalizar-cpf')]);
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/install.dependent-breaks']);
    expect(issues[0].messageParams).toMatchObject({ dependent: 'com.acme.vendas', id: 'normalizar-cpf' });
  });

  /** Perder o DONO basta: `findByRef` casa `sourceId` E dono, e outra dona não devolve este artefato. */
  it('recusa mesmo quando outra extensão traz o mesmo artefato', () => {
    const outra = { id: 'com.outra.lib', package: utilsPackage(['normalizar-cpf']) };
    const issues = dependentRefIssues(utilsPackage([]), [dependent('com.acme.utils/normalizar-cpf'), outra]);
    expect(issues).toHaveLength(1);
  });

  it('ignora o dependente que aponta para OUTRA extensão', () => {
    expect(dependentRefIssues(utilsPackage([]), [dependent('com.terceira.lib/normalizar-cpf')])).toEqual([]);
  });

  it('ignora a referência local do dependente — ela nunca dependeu deste pacote', () => {
    expect(dependentRefIssues(utilsPackage([]), [dependent('normalizar-cpf')])).toEqual([]);
  });

  it('ignora o próprio pacote na lista — reinstalar não é depender de si', () => {
    const proprio = { id: 'com.acme.utils', package: consumer('com.acme.utils/normalizar-cpf') };
    expect(dependentRefIssues(utilsPackage([]), [proprio])).toEqual([]);
  });

  it('dois passos do mesmo dependente no mesmo artefato são um problema só', () => {
    const pkg = consumer('com.acme.utils/normalizar-cpf');
    pkg.workflows.push({ ...pkg.workflows[0], templateId: 'wf-2', name: 'W2' });
    expect(dependentRefIssues(utilsPackage([]), [{ id: 'com.acme.vendas', package: pkg }])).toHaveLength(1);
  });

  /**
   * O dependente que só chama de dentro de um laço é o caso que reabria este portão inteiro: enquanto
   * a colheita de referências não descia na árvore de passos, ele era invisível aqui — a atualização
   * passava e o dependente quebrava na primeira execução, que é exatamente o que este portão existe
   * para não deixar acontecer.
   */
  it('conta o dependente que chama o artefato de dentro de um laço', () => {
    const emLaco = consumer('nao-usado');
    emLaco.workflows[0].steps = [{
      id: 'L', stepDefinitionId: '', type: 'Loop', order: 0, enabled: true, configuration: {},
      loop: {
        source: { kind: 'Literal', value: '[]' }, itemName: 'item', outputName: 'out',
        body: [{
          id: 's', stepDefinitionId: 'script', type: 'Action', order: 0, enabled: true,
          configuration: { scriptId: { kind: 'Literal', value: 'com.acme.utils/normalizar-cpf' } },
        }],
      },
    }];
    const issues = dependentRefIssues(utilsPackage([]), [{ id: 'com.acme.vendas', package: emLaco }]);
    expect(issues.map((i) => i.message)).toEqual(['@core.marketplace/install.dependent-breaks']);
  });
});

/**
 * A OUTRA metade do portão. Ele responde "esta referência resolve?"; esta responde "o que há para
 * referenciar?" — e sem a segunda a primeira só servia a quem já soubesse o nome de cor.
 */
describe('a superfície pública de um pacote', () => {
  const rico: MarketplacePlugin = {
    summary: '',
    manifest: {
      id: 'com.acme.utils', version: '1.0.0', kernel: '^2.0.0', name: 'Utils',
      exports: ['normalizar-cpf', 'cobrar', 'abrir', 'fantasma'],
    },
    workflows: [{
      templateId: 'cobrar', name: 'Cobrar', eventName: 'workflow.called', version: 1,
      condition: { kind: 'AlwaysTrue' }, steps: [],
    }],
    actions: [{
      templateId: 'abrir', key: 'abrir', title: 'Abrir', icon: 'eye', workflowId: 'cobrar',
      order: 0, enabled: true, danger: false,
    }],
    scripts: [{
      templateId: 'normalizar-cpf', name: 'Normalizar CPF', sourceTs: '', compiledJs: '',
      inputParams: [], outputParams: [],
    }],
  };

  /** O `kind` decide ONDE a referência cabe, e o nome é o que faz o artefato ser reconhecível. */
  it('casa cada id declarado com o artefato que o atende, para dar tipo e nome', () => {
    expect(exportedSurface(rico)).toStrictEqual([
      { id: 'abrir', kind: 'action', name: 'Abrir' },
      { id: 'cobrar', kind: 'workflow', name: 'Cobrar' },
      { id: 'fantasma', kind: 'unknown', name: 'fantasma' },
      { id: 'normalizar-cpf', kind: 'script', name: 'Normalizar CPF' },
    ]);
  });

  /** Superfície é o que a dona DECLARA — nunca o que ela carrega. */
  it('pacote sem exports não expõe nada, mesmo carregando artefatos', () => {
    expect(exportedSurface({ ...rico, manifest: { ...rico.manifest, exports: undefined } })).toEqual([]);
  });
});

/**
 * Na instalação todo pacote está à vista: o gatilho que escuta outra extensão resolve pelas telas das
 * dependências instaladas, e o prefixo que nenhuma delas emite é recusa — nomeando o prefixo.
 */
describe('portão do gatilho no evento de outra extensão', () => {
  const processo: MarketplacePlugin = {
    summary: '',
    manifest: { id: 'com.microteia.processo', version: '2.1.0', kernel: '^2.0.0', name: 'Processos' },
    screens: [{
      key: 'processos', titleSingular: 'Processo', titlePlural: 'Processos', icon: 'gavel', titleFieldKey: 'n',
      dataCollection: 'cases', eventPrefix: 'case',
      fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }],
    }],
    workflows: [],
  };
  const installed = [{ id: 'com.microteia.processo', version: '2.1.0', eventPrefixes: emittedEventPrefixes(processo) }];

  const pushes = (eventName: string, dependencies: Record<string, { version: string; collections?: string[] }>): MarketplacePlugin => ({
    summary: '',
    manifest: { id: 'com.microteia.push', version: '1.0.0', kernel: '^2.0.0', name: 'Pushes', dependencies },
    workflows: [{ templateId: 'vincular', name: 'Vincular', eventName, version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
  });

  it('o prefixo emitido pela tela da dependência declarada é aceito', () => {
    expect(emittedEventPrefixes(processo)).toEqual(['case']);
    const pkg = pushes('case.saved', { 'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] } });
    expect(crossExtensionRefIssues(pkg, installed)).toEqual([]);
  });

  it('o prefixo emitido por extensão NÃO declarada é recusado, dizendo qual declarar', () => {
    const pkg = pushes('case.saved', { 'com.acme.utils': { version: '^1.0.0' } });
    const issues = crossExtensionRefIssues(pkg, installed);
    expect(issues).toEqual([{
      message: '@core.marketplace/issue.ref.event-undeclared',
      messageParams: { origin: '@core.marketplace/ref.origin.workflow', name: 'Vincular', prefix: 'case', plugin: 'com.microteia.processo' },
    }]);
  });

  it('o prefixo que nenhuma extensão instalada emite é recusado, nomeando o prefixo', () => {
    const pkg = pushes('casse.saved', { 'com.microteia.processo': { version: '^2.0.0' } });
    expect(crossExtensionRefIssues(pkg, installed)).toEqual([{
      message: '@core.marketplace/issue.ref.event-unresolved',
      messageParams: { origin: '@core.marketplace/ref.origin.workflow', name: 'Vincular', prefix: 'casse' },
    }]);
  });

  it('a dependência declarada mas não instalada não resolve o prefixo', () => {
    const pkg = pushes('case.saved', { 'com.microteia.processo': { version: '^2.0.0' } });
    expect(crossExtensionRefIssues(pkg, []).map((issue) => issue.message))
      .toEqual(['@core.marketplace/issue.ref.event-unresolved']);
  });
});

/**
 * O sentido inverso do gatilho: uma versão de Processos cuja tela deixa de emitir `case` instalaria, e
 * a automação de Pushes pararia de disparar sem erro nenhum — evento que ninguém publica não falha.
 */
describe('portão inverso do gatilho no evento de outra extensão', () => {
  const processo = (eventPrefix?: string): MarketplacePlugin => ({
    summary: '',
    manifest: { id: 'com.microteia.processo', version: eventPrefix ? '2.1.0' : '3.0.0', kernel: '^2.0.0', name: 'Processos' },
    screens: [{
      key: 'processos', titleSingular: 'Processo', titlePlural: 'Processos', icon: 'gavel', titleFieldKey: 'n',
      dataCollection: 'cases', ...(eventPrefix ? { eventPrefix } : {}),
      fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }],
    }],
    workflows: [],
  });
  const pushes: MarketplacePlugin = {
    summary: '',
    manifest: {
      id: 'com.microteia.push', version: '1.0.0', kernel: '^2.0.0', name: 'Pushes',
      dependencies: { 'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] } },
    },
    workflows: [{ templateId: 'vincular', name: 'Vincular', eventName: 'case.saved', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
  };
  const dependents = [{ id: 'com.microteia.push', package: pushes }];

  it('recusa a versão que deixa de emitir o prefixo que um dependente escuta', () => {
    expect(dependentRefIssues(processo(), dependents, processo('case'))).toEqual([{
      message: '@core.marketplace/install.dependent-event-breaks',
      messageParams: {
        dependent: 'com.microteia.push',
        origin: '@core.marketplace/ref.origin.workflow',
        name: 'Vincular',
        prefix: 'case',
      },
    }]);
  });

  it('a versão que continua emitindo o prefixo passa', () => {
    expect(dependentRefIssues(processo('case'), dependents, processo('case'))).toEqual([]);
  });

  it('instalação nova não tira prefixo de ninguém', () => {
    expect(dependentRefIssues(processo(), dependents)).toEqual([]);
  });

  it('o gatilho que já não resolvia antes da troca não é cobrado desta versão', () => {
    expect(dependentRefIssues(processo(), dependents, processo('outro'))).toEqual([]);
  });
});
