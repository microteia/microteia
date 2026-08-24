import { describe, it, expect } from 'vitest';
import { collectPluginLicenses, licenseOf } from './pluginLicenses';
import type { PluginManifest } from '../../schema/plugin/pluginManifest';

const manifest = (id: string, license?: unknown): PluginManifest => ({
  id,
  version: '1.0.0',
  kernel: '^2.0.0',
  name: `@${id}/package.name`,
  ...(license === undefined ? {} : { license }),
});

const TERMS = { type: 'stack', children: [{ type: 'markdown', content: '@x/license.body' }] };

describe('collectPluginLicenses', () => {
  it('devolve só quem declarou termos, preservando a ordem dos manifests', () => {
    const licenses = collectPluginLicenses([
      manifest('core.ui'),
      manifest('com.acme.b', TERMS),
      manifest('com.acme.a', TERMS),
    ]);

    expect(licenses.map((entry) => entry.pluginId)).toEqual(['com.acme.b', 'com.acme.a']);
    expect(licenses[0].license).toBe(TERMS);
  });

  it('mantém o nome como REFERÊNCIA, porque quem tem idioma é quem exibe', () => {
    const [entry] = collectPluginLicenses([manifest('com.acme.a', TERMS)]);
    expect(entry.name).toBe('@com.acme.a/package.name');
  });

  it('atravessa manifest ausente — `manifestOf` devolve `undefined` para id que não carregou', () => {
    expect(collectPluginLicenses([undefined, manifest('com.acme.a', TERMS)])).toHaveLength(1);
  });

  it('descarta o que não DESENHA — um termo malformado não vira ícone que abre modal vazio', () => {
    expect(licenseOf(manifest('com.acme.a', {}))).toBeNull();
    expect(licenseOf(manifest('com.acme.a', { type: 'nope' }))).toBeNull();
    expect(licenseOf(manifest('com.acme.a'))).toBeNull();
    expect(licenseOf(undefined)).toBeNull();
    expect(licenseOf(manifest('com.acme.a', TERMS))).toBe(TERMS);
    expect(collectPluginLicenses([manifest('com.acme.a', {})])).toEqual([]);
  });
});
