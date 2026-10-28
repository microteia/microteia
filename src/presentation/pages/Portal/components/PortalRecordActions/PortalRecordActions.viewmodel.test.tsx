// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PortalStoreContext, type PortalStoreValue } from '../../../../../stores/usePortal';
import { PortalNavigationContext, type PortalNavigationValue } from '../../../../../stores/usePortalNavigation';
import type { PortalActionOutcome, PortalRecordAction } from '../../../../../domain/entities/Portal';
import { PORTAL_HOST_MODULES } from '../../../../shared/extensions/portalHostApi';
import { usePortalRecordActionsViewModel } from './PortalRecordActions.viewmodel';

vi.mock('../../../../shared/i18n/useT', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useT: () => (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key),
  useLabel: () => (value: string | null | undefined) => (value ? `label(${value})` : ''),
}));

type ExtensionActions = (collection: string, recordId: string) => {
  actions: PortalRecordAction[];
  running: string | null;
  run: (actionId: string) => Promise<{ code: string; message: string }>;
};
const usePortalActions = (PORTAL_HOST_MODULES['@microteia/portal'] as { usePortalActions: ExtensionActions }).usePortalActions;

const ACCEPT: PortalRecordAction = {
  id: 'act-accept', title: 'Confirm acceptance', icon: 'check', confirmMessage: 'Do you accept the terms?', danger: false, disabled: false,
};
const CONTACT: PortalRecordAction = {
  id: 'act-contact', title: 'Ask for contact', icon: 'phone', confirmMessage: null, danger: false, disabled: true,
};

const mount = <T,>(
  hook: () => T,
  run: (projectionId: string, actionId: string) => Promise<PortalActionOutcome>,
  initial: PortalRecordAction[] = [ACCEPT, CONTACT],
  offers = true,
) => {
  const store = {
    context: { screens: [{ collection: 'mailboxes', actions: offers }] },
    recordsByCollection: { mailboxes: [{ id: 'mailboxes__m1', updatedAt: new Date('2026-10-28T12:00:00Z') }] },
    listRecordActions: vi.fn(async () => initial),
    runRecordAction: vi.fn(run),
  } as unknown as PortalStoreValue;
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const [claimedActions, setClaimed] = React.useState<string[]>([]);
    const claimActions = React.useCallback((projectionId: string) => {
      setClaimed((current) => [...current, projectionId]);
      return () => setClaimed((current) => current.filter((one) => one !== projectionId));
    }, []);
    const navigation = { claimedActions, claimActions } as unknown as PortalNavigationValue;
    return (
      <PortalStoreContext.Provider value={store}>
        <PortalNavigationContext.Provider value={navigation}>{children}</PortalNavigationContext.Provider>
      </PortalStoreContext.Provider>
    );
  };
  return { hook: renderHook(hook, { wrapper: Wrapper }), store };
};

const useBar = () => usePortalRecordActionsViewModel({ collection: 'mailboxes', recordId: 'm1' });

