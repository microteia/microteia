import { describe, it, expect } from 'vitest';
import { canPublishPublicly, extensionHasCode, isVersionGreater, publishRefusal } from './publicExtension';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PublicExtension } from '../../entities/PublicExtension';

const base: MarketplacePlugin = {
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X' },
  summary: '', workflows: [],
};

const withCode: MarketplacePlugin = {
  ...base,
  views: [{ key: 'k', title: 'K', icon: 'layoutGrid', source: 'export default () => null;' }],
};

const publishedAs = (version: string, ownerTenantId = 't1'): PublicExtension => ({
  domain: 'com.acme.x',
  package: { ...base, manifest: { ...base.manifest, version } },
  ownerTenantId,
  ownerName: 'Dona',
  ownerPhotoURL: null,
  version,
  status: 'approved',
  hasCode: false,
  publishedAt: new Date(),
  publishedBy: 'u1',
});

describe('publicExtension helpers', () => {
  it('extensão com views tem código; sem views, não', () => {
    expect(extensionHasCode(withCode)).toBe(true);
    expect(extensionHasCode(base)).toBe(false);
  });

  it('só o SYSTEM publica extensão com código; sem código, qualquer dono publica', () => {
    expect(canPublishPublicly(withCode, false)).toBe(false);
    expect(canPublishPublicly(withCode, true)).toBe(true);
    expect(canPublishPublicly(base, false)).toBe(true);
  });

  it('isVersionGreater compara semver', () => {
    expect(isVersionGreater('1.2.0', '1.1.9')).toBe(true);
    expect(isVersionGreater('1.0.0', '1.0.0')).toBe(false);
    expect(isVersionGreater('1.0.0', '1.0.1')).toBe(false);
    expect(isVersionGreater('2.0.0', '1.9.9')).toBe(true);
    expect(isVersionGreater('abc', '1.0.0')).toBe(false);
  });
});

describe('publishRefusal', () => {
  const attempt = (over: Partial<Parameters<typeof publishRefusal>[0]>) =>
    publishRefusal({ pkg: base, isSystem: false, ownerTenantId: 't1', published: undefined, ...over });

  it('publicação inédita, sem código, passa', () => {
    expect(attempt({})).toBeNull();
  });

  it('versão fora do semver é recusada antes de qualquer outra checagem', () => {
    const pkg = { ...base, manifest: { ...base.manifest, version: '1.0' } };
    expect(attempt({ pkg })).toBe('invalid-version');
  });

  it('extensão com código nas mãos de quem não é SYSTEM é recusada', () => {
    expect(attempt({ pkg: withCode })).toBe('code-requires-system');
    expect(attempt({ pkg: withCode, isSystem: true })).toBeNull();
  });

  it('domínio publicado por OUTRO escritório é recusado', () => {
    expect(attempt({ published: publishedAs('0.9.0', 't2') })).toBe('id-taken');
  });

  it('republicar exige versão maior — a igual ninguém receberia', () => {
    expect(attempt({ published: publishedAs('1.0.0') })).toBe('version-not-greater');
    expect(attempt({ published: publishedAs('1.1.0') })).toBe('version-not-greater');
    expect(attempt({ published: publishedAs('0.9.0') })).toBeNull();
  });
});
