import { describe, it, expect } from 'vitest';
import {
  emptyWorkspaceSession,
  hydrateWorkspace,
  initialWorkspaceState,
  workspaceReducer,
  workspaceSessionReducer,
  type WorkspaceSnapshot,
} from './workspaceReducer';

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

const snapshotOf = (tabKeys: string[], activeTabKey = tabKeys[0] ?? null): WorkspaceSnapshot => ({
  panels: { root: { id: 'root', tabKeys, activeTabKey } },
  layout: { type: 'panel', panelId: 'root' },
  activePanelId: 'root',
});

describe('hydrateWorkspace — a abertura do escritório (#15)', () => {
  it('sem sessão e sem aba aberta, abre as telas iniciais', () => {
    const state = hydrateWorkspace(initialWorkspaceState, null, ['painel', 'caixa']);
    expect(state.panels.root.tabKeys).toEqual(['painel', 'caixa']);
    expect(state.panels.root.activeTabKey).toBe('painel');
  });

  it('sem sessão, um link já aberto não ganha as telas iniciais por cima', () => {
    const comLink = workspaceReducer(initialWorkspaceState, { type: 'OPEN_TAB', key: 'view-dyn:t:1' });
    expect(hydrateWorkspace(comLink, null, ['painel'])).toBe(comLink);
  });

  it('com sessão, reabre as abas e a ativa de antes, sem as telas iniciais', () => {
    const state = hydrateWorkspace(initialWorkspaceState, snapshotOf(['dyn:t', 'view-dyn:t:1'], 'view-dyn:t:1'), ['painel']);
    expect(state.panels.root.tabKeys).toEqual(['dyn:t', 'view-dyn:t:1']);
    expect(state.panels.root.activeTabKey).toBe('view-dyn:t:1');
  });

  it('o link aberto antes da decisão entra junto e fica em foco', () => {
    const comLink = workspaceReducer(initialWorkspaceState, { type: 'OPEN_TAB', key: 'view-dyn:t:9' });
    const state = hydrateWorkspace(comLink, snapshotOf(['dyn:t', 'view-dyn:t:1']), []);
    expect(state.panels.root.tabKeys).toEqual(['dyn:t', 'view-dyn:t:1', 'view-dyn:t:9']);
    expect(state.panels.root.activeTabKey).toBe('view-dyn:t:9');
  });

  it('o link que já estava na sessão não duplica a aba', () => {
    const comLink = workspaceReducer(initialWorkspaceState, { type: 'OPEN_TAB', key: 'view-dyn:t:1' });
    const state = hydrateWorkspace(comLink, snapshotOf(['dyn:t', 'view-dyn:t:1'], 'dyn:t'), []);
    expect(state.panels.root.tabKeys).toEqual(['dyn:t', 'view-dyn:t:1']);
    expect(state.panels.root.activeTabKey).toBe('view-dyn:t:1');
  });
});

describe('workspaceSessionReducer — o espaço é de uma pessoa num escritório', () => {
  const aberto = workspaceSessionReducer(emptyWorkspaceSession('u1:t1'), { type: 'OPEN_TAB', key: 'dyn:t', scope: 'u1:t1' });

  it('a ação de outro escritório começa de um espaço vazio: nada vaza de um para o outro', () => {
    const outro = workspaceSessionReducer(aberto, { type: 'OPEN_TAB', key: 'news', scope: 'u1:t2' });
    expect(outro.scope).toBe('u1:t2');
    expect(outro.hydrated).toBe(false);
    expect(outro.workspace.panels.root.tabKeys).toEqual(['news']);
  });

  it('a abertura é decidida uma vez por escopo', () => {
    const hidratado = workspaceSessionReducer(aberto, { type: 'HYDRATE', snapshot: null, homeKeys: ['painel'], persist: true, scope: 'u1:t1' });
    expect(hidratado.hydrated).toBe(true);
    expect(hidratado.persist).toBe(true);
    const deNovo = workspaceSessionReducer(hidratado, { type: 'HYDRATE', snapshot: snapshotOf(['x']), homeKeys: [], persist: true, scope: 'u1:t1' });
    expect(deNovo).toBe(hidratado);
  });

  it('voltar ao escritório anterior pede nova abertura', () => {
    const hidratado = workspaceSessionReducer(aberto, { type: 'HYDRATE', snapshot: null, homeKeys: [], persist: true, scope: 'u1:t1' });
    const outro = workspaceSessionReducer(hidratado, { type: 'HYDRATE', snapshot: null, homeKeys: [], persist: true, scope: 'u1:t2' });
    const volta = workspaceSessionReducer(outro, { type: 'OPEN_TAB', key: 'dyn:t', scope: 'u1:t1' });
    expect(volta.hydrated).toBe(false);
  });
});

describe('workspaceSessionReducer — a escolha de gravar (#15)', () => {
  it('SET_PERSIST liga e desliga sem mexer nas abas', () => {
    const hidratado = workspaceSessionReducer(emptyWorkspaceSession('u1:t1'), { type: 'HYDRATE', snapshot: null, homeKeys: ['painel'], persist: true, scope: 'u1:t1' });
    const desligado = workspaceSessionReducer(hidratado, { type: 'SET_PERSIST', persist: false, scope: 'u1:t1' });
    expect(desligado.persist).toBe(false);
    expect(desligado.workspace).toBe(hidratado.workspace);
    expect(workspaceSessionReducer(desligado, { type: 'SET_PERSIST', persist: false, scope: 'u1:t1' })).toBe(desligado);
  });
});
