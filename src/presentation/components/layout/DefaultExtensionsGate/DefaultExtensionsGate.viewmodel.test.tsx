// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import type { DefaultExtensionsOnboarding } from '../../../../domain/schema/plugin/defaultExtensions';
import type { IExtensionOnboardingRepository } from '../../../../domain/repositories/IExtensionOnboardingRepository';
import type { InstallExtensionInput } from '../../../../stores/useInstalledExtensions';

// ─── O store de instalação, com a mesma propriedade do de verdade: instalar re-renderiza ───────────
let installedIds: string[] = [];
const installedListeners = new Set<() => void>();
const installCalls: string[] = [];
const failOn = new Set<string>();
/** Instalação que só termina quando o teste manda — a do Pet Shop leva ~30s de verdade. */
const holdOn = new Map<string, Promise<void>>();
const install = vi.fn(async (input: InstallExtensionInput) => {
  const id = input.package.manifest.id;
  installCalls.push(`${input.source}:${id}`);
  await holdOn.get(id);
  if (failOn.has(id)) throw new Error(`falhou ${id}`);
  installedIds = [...installedIds, id];
  installedListeners.forEach((listener) => listener());
});
vi.mock('../../../../stores/useInstalledExtensions', () => ({
  useInstalledExtensions: () => {
    const ids = useSyncExternalStore(
      (listener) => { installedListeners.add(listener); return () => installedListeners.delete(listener); },
      () => installedIds,
    );
    return { installed: ids.map((id) => ({ id })), isLoading: false, install };
  },
}));

// ─── A lista do servidor ──────────────────────────────────────────────────────────────────────────
let onboardingState: DefaultExtensionsOnboarding | null = null;
const onboardingListeners = new Set<(state: DefaultExtensionsOnboarding | null) => void>();
const publishOnboarding = () => onboardingListeners.forEach((listener) => listener(onboardingState));
const onboardingRepo: IExtensionOnboardingRepository = {
  subscribe: (_tenantId, onChange) => {
    onboardingListeners.add(onChange);
    onChange(onboardingState);
    return () => onboardingListeners.delete(onChange);
  },
  settle: async (_tenantId, pluginId, outcome) => {
    if (!onboardingState) return;
    onboardingState = {
      pending: onboardingState.pending.filter((id) => id !== pluginId),
      failed: outcome === 'deferred' ? [...onboardingState.failed, pluginId] : onboardingState.failed,
    };
    // Como o Firestore: o `onSnapshot` local chega na hora, e a escrita só se confirma depois.
    publishOnboarding();
    await new Promise((resolve) => setTimeout(resolve, 20));
  },
};

let canManage = true;
const pkg = (id: string, dependencies?: Record<string, string>) => ({
  manifest: { id, version: '1.0.0', kernel: '*', name: `Nome ${id}`, ...(dependencies ? { dependencies } : {}) },
  summary: '',
  workflows: [],
});
let catalogEntries: { domain: string; status: string; package: ReturnType<typeof pkg> }[] = [];

vi.mock('../../../../stores/useTenant', () => ({ useTenant: () => ({ currentTenant: { id: 't1' } }) }));
vi.mock('../../../../stores/useAuthorization', () => ({ useAuthorization: () => ({ can: () => canManage }) }));
vi.mock('../../../../stores/usePublicExtensions', () => ({
  usePublicExtensions: () => ({
    publicExtensions: catalogEntries.map((entry) => ({
      ...entry, version: '1.0.0', publishedBy: 'u', ownerName: 'Dona', ownerPhotoURL: null,
    })),
    isLoading: false,
  }),
}));
vi.mock('../../../../infrastructure/di/useDI', () => ({ useDI: () => ({ extensionOnboardingRepository: onboardingRepo }) }));
vi.mock('../../../shared/i18n/useProspectiveCatalog', () => ({ useProspectiveCatalog: () => ({ locale: 'en', messages: {} }) }));
vi.mock('../../../../domain/schema/i18n/messageRef', () => ({ resolveLabel: (_catalog: unknown, value: string) => value }));
vi.mock('../../../../plugins/marketplace/catalog', () => ({
  MARKETPLACE_CATALOG: [{ manifest: { id: 'com.microteia.brasil', version: '2.0.0', kernel: '*', name: 'Brasil' }, summary: '', workflows: [] }],
}));

const { useDefaultExtensionsGateViewModel } = await import('./DefaultExtensionsGate.viewmodel');

const stage = (pending: string[]) => { onboardingState = { pending, failed: [] }; };

