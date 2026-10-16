// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SettingsSection } from '../../../domain/schema/settings';

const state: { surfaces: string[]; screens: Record<string, unknown>[] } = {
  surfaces: [],
  screens: [],
};

vi.mock('../../../stores/useKernel', () => ({
  useContributions: () => state.surfaces.map((surface) => ({ metadata: { surface } })),
}));
vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ dynamicScreens: state.screens }),
}));
vi.mock('../i18n/useT', () => ({
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => value ?? '',
  useLocaleFormat: () => ({ compareText: (a: string, b: string) => a.localeCompare(b) }),
}));

const { useRecordTabSettingsSection } = await import('./useRecordTabSettings');

const NONE: SettingsSection[] = [];

beforeEach(() => {
  state.surfaces = ['tenant-settings', 'record:microteia:processo', 'record:microteia:processo', 'record:microteia:pessoa'];
  state.screens = [
    { id: 'processos', sourceId: 'microteia:processo', titlePlural: 'Processos', titleSingular: 'Processo' },
    { id: 'pessoas', sourceId: 'microteia:pessoa', titlePlural: 'Pessoas', titleSingular: 'Pessoa' },
  ];
});

describe('a configuração das abas do detalhe de um registro', () => {
  it('existe também para a tela que só tem aba de tela-filha', () => {
    state.surfaces = [];
    state.screens.push({
      id: 'anexos', titlePlural: 'Anexos', titleSingular: 'Anexo', parentEntity: 'pessoas', parentFieldKey: 'pessoa',
    });
    const section = renderHook(() => useRecordTabSettingsSection(NONE)).result.current;
    expect(section?.properties.map((property) => property.key)).toEqual(['record:microteia:pessoa.tabs']);
  });

  it('rende uma propriedade por tela que recebeu aba, com a chave que o detalhe lê', () => {
    const section = renderHook(() => useRecordTabSettingsSection(NONE)).result.current;
    expect(section?.properties.map((property) => [property.key, property.label, property.surface])).toEqual([
      ['record:microteia:pessoa.tabs', 'Pessoas', 'record:microteia:pessoa'],
      ['record:microteia:processo.tabs', 'Processos', 'record:microteia:processo'],
    ]);
    expect(section?.properties[0]).toMatchObject({ type: 'contributions', point: 'ui.tab', scopes: ['tenant', 'user'] });
  });

  it('não existe enquanto nenhuma extensão pendurar aba em tela nenhuma', () => {
    state.surfaces = ['tenant-settings'];
    expect(renderHook(() => useRecordTabSettingsSection(NONE)).result.current).toBeNull();
  });

  it('não repete a propriedade que alguém já declarou para a superfície', () => {
    const declared: SettingsSection[] = [{
      key: 'prazo',
      title: 'Prazos',
      properties: [{
        key: 'prazo.processTabs', label: 'x', type: 'contributions', default: [], scopes: ['tenant'],
        point: 'ui.tab', surface: 'record:microteia:processo',
      }],
    }];
    const section = renderHook(() => useRecordTabSettingsSection(declared)).result.current;
    expect(section?.properties.map((property) => property.key)).toEqual(['record:microteia:pessoa.tabs']);
  });
});
