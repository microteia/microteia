import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTENSIONS_MAX,
  defaultExtensionsOnboardingOf,
  defaultInstallPlan,
  defaultMarkIssues,
  defaultUnmarkIssues,
  onboardingPlanWindowEnd,
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

  describe('embutida — viaja no bundle, mas não está instalada no escritório novo', () => {
    const builtin = (id: string) => id === 'com.microteia.locale-pt-br';

    it('pode, mesmo fora do catálogo e sem prova', () => {
      expect(defaultMarkIssues('com.microteia.locale-pt-br', [], [], builtin)).toEqual([]);
    });

    it('o teto vale para ela também', () => {
      const full = Array.from({ length: DEFAULT_EXTENSIONS_MAX }, (_, index) => `com.acme.e${index}`);
      expect(messages(defaultMarkIssues('com.microteia.locale-pt-br', [], full, builtin)))
        .toEqual(['@core.marketplace/default.too-many']);
    });
  });
});

describe('defaultUnmarkIssues — o que impede de deixar de ser padrão', () => {
  const catalog = [entry('com.acme.sales', { dependencies: { 'com.acme.crm': '^1.0.0' } }), entry('com.acme.crm')];

  it('outra padrão depende dela', () => {
    expect(defaultUnmarkIssues('com.acme.crm', catalog, ['com.acme.crm', 'com.acme.sales'], noBuiltin)).toEqual([{
      message: '@core.marketplace/default.required-by',
      messageParams: { dependent: 'com.acme.sales' },
    }]);
  });

  it('a dependente que não é padrão não segura nada', () => {
    expect(defaultUnmarkIssues('com.acme.crm', catalog, ['com.acme.crm'], noBuiltin)).toEqual([]);
  });

  it('a embutida nunca é segurada — quem instala a dependente instala a dependência embutida', () => {
    expect(defaultUnmarkIssues('com.acme.crm', catalog, ['com.acme.crm', 'com.acme.sales'], (id) => id === 'com.acme.crm'))
      .toEqual([]);
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
  it('do catálogo, só o que está aprovado e comprovado', () => {
    const catalog = [
      entry('com.acme.a'),
      entry('com.acme.b', { proven: false }),
      entry('com.acme.c', { status: 'deprecated' }),
    ];
    expect(defaultInstallPlan(['com.acme.a', 'com.acme.b', 'com.acme.c'], catalog)).toEqual(['com.acme.a']);
  });

  it('o que não está no catálogo é embutida, e vem antes — a tradução chega antes da semente que ela traduz', () => {
    const catalog = [entry('com.acme.a')];
    expect(defaultInstallPlan(['com.acme.a', 'com.microteia.locale-pt-br', 'com.microteia.brasil'], catalog))
      .toEqual(['com.microteia.locale-pt-br', 'com.microteia.brasil', 'com.acme.a']);
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

describe('janela de instalação do teto do plano (#28)', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('lê o começo como Timestamp do Firestore ou número', () => {
    expect(defaultExtensionsOnboardingOf({ pending: [], startedAt: { toMillis: () => 42 } }).startedAt).toBe(42);
    expect(defaultExtensionsOnboardingOf({ pending: [], startedAt: 7 }).startedAt).toBe(7);
    expect(defaultExtensionsOnboardingOf({ pending: [], startedAt: 'x' }).startedAt).toBeUndefined();
  });

  it('vale com pendente, depois do começo e antes do prazo', () => {
    expect(onboardingPlanWindowEnd({ pending: ['a'], failed: [], startedAt: 1000 }, 2000)).toBe(1000 + DAY);
    expect(onboardingPlanWindowEnd({ pending: ['a'], failed: [], startedAt: 1000 }, 1000 + DAY)).toBeNull();
    expect(onboardingPlanWindowEnd({ pending: ['a'], failed: [] }, 2000)).toBeNull();
    expect(onboardingPlanWindowEnd({ pending: [], failed: [], startedAt: 1000 }, 2000)).toBeNull();
    expect(onboardingPlanWindowEnd(null, 2000)).toBeNull();
  });
});
