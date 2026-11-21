// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const state = {
  screensLoaded: false,
  currentTenant: { id: 't1' } as { id: string } | null,
  availableTenants: [{ id: 't1' }, { id: 't2' }],
  members: [{ tenantId: 't1', userId: 'u1' }],
  extensionsLoaded: true,
  codeTrustReady: true,
  authorizationLoading: false,
  canAny: (() => true) as (permissions: string[]) => boolean,
  pages: [] as unknown[],
  hydrated: false,
  saved: null as unknown,
};
const openLink = vi.fn();
const hydrate = vi.fn<(snapshot: unknown, homeKeys: string[]) => void>(() => { state.hydrated = true; });
const navigate = vi.fn();
const selectTenant = vi.fn(async () => undefined);

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: window.location.pathname, search: window.location.search }),
}));
vi.mock('../../../../stores/useWorkspace', () => ({
  useWorkspace: () => ({ hydrated: state.hydrated, hydrate, loadSavedSession: () => state.saved }),
}));
vi.mock('../../../../stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, userRole: 'USER' }) }));
vi.mock('../../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({ canAny: state.canAny, isLoading: state.authorizationLoading, isUnrestricted: false }),
}));
vi.mock('../../../../stores/useInstalledExtensions', () => ({ useInstalledExtensions: () => ({ isLoaded: state.extensionsLoaded }) }));
vi.mock('../../../../stores/useExtensionCodeTrust', () => ({ useInstalledCodeTrust: () => ({ ready: state.codeTrustReady }) }));
vi.mock('../../../../stores/useTenant', () => ({
  useTenant: () => ({
    portalOnly: false,
    currentTenant: state.currentTenant,
    availableTenants: state.availableTenants,
    selectTenant,
    members: state.members,
  }),
}));
vi.mock('../../../../stores/useScreenDefinitions', () => ({ useScreenDefinitions: () => ({ isLoaded: state.screensLoaded }) }));
vi.mock('../../../shared/useUiContributions', () => ({ usePageContributions: () => state.pages }));
vi.mock('../../../shared/useOpenLink', () => ({ useOpenLink: () => openLink }));

import { useWorkspaceShellViewModel } from './WorkspaceShell.viewmodel';

const visit = (url: string) => window.history.replaceState(null, '', url);

describe('o link que chega de fora (e-mail, push)', () => {
  beforeEach(() => {
    openLink.mockClear();
    navigate.mockClear();
    selectTenant.mockClear();
    state.screensLoaded = false;
    state.currentTenant = { id: 't1' };
  });

  it('espera as telas do escritório: abrir antes não acharia a tela da coleção e descartaria o link', () => {
    visit('/microteia/record%3Ainvoices%3Anf1?tenant=t1');
    const { rerender } = renderHook(() => useWorkspaceShellViewModel());
    expect(openLink).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    state.screensLoaded = true;
    rerender();
    expect(openLink).toHaveBeenCalledWith('record:invoices:nf1');
    expect(navigate).toHaveBeenCalledWith('/app', { replace: true });
  });

  it('em outro escritório de que a pessoa é membro, troca antes de abrir', () => {
    state.screensLoaded = true;
    visit('/microteia/record%3Ainvoices%3Anf1?tenant=t2');
    renderHook(() => useWorkspaceShellViewModel());
    expect(selectTenant).toHaveBeenCalledWith('t2');
    expect(openLink).not.toHaveBeenCalled();
  });

  it('uma aba comum não espera as telas', () => {
    visit('/microteia/downloads');
    renderHook(() => useWorkspaceShellViewModel());
    expect(openLink).toHaveBeenCalledWith('downloads');
  });
});

const homePage = (key: string, extra: Record<string, unknown> = {}) => ({
  pluginId: 'com.acme.x',
  point: 'ui.page',
  id: key,
  apiVersion: '1.0.0',
  metadata: { key, title: key, icon: 'apps', home: true, ...extra },
});

const panelOf = (tabKeys: string[]) => ({
  panels: { root: { id: 'root', tabKeys, activeTabKey: tabKeys[0] ?? null } },
  layout: { type: 'panel', panelId: 'root' },
  activePanelId: 'root',
});

describe('a abertura do escritório: telas iniciais (#14) e sessão restaurada (#15)', () => {
  beforeEach(() => {
    hydrate.mockClear();
    visit('/app');
    state.currentTenant = { id: 't1' };
    state.members = [{ tenantId: 't1', userId: 'u1' }];
    state.extensionsLoaded = true;
    state.codeTrustReady = true;
    state.authorizationLoading = false;
    state.canAny = () => true;
    state.hydrated = false;
    state.saved = null;
    state.pages = [homePage('painel'), homePage('caixa')];
  });

  it('sem sessão guardada, decide pelas telas iniciais — todas, de uma vez', () => {
    renderHook(() => useWorkspaceShellViewModel());
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(hydrate).toHaveBeenCalledWith(null, ['painel', 'caixa']);
  });

  it('espera extensões, confiança de código, autorização e o membro deste escritório', () => {
    state.extensionsLoaded = false;
    state.codeTrustReady = false;
    state.authorizationLoading = true;
    state.members = [{ tenantId: 'outro', userId: 'u1' }];
    const { rerender } = renderHook(() => useWorkspaceShellViewModel());
    for (const step of [
      () => { state.extensionsLoaded = true; },
      () => { state.codeTrustReady = true; },
      () => { state.authorizationLoading = false; },
    ]) {
      step();
      rerender();
      expect(hydrate).not.toHaveBeenCalled();
    }
    state.members = [{ tenantId: 't1', userId: 'u1' }];
    rerender();
    expect(hydrate).toHaveBeenCalledWith(null, ['painel', 'caixa']);
  });

  it('a tela inicial restrita não é pulada enquanto as permissões carregam', () => {
    state.pages = [homePage('restrita', { requiredPermissions: ['x.read'] }), homePage('livre')];
    state.authorizationLoading = true;
    state.canAny = () => false;
    const { rerender } = renderHook(() => useWorkspaceShellViewModel());
    state.authorizationLoading = false;
    state.canAny = () => true;
    rerender();
    expect(hydrate).toHaveBeenCalledWith(null, ['restrita', 'livre']);
  });

  it('reabre a sessão guardada, sem a aba cuja página sumiu ou deixou de ser permitida', () => {
    state.pages = [homePage('painel'), homePage('restrita', { home: false, requiredPermissions: ['x.read'] })];
    state.canAny = (permissions) => !permissions.includes('x.read');
    state.saved = panelOf(['painel', 'restrita', 'extensao-removida']);
    renderHook(() => useWorkspaceShellViewModel());
    expect(hydrate).toHaveBeenCalledWith(panelOf(['painel']), ['painel']);
  });

  it('decidida a abertura, não decide de novo', () => {
    const { rerender } = renderHook(() => useWorkspaceShellViewModel());
    rerender();
    expect(hydrate).toHaveBeenCalledTimes(1);
  });
});
