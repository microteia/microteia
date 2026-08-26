import { describe, expect, it } from 'vitest';
import { createPluginHost } from '../../kernel';
import { hasErrors } from '../../domain/schema/plugin/diagnostics';
import { CORE_PLUGINS } from '../index';
import {
  AUTH_PROVIDER_POINT,
  AUTH_PROVIDER_KINDS_REQUIRING_ID,
  asAuthProviderMetadata,
  authProviderSpecOf,
  authErrorKey,
  GENERIC_AUTH_ERROR_KEY,
  type AuthProviderMetadata,
} from '../../domain/schema/auth';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';

const loadedHost = () => {
  const host = createPluginHost();
  const result = host.load(CORE_PLUGINS);
  return { host, result };
};

const providers = (): AuthProviderMetadata[] => {
  const { host } = loadedHost();
  return host.contributions
    .query(AUTH_PROVIDER_POINT)
    .map((contribution) => contribution.metadata as unknown as AuthProviderMetadata);
};

describe('core.auth — a entrada no sistema como contribuição', () => {
  it('carrega junto dos demais plugins do núcleo, sem diagnóstico', () => {
    const { result } = loadedHost();
    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(result.loaded).toContain('core.auth');
  });

  /**
   * O formulário de e-mail e senha e o botão do Google eram código da tela de entrada. São os dois que
   * o núcleo declara — e o teste não afirma que são DOIS, afirma que chegam por contribuição, que é o
   * que faz o terceiro caber sem tocar na tela.
   */
  it('traz os dois meios de entrada que a tela tinha escritos à mão', () => {
    expect(providers().map((provider) => provider.key).sort()).toEqual(['google', 'password']);
  });

  /**
   * O ponto não aceita implementação nenhuma, e é o que põe o SSO ao alcance de quem não entrega
   * código: `code` é privilégio de primeira parte, e exigi-lo aqui tornaria o login único algo que só
   * nós poderíamos acrescentar.
   */
  it('é declarativo por inteiro — nenhuma contribuição tem implementação', () => {
    const { host } = loadedHost();
    const withImpl = host.contributions
      .query(AUTH_PROVIDER_POINT)
      .filter((contribution) => contribution.impl !== undefined);
    expect(withImpl).toEqual([]);
  });

  it('o núcleo não declara SSO nenhum — quem o traz é a instalação', () => {
    const corporate = providers().filter((provider) => AUTH_PROVIDER_KINDS_REQUIRING_ID.includes(provider.kind));
    expect(corporate).toEqual([]);
  });

  it('o rótulo de cada meio é referência de mensagem, com par em pt-BR', () => {
    const { host } = loadedHost();
    const bundles = messageBundlesOf(host.contributions.query(I18N_MESSAGES_POINT));
    const byLocale = (locale: string) => bundles
      .filter((bundle) => bundle.locale === locale && bundle.namespace === 'core.auth')
      .flatMap((bundle) => Object.keys(bundle.messages));

    const referenced = providers().map((provider) => provider.label);
    expect(referenced.every((label) => label.startsWith('@core.auth/'))).toBe(true);

    const keys = referenced.map((label) => label.replace('@core.auth/', ''));
    for (const locale of ['en', 'pt-BR']) {
      expect(byLocale(locale), locale).toEqual(expect.arrayContaining(keys));
    }
  });
});

describe('a leitura de uma declaração de terceiro', () => {
  /**
   * Sem `providerId` o Firebase não sabe a quem falar. Aceitar a declaração desenharia um botão que
   * tranca quem clicou nele fora do sistema, sem dizer por quê — daí o descarte.
   */
  it('descarta um SSO sem o id do provedor', () => {
    expect(asAuthProviderMetadata({ key: 'acme', label: 'Acme', kind: 'oidc' })).toBeNull();
    expect(asAuthProviderMetadata({ key: 'acme', label: 'Acme', kind: 'saml' })).toBeNull();
    expect(asAuthProviderMetadata({
      key: 'acme', label: 'Acme', kind: 'oidc', providerId: 'oidc.acme',
    })?.providerId).toBe('oidc.acme');
  });

  it('descarta a espécie que não existe, em vez de tentar executá-la', () => {
    expect(asAuthProviderMetadata({ key: 'x', label: 'X', kind: 'carrier-pigeon' })).toBeNull();
  });

  it('deixa passar só o que é texto em escopo e parâmetro', () => {
    const parsed = asAuthProviderMetadata({
      key: 'acme',
      label: 'Acme',
      kind: 'oidc',
      providerId: 'oidc.acme',
      scopes: ['email', 42],
      customParameters: { hd: 'acme.com', bad: 7 },
    });
    expect(parsed?.scopes).toBeUndefined();
    expect(parsed?.customParameters).toEqual({ hd: 'acme.com' });
  });

  /** O que chega à camada de dados é o necessário para entrar — nunca o texto da interface. */
  it('a especificação de execução não carrega rótulo, ícone nem ordem', () => {
    const spec = authProviderSpecOf({
      key: 'acme', label: 'Acme', kind: 'oidc', providerId: 'oidc.acme', icon: 'shieldUser', order: 30,
    });
    expect(Object.keys(spec).sort()).toEqual(['customParameters', 'flow', 'kind', 'providerId', 'scopes']);
    expect('label' in spec).toBe(false);
  });
});

describe('o erro do provedor vira chave', () => {
  it('mapeia o código conhecido e cai no genérico para o resto', () => {
    expect(authErrorKey({ code: 'auth/popup-blocked' })).toBe('login.error.popup-blocked');
    expect(authErrorKey({ code: 'auth/quota-exceeded' })).toBe(GENERIC_AUTH_ERROR_KEY);
    expect(authErrorKey(new Error('boom'))).toBe(GENERIC_AUTH_ERROR_KEY);
    expect(authErrorKey(undefined)).toBe(GENERIC_AUTH_ERROR_KEY);
  });
});
