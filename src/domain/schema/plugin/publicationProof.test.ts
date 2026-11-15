import { describe, expect, it } from 'vitest';
import { backendFingerprint } from './backendRequirement';
import {
  catalogDependentIssues,
  publicationKind,
  publicationProofIssues,
  publicationRevision,
  type InstalledCopySide,
  type PublicationFacts,
  type PublishablePackage,
} from './publicationProof';

const pkg = (over: Partial<PublishablePackage> = {}, manifest: Partial<PublishablePackage['manifest']> = {}): PublishablePackage => ({
  manifest: { id: 'com.acme.crm', version: '1.0.0', ...manifest },
  ...over,
});

const copy = (over: Partial<InstalledCopySide> = {}): InstalledCopySide => ({
  active: true,
  source: 'private',
  package: pkg(),
  ...over,
});

const facts = (over: Partial<PublicationFacts> = {}): PublicationFacts => ({
  installed: copy(),
  codeHash: null,
  projectBackend: [],
  appliedMigrationIds: new Set(),
  siblings: new Map(),
  catalog: [],
  ...over,
});

const messages = (input: PublicationFacts) => publicationProofIssues(input).map((issue) => issue.message);

describe('publicationProofIssues — o que impede a versão instalada de ir ao catálogo', () => {
  it('instalada, ligada e sem pendência: pode', () => {
    expect(publicationProofIssues(facts())).toEqual([]);
  });

  it('não instalada aqui: ninguém provou que ela sobe', () => {
    expect(messages(facts({ installed: null }))).toEqual(['@core.marketplace/publish.not-installed']);
  });

  it('a cópia embutida viaja no bundle, não no catálogo', () => {
    expect(messages(facts({ installed: copy({ source: 'builtin' }) }))).toEqual(['@core.marketplace/publish.builtin-copy']);
  });

  it('desligada não prova nada', () => {
    expect(messages(facts({ installed: copy({ active: false }) }))).toEqual(['@core.marketplace/publish.inactive']);
  });

  describe('backend', () => {
    const backend = { functions: ['crmSync'] };
    const withBackend = pkg({}, { backend });
    const declared = backendFingerprint(backend);

    it('pendente: todo escritório que a instalasse ficaria esperando o provision', () => {
      expect(messages(facts({ installed: copy({ package: withBackend }) })))
        .toEqual(['@core.marketplace/publish.backend-pending']);
    });

    it('no ar pelo carimbo da cópia', () => {
      expect(publicationProofIssues(facts({
        installed: copy({ package: withBackend, backendState: { fingerprint: declared } }),
      }))).toEqual([]);
    });

    it('no ar pelo que o PROJETO tem aplicado — a function é do projeto', () => {
      expect(publicationProofIssues(facts({
        installed: copy({ package: withBackend }),
        projectBackend: [{ pluginId: 'com.acme.crm', fingerprint: declared }],
      }))).toEqual([]);
    });

    it('o projeto rodando OUTRA exigência não conta', () => {
      expect(messages(facts({
        installed: copy({ package: withBackend }),
        projectBackend: [{ pluginId: 'com.acme.crm', fingerprint: backendFingerprint({ functions: ['old'] }) }],
      }))).toEqual(['@core.marketplace/publish.backend-pending']);
    });
  });

  describe('migração', () => {
    const migration = { id: 'fill-status', version: '1.0.0', name: 'Fill', sourceTs: 'return { remaining: 0 };' };

    it('obrigatória e não aplicada: a extensão está fora do boot aqui mesmo', () => {
      expect(messages(facts({ installed: copy({ package: pkg({ migrations: [migration] }) }) })))
        .toEqual(['@core.marketplace/publish.migration-pending']);
    });

    it('aplicada, ou opcional, não impede', () => {
      expect(publicationProofIssues(facts({
        installed: copy({ package: pkg({ migrations: [migration] }) }),
        appliedMigrationIds: new Set(['fill-status']),
      }))).toEqual([]);
      expect(publicationProofIssues(facts({
        installed: copy({ package: pkg({ migrations: [{ ...migration, required: false }] }) }),
      }))).toEqual([]);
    });
  });

  describe('código', () => {
    const withCode = pkg({ views: [{ key: 'board', source: 'export default () => null;' }] });

    it('não revisado aqui: ninguém executou o código que rodaria no navegador dos outros', () => {
      expect(messages(facts({ installed: copy({ package: withCode }), codeHash: 'h1' })))
        .toEqual(['@core.marketplace/publish.code-not-trusted']);
    });

    it('revisado com o hash do código de agora', () => {
      expect(publicationProofIssues(facts({
        installed: copy({ package: withCode, codeTrust: { hash: 'h1' } }),
        codeHash: 'h1',
      }))).toEqual([]);
    });

    it('revisado em OUTRO código não vale', () => {
      expect(messages(facts({
        installed: copy({ package: withCode, codeTrust: { hash: 'h0' } }),
        codeHash: 'h1',
      }))).toEqual(['@core.marketplace/publish.code-not-trusted']);
    });
  });

  describe('dependência — alcançável por quem instala do catálogo', () => {
    const dependent = (range = '^1.0.0') => copy({ package: pkg({}, { dependencies: { 'com.acme.base': range } }) });

    it('do kernel: sempre presente', () => {
      expect(publicationProofIssues(facts({
        installed: copy({ package: pkg({}, { dependencies: { 'core.records': '*' } }) }),
      }))).toEqual([]);
    });

    it('não instalada aqui', () => {
      expect(publicationProofIssues(facts({ installed: dependent() }))).toEqual([{
        message: '@core.marketplace/publish.dependency-not-installed',
        messageParams: { dependency: 'com.acme.base' },
      }]);
    });

    it('embutida: todo escritório a instala do próprio bundle', () => {
      expect(publicationProofIssues(facts({
        installed: dependent(),
        siblings: new Map([['com.acme.base', { source: 'builtin' }]]),
      }))).toEqual([]);
    });

    it('cópia privada sem par no catálogo funciona aqui e em lugar nenhum mais', () => {
      expect(publicationProofIssues(facts({
        installed: dependent(),
        siblings: new Map([['com.acme.base', { source: 'private' }]]),
      }))).toEqual([{
        message: '@core.marketplace/publish.dependency-not-in-catalog',
        messageParams: { dependency: 'com.acme.base', range: '^1.0.0' },
      }]);
    });

    it('no catálogo, aprovada e dentro da faixa', () => {
      expect(publicationProofIssues(facts({
        installed: dependent(),
        siblings: new Map([['com.acme.base', { source: 'private' }]]),
        catalog: [{ id: 'com.acme.base', version: '1.4.0', status: 'approved' }],
      }))).toEqual([]);
    });

    it('no catálogo, mas fora da faixa ou ainda na fila', () => {
      const siblings = new Map([['com.acme.base', { source: 'public' }]]);
      expect(messages(facts({
        installed: dependent('^2.0.0'),
        siblings,
        catalog: [{ id: 'com.acme.base', version: '1.4.0', status: 'approved' }],
      }))).toEqual(['@core.marketplace/publish.dependency-not-in-catalog']);
      expect(messages(facts({
        installed: dependent(),
        siblings,
        catalog: [{ id: 'com.acme.base', version: '1.4.0', status: 'pending' }],
      }))).toEqual(['@core.marketplace/publish.dependency-not-in-catalog']);
    });
  });
});

