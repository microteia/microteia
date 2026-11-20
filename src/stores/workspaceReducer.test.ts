import { describe, it, expect } from 'vitest';
import { initialWorkspaceState, workspaceReducer } from './workspaceReducer';

const rootTabs = (state: ReturnType<typeof workspaceReducer>) => state.panels.root;

describe('workspaceReducer — OPEN_TABS', () => {
  it('abre todas as abas e ativa a primeira', () => {
    const state = workspaceReducer(initialWorkspaceState, { type: 'OPEN_TABS', keys: ['painel', 'caixa'] });
    expect(rootTabs(state).tabKeys).toEqual(['painel', 'caixa']);
    expect(rootTabs(state).activeTabKey).toBe('painel');
  });

  it('não duplica aba já aberta nem chave repetida na lista', () => {
    const aberta = workspaceReducer(initialWorkspaceState, { type: 'OPEN_TAB', key: 'caixa' });
    const state = workspaceReducer(aberta, { type: 'OPEN_TABS', keys: ['painel', 'caixa', 'painel'] });
    expect(rootTabs(state).tabKeys).toEqual(['caixa', 'painel']);
    expect(rootTabs(state).activeTabKey).toBe('painel');
  });

  it('lista vazia não muda nada', () => {
    expect(workspaceReducer(initialWorkspaceState, { type: 'OPEN_TABS', keys: [] })).toBe(initialWorkspaceState);
  });
});
