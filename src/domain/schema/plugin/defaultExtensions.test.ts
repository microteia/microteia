import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTENSIONS_MAX,
  defaultExtensionsOnboardingOf,
  defaultInstallPlan,
  defaultMarkIssues,
  defaultUnmarkIssues,
  type DefaultCatalogSide,
} from './defaultExtensions';
import { registrationPolicyOf } from '../registration';

const entry = (id: string, over: Partial<DefaultCatalogSide> = {}): DefaultCatalogSide => ({
  id, status: 'approved', proven: true, ...over,
});

const noBuiltin = () => false;
const messages = (issues: { message: string }[]) => issues.map((issue) => issue.message);

describe('defaultMarkIssues — o que impede a extensão de virar padrão', () => {
  it('aprovada, comprovada e sem dependência: pode', () => {
    expect(defaultMarkIssues('com.acme.crm', [entry('com.acme.crm')], [], noBuiltin)).toEqual([]);
  });

  it('fora do catálogo, na fila ou obsoleta: o escritório novo não teria de onde instalar', () => {
    expect(messages(defaultMarkIssues('com.acme.crm', [], [], noBuiltin))).toEqual(['@core.marketplace/default.not-approved']);
    expect(messages(defaultMarkIssues('com.acme.crm', [entry('com.acme.crm', { status: 'deprecated' })], [], noBuiltin)))
      .toEqual(['@core.marketplace/default.not-approved']);
  });

  it('publicada antes da prova: ninguém garantiu que a versão do catálogo instala', () => {
    expect(messages(defaultMarkIssues('com.acme.crm', [entry('com.acme.crm', { proven: false })], [], noBuiltin)))
      .toEqual(['@core.marketplace/default.unproven']);
  });

  it('a lista tem teto', () => {
    const full = Array.from({ length: DEFAULT_EXTENSIONS_MAX }, (_, index) => `com.acme.e${index}`);
    expect(defaultMarkIssues('com.acme.crm', [entry('com.acme.crm')], full, noBuiltin)).toEqual([{
      message: '@core.marketplace/default.too-many',
      messageParams: { max: String(DEFAULT_EXTENSIONS_MAX) },
    }]);
  });

  describe('dependência — o escritório novo terá só as padrão', () => {
    const catalog = [entry('com.acme.sales', { dependencies: { 'com.acme.crm': '^1.0.0', 'core.records': '*' } }), entry('com.acme.crm')];

    it('que não é padrão impede, dizendo qual', () => {
      expect(defaultMarkIssues('com.acme.sales', catalog, [], noBuiltin)).toEqual([{
        message: '@core.marketplace/default.dependency-not-default',
        messageParams: { dependency: 'com.acme.crm' },
      }]);
    });

    it('padrão, embutida ou do kernel, não', () => {
      expect(defaultMarkIssues('com.acme.sales', catalog, ['com.acme.crm'], noBuiltin)).toEqual([]);
      expect(defaultMarkIssues('com.acme.sales', catalog, [], (id) => id === 'com.acme.crm')).toEqual([]);
    });
  });
});

describe('defaultUnmarkIssues — o que impede de deixar de ser padrão', () => {
  const catalog = [entry('com.acme.sales', { dependencies: { 'com.acme.crm': '^1.0.0' } }), entry('com.acme.crm')];

  it('outra padrão depende dela', () => {
    expect(defaultUnmarkIssues('com.acme.crm', catalog, ['com.acme.crm', 'com.acme.sales'])).toEqual([{
      message: '@core.marketplace/default.required-by',
      messageParams: { dependent: 'com.acme.sales' },
    }]);
  });

  it('a dependente que não é padrão não segura nada', () => {
    expect(defaultUnmarkIssues('com.acme.crm', catalog, ['com.acme.crm'])).toEqual([]);
  });
});

describe('registrationPolicyOf — defaultExtensions', () => {
  it('documento ausente: nenhuma padrão', () => {
    expect(registrationPolicyOf(undefined).defaultExtensions).toEqual([]);
  });

  it('descarta o que não é id de extensão e repetições', () => {
    expect(registrationPolicyOf({ defaultExtensions: ['com.acme.crm', 'com.acme.crm', 42, 'NÃO VALE'] }).defaultExtensions)
      .toEqual(['com.acme.crm']);
  });
});

describe('defaultInstallPlan — o que o escritório novo de fato instala', () => {
  it('só o que está aprovado e comprovado no catálogo', () => {
    const catalog = [
      entry('com.acme.a'),
      entry('com.acme.b', { proven: false }),
      entry('com.acme.c', { status: 'deprecated' }),
    ];
    expect(defaultInstallPlan(['com.acme.a', 'com.acme.b', 'com.acme.c', 'com.acme.gone'], catalog)).toEqual(['com.acme.a']);
  });

  it('dependência antes de quem depende dela, qualquer que seja a ordem marcada', () => {
    const catalog = [
      entry('com.acme.sales', { dependencies: { 'com.acme.crm': '^1.0.0' } }),
      entry('com.acme.crm', { dependencies: { 'com.acme.base': '^1.0.0', 'core.records': '*' } }),
      entry('com.acme.base'),
    ];
    expect(defaultInstallPlan(['com.acme.sales', 'com.acme.crm', 'com.acme.base'], catalog))
      .toEqual(['com.acme.base', 'com.acme.crm', 'com.acme.sales']);
  });

  it('um ciclo não trava a ordem — a instalação recusa o que não resolve', () => {
    const catalog = [
      entry('com.acme.a', { dependencies: { 'com.acme.b': '*' } }),
      entry('com.acme.b', { dependencies: { 'com.acme.a': '*' } }),
    ];
    expect(defaultInstallPlan(['com.acme.a', 'com.acme.b'], catalog)).toHaveLength(2);
  });
});

describe('defaultExtensionsOnboardingOf', () => {
  it('documento ausente: nada pendente', () => {
    expect(defaultExtensionsOnboardingOf(undefined)).toEqual({ pending: [], failed: [] });
  });

  it('só texto entra', () => {
    expect(defaultExtensionsOnboardingOf({ pending: ['com.acme.a', 7], failed: 'x' })).toEqual({ pending: ['com.acme.a'], failed: [] });
  });
});
