import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { TenantExtension } from '../../entities/TenantExtension';
import { authoringRefusal, importRefusal, isAuthoredHere, legacyOriginOf } from './extensionOrigin';

const pkg = (manifest: Record<string, unknown> = {}, rest: Record<string, unknown> = {}): MarketplacePlugin => ({
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X', ...manifest },
  summary: 'x',
  workflows: [],
  ...rest,
} as MarketplacePlugin);

const extension = (origin: TenantExtension['origin']): TenantExtension => ({
  id: 'com.acme.x', tenantId: 't1', active: false, package: pkg(), origin,
  createdBy: 'u1', createdAt: new Date(), updatedAt: new Date(),
});

describe('legacyOriginOf — o documento gravado antes de a origem existir', () => {
  it('campo que a tela de autoria nunca escreve prova que veio de fora', () => {
    expect(legacyOriginOf(pkg({ publisher: { name: 'Acme' } }))).toBe('imported');
    expect(legacyOriginOf(pkg({ license: { type: 'text' } }))).toBe('imported');
    expect(legacyOriginOf(pkg({ backend: { functions: ['f'] } }))).toBe('imported');
    expect(legacyOriginOf(pkg({}, { overview: { type: 'text' } }))).toBe('imported');
    expect(legacyOriginOf(pkg({}, { reports: [{ templateId: 'r' }] }))).toBe('imported');
  });

  it('o caso ambíguo continua editável, como sempre foi', () => {
    expect(legacyOriginOf(pkg({ category: 'Cobrança', icon: 'calendar' }, { screens: [] }))).toBe('authored');
  });

  it('campo vazio não prova nada', () => {
    expect(legacyOriginOf(pkg({ exports: [], publisher: {} }))).toBe('authored');
  });
});

describe('o que cada origem permite', () => {
  it('só a montada aqui se edita e se exporta', () => {
    expect(isAuthoredHere(extension('authored'))).toBe(true);
    expect(isAuthoredHere(extension('imported'))).toBe(false);
    expect(isAuthoredHere(undefined)).toBe(false);
  });

  it('a tela de autoria não grava por cima de uma importada', () => {
    expect(authoringRefusal(extension('imported'))?.message).toBe('@core.marketplace/author.imported-locked');
    expect(authoringRefusal(extension('authored'))).toBeNull();
    expect(authoringRefusal(undefined)).toBeNull();
  });

  it('importar não substitui uma montada aqui, mas atualiza uma importada', () => {
    expect(importRefusal(extension('authored'))?.message).toBe('@core.marketplace/import.authored-here');
    expect(importRefusal(extension('imported'))).toBeNull();
    expect(importRefusal(undefined)).toBeNull();
  });
});
