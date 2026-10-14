// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { PluginRecord } from '../../kernel';
import type { WidgetSpec } from '../../domain/schema/ui/widgetSpec';
import { UI_EXTENSION_POINTS, UI_PAGE_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import { KernelProvider } from '../../stores/KernelContext';

const mounts: string[] = [];

vi.mock('../components/ui/ReportView', async () => {
  const { useEffect, useState: useLocalState } = await import('react');
  const ReportView = ({ reportKey }: { reportKey: string }) => {
    const [value, setValue] = useLocalState('');
    useEffect(() => {
      mounts.push(reportKey);
    }, [reportKey]);
    return <input aria-label={reportKey} value={value} onChange={(event) => setValue(event.target.value)} />;
  };
  return { ReportView };
});

const { useResolvePage } = await import('./useUiContributions');

const widgetPage = (key: string, spec: WidgetSpec) => ({
  point: UI_PAGE_POINT,
  id: key,
  apiVersion: '1.0.0',
  metadata: { key, label: key, icon: 'chart' },
  impl: { kind: 'widget' as const, spec },
});

const records: PluginRecord[] = [
  { trusted: true, manifest: { id: 'core.ui', version: '1.0.0', kernel: '^2.0.0', name: 'UI', extensionPoints: UI_EXTENSION_POINTS } },
  {
    trusted: false,
    manifest: {
      id: 'com.acme.painel',
      version: '1.0.0',
      kernel: '^2.0.0',
      name: 'Painel',
      contributes: [
        widgetPage('agenda', { type: 'report', report: 'hearings' }),
        widgetPage('caixa', { type: 'report', report: 'cashflow' }),
      ],
    },
  },
];

const Panel: React.FC<{ tabKeys: string[]; revision?: number }> = ({ tabKeys }) => {
  const resolvePage = useResolvePage();
  return (
    <>
      {tabKeys.map((tabKey) => {
        const Page = resolvePage(tabKey)?.Component;
        return Page ? <Page key={tabKey} tabKey={tabKey} /> : null;
      })}
    </>
  );
};

describe('useResolvePage — página em Widget DSL', () => {
  it('devolve o mesmo componente a cada resolução, como já acontece com a página em código', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <KernelProvider records={records}>{children}</KernelProvider>
    );
    const { result } = renderHook(() => useResolvePage(), { wrapper });
    const first = result.current('agenda')?.Component;
    expect(first).toBeDefined();
    expect(result.current('agenda')?.Component).toBe(first);
  });

  it('mantém a instância e o valor do filtro quando o espaço de trabalho muda', () => {
    mounts.length = 0;
    const panelAt = (revision: number) => (
      <KernelProvider records={records}><Panel tabKeys={['agenda']} revision={revision} /></KernelProvider>
    );
    const { rerender } = render(panelAt(0));

    const input = screen.getByLabelText('hearings') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-10-14' } });
    rerender(panelAt(1));
    rerender(panelAt(2));

    expect(screen.getByLabelText('hearings')).toBe(input);
    expect(input.value).toBe('2026-10-14');
    expect(mounts).toEqual(['hearings']);
  });

  it('cada aba renderiza o spec da PRÓPRIA contribuição, mesmo com o componente compartilhado', () => {
    render(<KernelProvider records={records}><Panel tabKeys={['agenda', 'caixa']} /></KernelProvider>);
    expect(screen.getByLabelText('hearings')).toBeDefined();
    expect(screen.getByLabelText('cashflow')).toBeDefined();
  });
});