beforeEach(() => {
  installedIds = [];
  installCalls.length = 0;
  failOn.clear();
  holdOn.clear();
  install.mockClear();
  onboardingState = null;
  canManage = true;
  catalogEntries = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('DefaultExtensionsGate — a primeira entrada de um escritório novo', () => {
  it('sem lista, o portão não aparece', () => {
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());
    expect(result.current.active).toBe(false);
  });

  it('instala na ordem fixada, pela porta de sempre, e some no fim', async () => {
    catalogEntries = [
      { domain: 'com.acme.crm', status: 'approved', package: pkg('com.acme.crm') },
      { domain: 'com.acme.sales', status: 'approved', package: pkg('com.acme.sales', { 'com.acme.crm': '^1.0.0' }) },
    ];
    stage(['com.acme.crm', 'com.acme.sales']);
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());
    expect(result.current.active).toBe(true);

    await waitFor(() => expect(result.current.active).toBe(false));
    expect(installCalls).toEqual(['public:com.acme.crm', 'public:com.acme.sales']);
    expect(onboardingState?.pending).toEqual([]);
  });

  it('a rodada seguinte não é instalada duas vezes quando a anterior termina depois de a lista mudar', async () => {
    catalogEntries = [
      { domain: 'com.acme.crm', status: 'approved', package: pkg('com.acme.crm') },
      { domain: 'com.acme.sales', status: 'approved', package: pkg('com.acme.sales') },
    ];
    let release = () => {};
    holdOn.set('com.acme.sales', new Promise<void>((resolve) => { release = resolve; }));
    stage(['com.acme.crm', 'com.acme.sales']);
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());

    await waitFor(() => expect(installCalls).toContain('public:com.acme.sales'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(installCalls.filter((call) => call === 'public:com.acme.sales')).toHaveLength(1);

    release();
    await waitFor(() => expect(result.current.active).toBe(false));
    expect(installCalls).toEqual(['public:com.acme.crm', 'public:com.acme.sales']);
  });

  it('o total não encolhe quando a lista chega antes de a escrita se confirmar', async () => {
    catalogEntries = [
      { domain: 'com.acme.crm', status: 'approved', package: pkg('com.acme.crm') },
      { domain: 'com.acme.sales', status: 'approved', package: pkg('com.acme.sales') },
    ];
    stage(['com.acme.crm', 'com.acme.sales']);
    const totals: number[] = [];
    const { result } = renderHook(() => {
      const vm = useDefaultExtensionsGateViewModel();
      totals.push(vm.total);
      return vm;
    });

    await waitFor(() => expect(result.current.active).toBe(false));
    expect(totals.filter((total) => total > 0).every((total) => total === 2)).toBe(true);
  });

  it('a dependência embutida entra antes, numa rodada própria', async () => {
    catalogEntries = [{ domain: 'com.acme.law', status: 'approved', package: pkg('com.acme.law', { 'com.microteia.brasil': '^2.0.0' }) }];
    stage(['com.acme.law']);
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());

    await waitFor(() => expect(result.current.active).toBe(false));
    expect(installCalls).toEqual(['builtin:com.microteia.brasil', 'public:com.acme.law']);
  });

  it('a embutida que é ela mesma padrão é instalada do bundle', async () => {
    catalogEntries = [{ domain: 'com.acme.law', status: 'approved', package: pkg('com.acme.law') }];
    stage(['com.microteia.brasil', 'com.acme.law']);
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());

    await waitFor(() => expect(result.current.active).toBe(false));
    expect(installCalls).toEqual(['builtin:com.microteia.brasil', 'public:com.acme.law']);
    expect(onboardingState).toEqual({ pending: [], failed: [] });
  });

  it('a que saiu do catálogo depois de o escritório nascer é adiada sem perguntar', async () => {
    stage(['com.acme.gone']);
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());

    await waitFor(() => expect(result.current.active).toBe(false));
    expect(install).not.toHaveBeenCalled();
    expect(onboardingState?.failed).toEqual(['com.acme.gone']);
  });

  it('a já instalada (uma passada interrompida) só sai da lista', async () => {
    catalogEntries = [{ domain: 'com.acme.crm', status: 'approved', package: pkg('com.acme.crm') }];
    installedIds = ['com.acme.crm'];
    stage(['com.acme.crm']);
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());

    await waitFor(() => expect(result.current.active).toBe(false));
    expect(install).not.toHaveBeenCalled();
  });

  it('a falha espera a decisão: tentar de novo instala de novo; continuar sem ela a adia', async () => {
    catalogEntries = [
      { domain: 'com.acme.crm', status: 'approved', package: pkg('com.acme.crm') },
      { domain: 'com.acme.docs', status: 'approved', package: pkg('com.acme.docs') },
    ];
    failOn.add('com.acme.crm');
    stage(['com.acme.crm', 'com.acme.docs']);
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());

    await waitFor(() => expect(result.current.failure?.name).toBe('Nome com.acme.crm'));
    expect(result.current.failure?.params.detail).toBe('falhou com.acme.crm');

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect(installCalls.filter((call) => call === 'public:com.acme.crm')).toHaveLength(2);

    await act(async () => { await result.current.skip(); });
    await waitFor(() => expect(result.current.active).toBe(false));
    expect(onboardingState).toEqual({ pending: [], failed: ['com.acme.crm'] });
    expect(installedIds).toEqual(['com.acme.docs']);
  });

  it('quem não pode instalar extensões não fica preso no portão', () => {
    canManage = false;
    stage(['com.acme.crm']);
    const { result } = renderHook(() => useDefaultExtensionsGateViewModel());
    expect(result.current.active).toBe(false);
    expect(install).not.toHaveBeenCalled();
  });
});
