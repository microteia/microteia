// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { LocaleContext, type LocaleContextValue } from '../../../stores/useLocale';
import { messageBundleContribution } from '../../../domain/schema/i18n/extensionPoints';
import type { MessageBundle } from '../../../domain/schema/i18n/messages';

const sourceBundle: MessageBundle = { namespace: 'core.marketplace', locale: 'en', messages: { 'onboarding.title': 'Adding extensions…' } };
let officeBundles: MessageBundle[] = [sourceBundle];
vi.mock('../../../stores/useKernel', () => ({
  useContributions: () => officeBundles.map((bundle) => ({ ...messageBundleContribution(bundle), pluginId: 'core.messages' })),
}));

const { useProspectiveCatalog } = await import('./useProspectiveCatalog');

const ptBrPack = {
  manifest: {
    id: 'com.microteia.locale-pt-br', version: '1.0.0', kernel: '*', name: 'Português',
    contributes: [messageBundleContribution({ namespace: 'core.marketplace', locale: 'pt-BR', messages: { 'onboarding.title': 'Aguarde… adicionando extensões' } })],
  },
};

const wrapper = (preferred: string | null, current = 'en') => ({ children }: { children: React.ReactNode }) => {
  const value: LocaleContextValue = {
    locale: current, preferred, available: ['en'],
    catalog: { locale: current, messages: { 'core.marketplace/onboarding.title': 'Adding extensions…' } },
    setLocale: () => {},
  };
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

describe('useProspectiveCatalog — os textos de quem ainda vai ser instalado', () => {
  it('o pacote que traz o idioma escolhido já fala esse idioma antes de instalado', () => {
    const { result } = renderHook(() => useProspectiveCatalog([ptBrPack]), { wrapper: wrapper('pt-BR') });
    expect(result.current.locale).toBe('pt-BR');
    expect(result.current.messages['core.marketplace/onboarding.title']).toBe('Aguarde… adicionando extensões');
  });

  it('sem idioma escolhido, o idioma em vigor continua, e o catálogo do escritório vence', () => {
    const { result } = renderHook(() => useProspectiveCatalog([ptBrPack]), { wrapper: wrapper(null) });
    expect(result.current.locale).toBe('en');
    expect(result.current.messages['core.marketplace/onboarding.title']).toBe('Adding extensions…');
  });

  it('o idioma em vigor JÁ é o escolhido, preenchido pelo idioma-fonte: o que chega vence o preenchimento', () => {
    officeBundles = [sourceBundle, { namespace: 'core.license', locale: 'pt-BR', messages: { title: 'Licença' } }];
    const { result } = renderHook(() => useProspectiveCatalog([ptBrPack]), { wrapper: wrapper('pt-BR', 'pt-BR') });
    expect(result.current.messages['core.marketplace/onboarding.title']).toBe('Aguarde… adicionando extensões');
    officeBundles = [sourceBundle];
  });

  it('a tradução já instalada no escritório continua vencendo no mesmo idioma', () => {
    officeBundles = [sourceBundle, { namespace: 'core.marketplace', locale: 'pt-BR', messages: { 'onboarding.title': 'Do escritório' } }];
    const { result } = renderHook(() => useProspectiveCatalog([ptBrPack]), { wrapper: wrapper('pt-BR', 'pt-BR') });
    expect(result.current.messages['core.marketplace/onboarding.title']).toBe('Do escritório');
    officeBundles = [sourceBundle];
  });

  it('sem pacote nenhum, é o próprio catálogo do escritório', () => {
    const { result } = renderHook(() => useProspectiveCatalog([]), { wrapper: wrapper('pt-BR') });
    expect(result.current.locale).toBe('en');
  });
});
