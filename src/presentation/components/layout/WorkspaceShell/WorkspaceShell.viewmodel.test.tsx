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
  panels: {} as Record<string, { tabKeys: string[] }>,
};
const openLink = vi.fn();
const openTabs = vi.fn();
const navigate = vi.fn();
const selectTenant = vi.fn(async () => undefined);

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: window.location.pathname, search: window.location.search }),
}));
vi.mock('../../../../stores/useWorkspace', () => ({ useWorkspace: () => ({ openTabs, panels: state.panels }) }));
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

describe('as telas iniciais (#14)', () => {
  beforeEach(() => {
    openTabs.mockClear();
    visit('/app');
    state.currentTenant = { id: 't1' };
    state.members = [{ tenantId: 't1', userId: 'u1' }];
    state.extensionsLoaded = true;
    state.codeTrustReady = true;
    state.authorizationLoading = false;
    state.canAny = () => true;
    state.panels = {};
    state.pages = [homePage('painel'), homePage('caixa')];
  });

  it('abre TODAS as páginas declaradas como iniciais, de uma vez', () => {
    renderHook(() => useWorkspaceShellViewModel());
    expect(openTabs).toHaveBeenCalledTimes(1);
    expect(openTabs).toHaveBeenCalledWith(['painel', 'caixa']);
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
      expect(openTabs).not.toHaveBeenCalled();
    }
    state.members = [{ tenantId: 't1', userId: 'u1' }];
    rerender();
    expect(openTabs).toHaveBeenCalledWith(['painel', 'caixa']);
  });

  it('a tela inicial restrita não é pulada enquanto as permissões carregam', () => {
    state.pages = [homePage('restrita', { requiredPermissions: ['x.read'] }), homePage('livre')];
    state.authorizationLoading = true;
    state.canAny = () => false;
    const { rerender } = renderHook(() => useWorkspaceShellViewModel());
    state.authorizationLoading = false;
    state.canAny = () => true;
    rerender();
    expect(openTabs).toHaveBeenCalledWith(['restrita', 'livre']);
  });

  it('não entra num espaço de trabalho que já tem aba (um deep link chegou antes)', () => {
    state.panels = { root: { tabKeys: ['downloads'] } };
    renderHook(() => useWorkspaceShellViewModel());
    expect(openTabs).not.toHaveBeenCalled();
  });

  it('é decidida uma vez só: esvaziar o espaço depois não reabre', () => {
    const { rerender } = renderHook(() => useWorkspaceShellViewModel());
    state.panels = { root: { tabKeys: [] } };
    rerender();
    expect(openTabs).toHaveBeenCalledTimes(1);
  });
});
