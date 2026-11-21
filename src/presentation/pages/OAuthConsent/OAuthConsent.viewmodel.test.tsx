// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * O consentimento de OAuth abre na origem `web.app`, e a sessão dali pode ser outra que a da origem
 * em que a pessoa trabalha — outro "último escritório", às vezes outra conta. Sem conta à vista e sem
 * escolha de escritório, o acesso caía no escritório de que a conta é dona; e uma troca feita noutra
 * aba chegava aqui com as permissões ainda marcadas, mandando o id de um escritório com a escolha
 * feita no outro (issue #18).
 */

const TENANT_X = { id: 'tx', name: 'Office X' };
const TENANT_Y = { id: 'ty', name: 'Office Y' };

const selectTenant = vi.fn(async (id: string) => {
  tenant.currentTenant = id === TENANT_X.id ? TENANT_X : TENANT_Y;
});
const tenant: {
  currentTenant: { id: string; name: string } | null;
  availableTenants: Array<{ id: string; name: string }>;
  selectTenant: typeof selectTenant;
} = { currentTenant: TENANT_Y, availableTenants: [TENANT_X, TENANT_Y], selectTenant };
vi.mock('../../../stores/useTenant', () => ({ useTenant: () => tenant }));

const signOut = vi.fn(async () => undefined);
const auth = { user: { id: 'u1', email: 'person@example.com' }, signOut };
vi.mock('../../../stores/useAuth', () => ({ useAuth: () => auth }));

const extensions = { installed: [], appliedBackend: null };
vi.mock('../../../stores/useInstalledExtensions', () => ({ useInstalledExtensions: () => extensions }));
vi.mock('../../../domain/usecases/agent/agentAvailability', () => ({ agentAvailability: () => 'ready' }));

const notify = vi.fn();
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify }) }));

// Estáveis entre renders, como os de verdade: um `t` novo a cada render relançaria a busca do pedido.
const translate = (key: string) => key;
const resolveLabel = (value: string | null | undefined) => value ?? '';
vi.mock('../../shared/i18n/useT', () => ({ useT: () => translate, useLabel: () => resolveLabel }));

const params = [new URLSearchParams('request=r1')] as const;
vi.mock('react-router-dom', () => ({ useSearchParams: () => params }));

const consent = vi.fn(async () => 'https://client.example/callback?code=c');
const di = {
  agentAuthRequestRepository: {
    get: async () => ({ clientName: 'Client', clientId: 'cid', redirectHost: 'client.example', loopbackOnly: false }),
    consent,
  },
};
vi.mock('../../../infrastructure/di/useDI', () => ({ useDI: () => di }));

const { useOAuthConsentViewModel } = await import('./OAuthConsent.viewmodel');

const mount = async () => {
  const hook = renderHook(() => useOAuthConsentViewModel());
  await waitFor(() => expect(hook.result.current.request).not.toBeNull());
  return hook;
};

describe('o consentimento de OAuth', () => {
  beforeEach(() => {
    tenant.currentTenant = TENANT_Y;
    tenant.availableTenants = [TENANT_X, TENANT_Y];
    vi.clearAllMocks();
  });

  it('mostra a conta que está autorizando, e sair é trocar de conta', async () => {
    const { result } = await mount();
    expect(result.current.accountEmail).toBe('person@example.com');
    await act(() => result.current.switchAccount());
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('oferece os escritórios da conta, com o corrente escolhido', async () => {
    const { result } = await mount();
    expect(result.current.tenantChoices).toEqual([
      { value: 'tx', label: 'Office X' },
      { value: 'ty', label: 'Office Y' },
    ]);
    expect(result.current.tenantId).toBe('ty');
  });

  it('com um escritório só, não há o que escolher', async () => {
    tenant.availableTenants = [TENANT_Y];
    const { result } = await mount();
    expect(result.current.tenantChoices).toEqual([]);
    expect(result.current.tenantName).toBe('Office Y');
  });

  it('escolher outro escritório na tela troca pelo selectTenant e descarta as marcações sem aviso', async () => {
    const { result, rerender } = await mount();
    act(() => result.current.setSelectedPermissions(['calendar.read']));
    await act(() => result.current.chooseTenant('tx'));
    rerender();

    expect(selectTenant).toHaveBeenCalledWith('tx');
    expect(result.current.tenantId).toBe('tx');
    expect(result.current.selectedPermissions).toEqual([]);
    expect(result.current.tenantChangedElsewhere).toBe(false);
  });

  it('a troca vinda de outra aba descarta as marcações e avisa', async () => {
    const { result, rerender } = await mount();
    act(() => result.current.setSelectedPermissions(['calendar.read', 'cases.read']));
    expect(result.current.canAllow).toBe(true);

    tenant.currentTenant = TENANT_X;
    rerender();

    expect(result.current.tenantId).toBe('tx');
    expect(result.current.selectedPermissions).toEqual([]);
    expect(result.current.tenantChangedElsewhere).toBe(true);
    expect(result.current.canAllow).toBe(false);
  });

  it('autorizar manda o escritório que a tela mostra, com o que foi marcado nele', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const { result } = await mount();
    act(() => result.current.setSelectedPermissions(['calendar.read']));
    await act(() => result.current.allow());

    expect(consent).toHaveBeenCalledWith({
      requestId: 'r1',
      tenantId: 'ty',
      permissions: ['calendar.read'],
      expiresInDays: expect.anything(),
    });
    expect(assign).toHaveBeenCalledWith('https://client.example/callback?code=c');
    vi.unstubAllGlobals();
  });
});
