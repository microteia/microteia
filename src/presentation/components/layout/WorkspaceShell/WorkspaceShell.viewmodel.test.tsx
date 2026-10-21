// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const state = {
  screensLoaded: false,
  currentTenant: { id: 't1' } as { id: string } | null,
  availableTenants: [{ id: 't1' }, { id: 't2' }],
};
const openLink = vi.fn();
const navigate = vi.fn();
const selectTenant = vi.fn(async () => undefined);

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: window.location.pathname, search: window.location.search }),
}));
vi.mock('../../../../stores/useWorkspace', () => ({ useWorkspace: () => ({ openTab: vi.fn(), panels: {} }) }));
vi.mock('../../../../stores/useAuth', () => ({ useAuth: () => ({ userRole: 'USER' }) }));
vi.mock('../../../../stores/useAuthorization', () => ({ useAuthorization: () => ({ canAny: () => true }) }));
vi.mock('../../../../stores/useTenant', () => ({
  useTenant: () => ({ portalOnly: false, currentTenant: state.currentTenant, availableTenants: state.availableTenants, selectTenant }),
}));
vi.mock('../../../../stores/useScreenDefinitions', () => ({ useScreenDefinitions: () => ({ isLoaded: state.screensLoaded }) }));
vi.mock('../../../shared/useUiContributions', () => ({ usePageContributions: () => [] }));
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
