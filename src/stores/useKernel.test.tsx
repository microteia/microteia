// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ExtensionPointDefinition } from '../domain/schema/plugin/extensionPoint';
import type { PluginRecord } from '../kernel';
import { KernelProvider } from './KernelContext';
import {
  useCapability,
  useContribution,
  useContributions,
  useImplementation,
  useKernel,
  usePluginDiagnostics,
} from './useKernel';

const uiNav: ExtensionPointDefinition = {
  id: 'ui.nav',
  apiVersion: '1.0.0',
  title: 'Item de menu',
  ownerPluginId: 'core.ui',
  allowedImplKinds: ['code'],
  implRequired: false,
  multiple: true,
};

const pagina = () => 'render';

const records: PluginRecord[] = [
  {
    trusted: true,
    manifest: { id: 'core.ui', version: '1.0.0', kernel: '^2.0.0', name: 'UI', extensionPoints: [uiNav] },
  },
  {
    trusted: true,
    implementations: { Pagina: pagina },
    manifest: {
      id: 'com.acme.contratos',
      version: '1.0.0',
      kernel: '^2.0.0',
      name: 'Contratos',
      provides: [{ capability: 'ai.completion', version: '1.2.0' }],
      contributes: [
        {
          point: 'ui.nav',
          id: 'contratos',
          apiVersion: '1.0.0',
          metadata: { label: 'Contratos' },
          impl: { kind: 'code', key: 'Pagina' },
        },
      ],
    },
  },
];

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <KernelProvider records={records}>{children}</KernelProvider>
);

describe('useKernel', () => {
  it('explica o erro quando usado fora do Provider', () => {
    expect(() => renderHook(() => useKernel())).toThrow('useKernel precisa estar dentro de <KernelProvider>');
  });

  it('expõe o host carregado', () => {
    const { result } = renderHook(() => useKernel(), { wrapper });
    expect(result.current.host.loadedIds()).toEqual(['com.acme.contratos', 'core.ui']);
    expect(result.current.result.diagnostics).toEqual([]);
  });
});

describe('useContributions', () => {
  it('devolve as contribuições do ponto', () => {
    const { result } = renderHook(() => useContributions('ui.nav'), { wrapper });
    expect(result.current.map((c) => c.id)).toEqual(['contratos']);
  });

  it('devolve lista vazia para ponto sem contribuição', () => {
    const { result } = renderHook(() => useContributions('ui.inexistente'), { wrapper });
    expect(result.current).toEqual([]);
  });

  it('mantém a referência estável entre renders', () => {
    const { result, rerender } = renderHook(() => useContributions('ui.nav'), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('useContribution', () => {
  it('devolve a contribuição vencedora', () => {
    const { result } = renderHook(() => useContribution('ui.nav'), { wrapper });
    expect(result.current?.pluginId).toBe('com.acme.contratos');
  });
});

describe('useImplementation', () => {
  it('resolve a implementação em código da contribuição', () => {
    const { result } = renderHook(
      () => {
        const contribution = useContribution('ui.nav');
        return useImplementation<typeof pagina>(contribution as never);
      },
      { wrapper },
    );
    expect(result.current).toBe(pagina);
  });

  it('devolve undefined para contribuição sem impl em código', () => {
    const { result } = renderHook(
      () =>
        useImplementation({
          pluginId: 'com.acme.contratos',
          point: 'ui.nav',
          id: 'x',
          apiVersion: '1.0.0',
          metadata: {},
        }),
      { wrapper },
    );
    expect(result.current).toBeUndefined();
  });
});

describe('useCapability', () => {
  it('resolve o provedor da capability', () => {
    const { result } = renderHook(
      () => useCapability({ capability: 'ai.completion', range: '^1.0.0' }),
      { wrapper },
    );
    expect(result.current?.pluginId).toBe('com.acme.contratos');
  });

  it('devolve null quando ninguém fornece', () => {
    const { result } = renderHook(
      () => useCapability({ capability: 'messaging.whatsapp', range: '^1.0.0' }),
      { wrapper },
    );
    expect(result.current).toBeNull();
  });
});

describe('usePluginDiagnostics', () => {
  it('expõe os diagnósticos da carga', () => {
    const { result } = renderHook(() => usePluginDiagnostics(), { wrapper });
    expect(result.current).toEqual([]);
  });

  it('reporta o plugin recusado sem quebrar a árvore React', () => {
    const quebrado: PluginRecord[] = [...records, { manifest: { id: 'ruim', version: 'x', kernel: '^2.0.0', name: '' } }];
    const { result } = renderHook(() => usePluginDiagnostics(), {
      wrapper: ({ children }) => <KernelProvider records={quebrado}>{children}</KernelProvider>,
    });
    expect(result.current.map((d) => d.code).sort()).toEqual([
      'manifest.field.missing',
      'manifest.id.invalid',
      'manifest.version.invalid',
    ]);
  });
});
