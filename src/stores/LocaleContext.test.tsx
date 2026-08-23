// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { LocaleCode } from '../domain/schema/i18n/localeNegotiation';
import {
  I18N_EXTENSION_POINTS,
  messageBundleContribution,
} from '../domain/schema/i18n/extensionPoints';
import type { PluginRecord } from '../kernel';
import { KernelProvider } from './KernelContext';
import { LocaleProvider } from './LocaleContext';
import { useLocale } from './useLocale';

const STORAGE_KEY = 'microteia:locale';

/** Um pacote de tradução instalado é o que faz `pt-BR` existir como idioma escolhível. */
const records: PluginRecord[] = [
  {
    trusted: true,
    manifest: {
      id: 'core.i18n',
      version: '1.0.0',
      kernel: '^2.0.0',
      name: 'i18n',
      extensionPoints: I18N_EXTENSION_POINTS,
    },
  },
  {
    trusted: true,
    manifest: {
      id: 'com.microteia.locale-pt-br',
      version: '1.0.0',
      kernel: '^2.0.0',
      name: 'Português',
      contributes: [
        messageBundleContribution({
          locale: 'pt-BR',
          namespace: 'core.ui',
          messages: { 'action.save': 'Salvar' },
        }),
      ],
    },
  },
];

const Probe: React.FC = () => {
  const { locale, preferred } = useLocale();
  return <span>{`${locale}|${preferred ?? '-'}`}</span>;
};

const Tree: React.FC<{ preferred?: LocaleCode | null }> = ({ preferred }) => (
  <KernelProvider records={records}>
    <LocaleProvider preferred={preferred}>
      <Probe />
    </LocaleProvider>
  </KernelProvider>
);

describe('LocaleProvider', () => {
  beforeEach(() => localStorage.clear());

  it('sem configuração para consultar, vale o que está guardado no navegador', () => {
    localStorage.setItem(STORAGE_KEY, 'pt-BR');

    const { container } = render(<Tree />);

    expect(container.textContent).toBe('pt-BR|pt-BR');
  });

  it('configuração sem idioma gravado vence o que está guardado no navegador', () => {
    localStorage.setItem(STORAGE_KEY, 'pt-BR');

    const { container, rerender } = render(<Tree preferred="pt-BR" />);
    expect(container.textContent).toBe('pt-BR|pt-BR');

    rerender(<Tree preferred={null} />);

    expect(container.textContent).toBe('en|-');
  });
});
