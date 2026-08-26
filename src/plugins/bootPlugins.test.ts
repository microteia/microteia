import { describe, expect, it } from 'vitest';
import { parseStampedExtensions } from '../infrastructure/boot/stampedExtensions';
import { extensionRecordFrom } from '../domain/usecases/plugins/extensionRecordFrom';
import { createPluginHost } from '../kernel';
import { CORE_PLUGINS } from './index';
import { AUTH_PROVIDER_POINT, type AuthProviderMetadata } from '../domain/schema/auth';
import { UI_PAGE_POINT } from '../domain/schema/ui/uiExtensionPoints';

const ssoPackage = {
  manifest: {
    id: 'com.acme.sso',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Acme SSO',
    contributes: [
      {
        point: AUTH_PROVIDER_POINT,
        id: 'acme',
        apiVersion: '1.0.0',
        metadata: {
          key: 'acme',
          label: 'Entrar com a Acme',
          kind: 'oidc',
          providerId: 'oidc.acme',
          order: 5,
        },
      },
    ],
  },
};

describe('o carimbo da instalação', () => {
  it('sem carimbo, não há extensão nenhuma', () => {
    expect(parseStampedExtensions(undefined)).toEqual([]);
  });

  /**
   * Este é o PRIMEIRO código que roda na página. Um deploy interrompido, uma edição à mão ou um cache
   * antigo produzem exatamente o mesmo tipo de arquivo pela metade — e aqui uma exceção é a tela
   * branca. Por isso a leitura descarta em vez de lançar.
   */
  it('descarta o que não é pacote, em vez de lançar', () => {
    expect(parseStampedExtensions('não é uma lista')).toEqual([]);
    expect(parseStampedExtensions(
      [null, 42, {}, { manifest: {} }, { manifest: { id: 'x', version: '1.0.0' } }],
    )).toEqual([]);
  });

  it('aceita o pacote bem formado e descarta o vizinho quebrado', () => {
    const parsed = parseStampedExtensions([
      ssoPackage,
      { manifest: { id: '', version: '1.0.0', contributes: [] } },
    ]);
    expect(parsed.map((pkg) => pkg.manifest.id)).toEqual(['com.acme.sso']);
  });
});

describe('a extensão carimbada no host de boot', () => {
  const hostWith = (packages: unknown[]) => {
    const records = [
      ...CORE_PLUGINS,
      ...parseStampedExtensions(packages).map((pkg) => extensionRecordFrom(pkg, false)),
    ];
    const host = createPluginHost();
    const result = host.load(records);
    return { host, result };
  };

  it('um SSO carimbado chega à tela de entrada', () => {
    const { host, result } = hostWith([ssoPackage]);
    expect(result.loaded).toContain('com.acme.sso');

    const keys = host.contributions
      .query(AUTH_PROVIDER_POINT)
      .map((contribution) => (contribution.metadata as unknown as AuthProviderMetadata).key);
    expect(keys).toContain('acme');
  });

  /**
   * Carimbar não é confiar. É o que permite a quem instala pôr um SSO no ar sem que ninguém revise
   * JavaScript — e é por isso que `trusted: false` não é precaução, é a condição de o mecanismo ser
   * útil.
   */
  it('nunca roda código, mesmo que o pacote traga views', () => {
    const withCode = {
      manifest: {
        ...ssoPackage.manifest,
        contributes: [
          ...ssoPackage.manifest.contributes,
          { point: UI_PAGE_POINT, id: 'guia', apiVersion: '1.0.0', metadata: { key: 'guia', title: 'Guia', icon: 'book' }, impl: { kind: 'code', key: 'Guia' } },
        ],
      },
      views: [{ key: 'Guia', source: 'export const Guia = () => null;' }],
    };

    const { host } = hostWith([withCode]);
    expect(host.implementations.keysOf('com.acme.sso')).toEqual([]);
    const pages = host.contributions
      .query(UI_PAGE_POINT)
      .filter((contribution) => contribution.pluginId === 'com.acme.sso');
    expect(pages).toEqual([]);
  });

  it('um pacote quebrado não impede os plugins do núcleo de carregar', () => {
    const { result } = hostWith([{ manifest: { id: 'com.acme.ruim', version: 'não-é-versão', contributes: [] } }]);
    expect(result.loaded).toContain('core.auth');
    expect(result.loaded).not.toContain('com.acme.ruim');
  });
});