describe('catalogDependentIssues — o que esta versão faz às outras do catálogo', () => {
  const catalog = [{ id: 'com.acme.sales', version: '1.0.0', status: 'approved', dependencies: { 'com.acme.crm': '^1.0.0' } }];

  it('a versão que sai da faixa de uma dependente aprovada pede consentimento', () => {
    expect(catalogDependentIssues(pkg({}, { version: '2.0.0' }), catalog, '1.3.0')).toEqual([{
      message: '@core.marketplace/publish.dependent-out-of-range',
      messageParams: { dependent: 'com.acme.sales', range: '^1.0.0', version: '2.0.0' },
    }]);
  });

  it('dentro da faixa, nada', () => {
    expect(catalogDependentIssues(pkg({}, { version: '1.4.0' }), catalog, '1.3.0')).toEqual([]);
  });

  it('só conta o que ESTA publicação quebra: a dependente que já estava fora não vira aviso', () => {
    expect(catalogDependentIssues(pkg({}, { version: '3.0.0' }), catalog, '2.0.0')).toEqual([]);
  });

  it('primeira publicação não quebra ninguém', () => {
    expect(catalogDependentIssues(pkg({}, { version: '2.0.0' }), catalog, null)).toEqual([]);
  });
});

describe('publicationKind', () => {
  const installed = pkg();

  it('sem entrada no catálogo, ou com outro conteúdo: publicar', () => {
    expect(publicationKind(installed, undefined)).toBe('publish');
    expect(publicationKind(installed, { package: pkg({}, { version: '0.9.0' }) })).toBe('publish');
  });

  it('o mesmo conteúdo, publicado antes da regra: só comprovar', () => {
    expect(publicationKind(installed, { package: pkg(), proof: null })).toBe('prove');
  });

  it('o mesmo conteúdo, já comprovado: nada a fazer', () => {
    const proof = { tenantId: 't1', version: '1.0.0', revision: publicationRevision(installed), provenBy: 'u1', provenAt: new Date() };
    expect(publicationKind(installed, { package: pkg(), proof })).toBe('proven');
  });

  it('a identidade de conteúdo ignora a ordem das chaves — o Firestore não a preserva', () => {
    const reordered = { manifest: { version: '1.0.0', id: 'com.acme.crm' } };
    expect(publicationKind(installed, { package: reordered, proof: null })).toBe('prove');
  });
});
