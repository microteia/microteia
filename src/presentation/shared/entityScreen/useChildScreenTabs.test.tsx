// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ScreenDefinition } from '../../../domain/entities';

const state: { screens: ScreenDefinition[]; granted: string[] } = { screens: [], granted: [] };

vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ dynamicScreens: state.screens }),
}));
vi.mock('../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({ can: (permission: string) => state.granted.includes(permission) }),
}));
vi.mock('../../components/layout/ChildRecordList', () => ({ ChildRecordList: () => null }));

const { useChildScreenTabs } = await import('./useChildScreenTabs');

const screen = (overrides: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'anexos',
  tenantId: 't1',
  origin: 'plugin',
  titleSingular: 'Anexo',
  titlePlural: 'Anexos',
  icon: 'file',
  fields: [],
  titleFieldKey: 'name',
  parentEntity: 'processos',
  parentFieldKey: 'caseId',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  listActions: [],
  viewActionIds: [],
  cardActionIds: [],
  sidebarOrder: 0,
  enabled: true,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  ...overrides,
}) as ScreenDefinition;

const abas = () => renderHook(() => useChildScreenTabs('processos', 'r1')).result.current;

beforeEach(() => {
  state.screens = [screen({})];
  state.granted = ['anexos.read'];
});

/**
 * A aba de filhos é a terceira porta para a mesma tela — depois do menu e do ⌘K. Uma aba que só pode
 * mostrar vazio não informa nada: ela promete registros que a regra do servidor nunca vai entregar.
 */
describe('useChildScreenTabs', () => {
  it('a tela filha vira aba de quem pode ler a coleção dela', () => {
    expect(abas().map((tab) => tab.key)).toEqual(['child:anexos']);
  });

  it('sem a permissão de ler, a aba não existe', () => {
    state.granted = [];
    expect(abas()).toEqual([]);
  });

  it('a permissão cobrada é da COLEÇÃO da tela filha, não da chave dela', () => {
    state.screens = [screen({ dataCollection: 'attachments' })];

    state.granted = ['anexos.read'];
    expect(abas()).toEqual([]);

    state.granted = ['attachments.read'];
    expect(abas().map((tab) => tab.key)).toEqual(['child:anexos']);
  });
});
