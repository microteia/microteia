// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../shared/styles/theme';
import { PortalStoreContext, type PortalStoreValue } from '../../../stores/usePortal';
import { NotificationProvider } from '../../../stores/NotificationContext';
import type { PortalScreenInfo } from '../../../domain/entities/Portal';
import { usePortalCreateFormViewModel } from './components/PortalCreateForm/PortalCreateForm.viewmodel';
import { usePortalChildListViewModel } from './components/PortalChildList/PortalChildList.viewmodel';

vi.mock('../../shared/i18n/useT', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => value ?? '',
}));

const requests = (conditional: boolean): PortalScreenInfo => ({
  id: 'requests',
  collection: 'requests',
  titleSingular: 'Request',
  titlePlural: 'Requests',
  icon: 'mail',
  documents: false,
  trackViews: false,
  actions: false,
  uploads: null,
  parent: { collection: 'companies' },
  fields: [],
  create: {
    fields: [{ key: 'title', label: 'Title', type: 'text' }],
    link: { collection: 'companies', label: 'Company' },
    ...(conditional ? { conditional: true } : {}),
  },
  edit: null,
});

const storeWith = (open: string[]) => {
  const listCreateTargets = vi.fn(async (_collection: string, ids: string[]) => ids.filter((id) => open.includes(id)));
  const store = {
    listLinkOptions: vi.fn(async () => [
      { recordId: 'acme', label: 'Acme' },
      { recordId: 'beta', label: 'Beta' },
      { recordId: 'gamma', label: 'Gamma' },
    ]),
    listCreateTargets,
    subscribeChildren: vi.fn(() => () => undefined),
    submit: vi.fn(),
    update: vi.fn(),
  } as unknown as PortalStoreValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider theme={baseDarkTheme}>
      <PortalStoreContext.Provider value={store}>
        <NotificationProvider>{children}</NotificationProvider>
      </PortalStoreContext.Provider>
    </ThemeProvider>
  );
  return { wrapper, listCreateTargets };
};

describe('a casca pergunta ao servidor onde o convidado cria (create.when, EV-38)', () => {
  it('a escolha do pai oferece só aqueles em que ele cria — e, sendo um só, já o escolhe', async () => {
    const { wrapper, listCreateTargets } = storeWith(['beta']);
    const { result } = renderHook(() => usePortalCreateFormViewModel({
      screen: requests(true), onCancel: () => undefined, onSubmitted: () => undefined,
    }), { wrapper });

    await waitFor(() => expect(result.current.linkLoading).toBe(false));
    expect(listCreateTargets).toHaveBeenCalledWith('requests', ['acme', 'beta', 'gamma']);
    expect(result.current.linkOptions).toEqual([{ value: 'beta', label: 'Beta' }]);
    expect(result.current.linkRecordId).toBe('beta');
  });

  it('sem condição na tela, nada é perguntado e todos os pais que ele vê ficam', async () => {
    const { wrapper, listCreateTargets } = storeWith([]);
    const { result } = renderHook(() => usePortalCreateFormViewModel({
      screen: requests(false), onCancel: () => undefined, onSubmitted: () => undefined,
    }), { wrapper });

    await waitFor(() => expect(result.current.linkLoading).toBe(false));
    expect(listCreateTargets).not.toHaveBeenCalled();
    expect(result.current.linkOptions).toHaveLength(3);
  });

  it('na aba do pai, o "+" só aparece quando o servidor diz que ele cria ali', async () => {
    const child = (screen: PortalScreenInfo) => ({
      collection: 'requests', title: 'Requests', screen, parentKey: 'companies/acme', createLabel: 'portal.create.new',
    });
    const props = { onOpen: () => undefined, onCreate: () => undefined };

    const denied = storeWith([]);
    const closed = renderHook(() => usePortalChildListViewModel({ child: child(requests(true)), ...props }), { wrapper: denied.wrapper });
    await waitFor(() => expect(denied.listCreateTargets).toHaveBeenCalledWith('requests', ['acme']));
    expect(closed.result.current.createLabel).toBeNull();

    const allowed = storeWith(['acme']);
    const open = renderHook(() => usePortalChildListViewModel({ child: child(requests(true)), ...props }), { wrapper: allowed.wrapper });
    await waitFor(() => expect(open.result.current.createLabel).toBe('portal.create.new'));

    const plain = storeWith([]);
    const always = renderHook(() => usePortalChildListViewModel({ child: child(requests(false)), ...props }), { wrapper: plain.wrapper });
    expect(always.result.current.createLabel).toBe('portal.create.new');
    expect(plain.listCreateTargets).not.toHaveBeenCalled();
  });
});
