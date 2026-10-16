// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const state: {
  screens: Record<string, unknown>[];
  contributed: Record<string, unknown>[];
  values: { tenant: Record<string, unknown>; user: Record<string, unknown> };
} = { screens: [], contributed: [], values: { tenant: {}, user: {} } };

vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ dynamicScreens: state.screens }),
}));
vi.mock('../../../stores/useSettings', () => ({
  useSettings: () => ({ values: state.values }),
}));
vi.mock('./useSettingsCatalog', () => ({
  useSettingsSections: () => [],
  useSurfaceTabs: (surface: string) => (surface === 'record:microteia:processo' ? state.contributed : []),
}));
vi.mock('../i18n/useT', () => ({
  useLabel: () => (value: string | null | undefined) => value ?? '',
}));

const { useRecordTabCatalog, useRecordTabLayout } = await import('./useRecordTabCatalog');

const screen = (overrides: Record<string, unknown>) => ({
  titleSingular: 'x', titlePlural: 'xs', icon: 'file', fields: [], ...overrides,
});

beforeEach(() => {
  state.screens = [
    screen({ id: 'processos', sourceId: 'microteia:processo', titlePlural: 'Processos' }),
    screen({ id: 'anexos', sourceId: 'microteia:anexo', titlePlural: 'Anexos', parentEntity: 'processos', parentFieldKey: 'processo' }),
    screen({ id: 'partes', titlePlural: 'Partes', parentEntity: 'processos', parentFieldKey: 'processo' }),
    screen({ id: 'ocultas', titlePlural: 'Ocultas', parentEntity: 'processos', parentFieldKey: 'processo', hideFromParentTabs: true }),
  ];
  state.contributed = [
    { key: 'prazos', title: 'Prazos', pluginId: 'com.microteia.prazo', order: 10 },
    { key: 'movimentacoes', title: 'Movimentações', pluginId: 'com.microteia.movimentacao', order: 20, defaultEnabled: false },
  ];
  state.values = { tenant: {}, user: {} };
});

describe('o catálogo da faixa de abas de uma tela', () => {
  /** Sem configuração, a faixa mostra o que mostrava antes de ela existir: filhas, depois contribuídas. */
  it('põe as telas-filhas primeiro e as contribuídas depois, numa lista só', () => {
    const catalog = renderHook(() => useRecordTabCatalog('microteia:processo')).result.current;
    expect(catalog.map((item) => [item.key, item.title, item.order])).toEqual([
      ['child:microteia:anexo', 'Anexos', 0],
      ['child:partes', 'Partes', 1],
      ['prazos', 'Prazos', 2],
      ['movimentacoes', 'Movimentações', 3],
    ]);
  });

  /** Tirar a filha do pai é decisão da Form Design dela; a configuração escolhe entre o que sobra. */
  it('não oferece a tela-filha que a Form Design tirou do pai', () => {
    const catalog = renderHook(() => useRecordTabCatalog('microteia:processo')).result.current;
    expect(catalog.map((item) => item.key)).not.toContain('child:ocultas');
  });

  it('respeita o padrão desligado que a extensão declarou', () => {
    const { entries } = renderHook(() => useRecordTabLayout('microteia:processo')).result.current;
    expect(entries.find((entry) => entry.key === 'movimentacoes')?.enabled).toBe(false);
  });

  it('a ordem gravada vale para as duas origens', () => {
    state.values.tenant['record:microteia:processo.tabs'] = [
      { key: 'prazos', enabled: true },
      { key: 'child:partes', enabled: false },
      { key: 'child:microteia:anexo', enabled: true },
    ];
    const { entries } = renderHook(() => useRecordTabLayout('microteia:processo')).result.current;
    expect(entries).toEqual([
      { key: 'prazos', enabled: true },
      { key: 'child:partes', enabled: false },
      { key: 'child:microteia:anexo', enabled: true },
      { key: 'movimentacoes', enabled: false },
    ]);
  });

  it('é vazio enquanto a tela não carregou', () => {
    expect(renderHook(() => useRecordTabCatalog('')).result.current).toEqual([]);
  });
});
