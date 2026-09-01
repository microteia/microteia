import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { crossExtensionRefIssues, dependentRefIssues } from './crossExtensionRefs';

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
});