describe('barra das ações do escritório no portal', () => {
  it('pergunta antes de executar a ação que pede confirmação, e só então dispara', async () => {
    const { hook, store } = mount(useBar, async () => ({ status: { code: 'SUCCESS', message: 'Accepted.' }, actions: [CONTACT] }));
    await waitFor(() => expect(hook.result.current.buttons).toHaveLength(2));

    act(() => hook.result.current.trigger('act-accept'));
    expect(hook.result.current.confirmation).toMatchObject({ isOpen: true, message: 'Do you accept the terms?' });
    expect(store.runRecordAction).not.toHaveBeenCalled();

    await act(async () => hook.result.current.confirm());
    expect(store.runRecordAction).toHaveBeenCalledWith('mailboxes__m1', 'act-accept');
    expect(hook.result.current.feedback).toEqual({ tone: 'success', message: 'Accepted.' });
    expect(hook.result.current.buttons.map((button) => button.id)).toEqual(['act-contact']);
  });

  it('o botão apagado não dispara nada', async () => {
    const { hook, store } = mount(useBar, async () => ({ status: { code: 'SUCCESS', message: '' }, actions: [] }));
    await waitFor(() => expect(hook.result.current.buttons).toHaveLength(2));
    act(() => hook.result.current.trigger('act-contact'));
    expect(hook.result.current.confirmation.isOpen).toBe(false);
    expect(store.runRecordAction).not.toHaveBeenCalled();
  });

  it('a recusa do servidor chega traduzida, e os botões são pedidos de novo', async () => {
    const { hook, store } = mount(useBar, async () => { throw new Error('@core.tenant/portal.action.unavailable'); });
    await waitFor(() => expect(hook.result.current.buttons).toHaveLength(2));
    act(() => hook.result.current.trigger('act-accept'));
    await act(async () => hook.result.current.confirm());
    expect(hook.result.current.feedback).toEqual({ tone: 'error', message: 'label(@core.tenant/portal.action.unavailable)' });
    expect(store.listRecordActions).toHaveBeenCalledTimes(2);
  });

  it('sucesso sem mensagem do fluxo diz que foi feito; falha sem mensagem diz que não foi', async () => {
    const plain = { ...ACCEPT, confirmMessage: null };
    const ok = mount(useBar, async () => ({ status: { code: 'SUCCESS', message: '' }, actions: [plain] }), [plain]);
    await waitFor(() => expect(ok.hook.result.current.buttons).toHaveLength(1));
    await act(async () => ok.hook.result.current.trigger('act-accept'));
    expect(ok.hook.result.current.feedback).toEqual({ tone: 'success', message: 'portal.action.done' });

    const failed = mount(useBar, async () => ({ status: { code: 'ERROR', message: '' }, actions: [plain] }), [plain]);
    await waitFor(() => expect(failed.hook.result.current.buttons).toHaveLength(1));
    await act(async () => failed.hook.result.current.trigger('act-accept'));
    expect(failed.hook.result.current.feedback).toEqual({
      tone: 'error', message: 'portal.action.failed{"name":"Confirm acceptance"}',
    });
  });

  it('a tela que não oferece ações não pede nada ao servidor', async () => {
    const { hook, store } = mount(useBar, async () => ({ status: { code: 'SUCCESS', message: '' }, actions: [] }), [ACCEPT], false);
    await act(async () => undefined);
    expect(hook.result.current.buttons).toEqual([]);
    expect(store.listRecordActions).not.toHaveBeenCalled();
  });
});

describe('usePortalActions — a view que desenha as ações ela mesma', () => {
  it('dispara sem perguntar, devolve a mensagem pronta e nunca rejeita', async () => {
    const { hook, store } = mount(
      () => usePortalActions('mailboxes', 'm1'),
      async () => { throw new Error('@core.tenant/portal.action.unavailable'); },
    );
    await waitFor(() => expect(hook.result.current.actions).toHaveLength(2));
    let result: { code: string; message: string } | undefined;
    await act(async () => { result = await hook.result.current.run('act-accept'); });
    expect(store.runRecordAction).toHaveBeenCalledWith('mailboxes__m1', 'act-accept');
    expect(result).toEqual({ code: 'ERROR', message: 'label(@core.tenant/portal.action.unavailable)' });
  });

  it('pedir as ações de um registro tira a barra da casca de cima dele; sair a devolve', async () => {
    const { hook } = mount(() => {
      const [viewMounted, setViewMounted] = React.useState(true);
      return { viewMounted, setViewMounted, shell: useBar(), view: useViewProbe(viewMounted) };
    }, async () => ({ status: { code: 'SUCCESS', message: '' }, actions: [] }));
    await waitFor(() => expect(hook.result.current.view?.actions).toHaveLength(2));
    expect(hook.result.current.shell.buttons).toEqual([]);

    act(() => hook.result.current.setViewMounted(false));
    await waitFor(() => expect(hook.result.current.shell.buttons).toHaveLength(2));
  });
});

/**
 * A view de extensão, montada ou não. Um hook não pode ser condicional; o que entra e sai é o EFEITO de
 * assumir, que é o que a casca enxerga — daí o registro de um id que não é o do registro quando "fora".
 */
const useViewProbe = (mounted: boolean) => usePortalActions('mailboxes', mounted ? 'm1' : 'outro');
