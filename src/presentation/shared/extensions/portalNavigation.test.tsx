// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { PortalNavigationProvider } from '../../../stores/PortalNavigationContext';
import { PortalStoreContext, type PortalStoreValue } from '../../../stores/usePortal';
import { usePortalNavigation as useNavigationStore, type PortalNavigationValue } from '../../../stores/usePortalNavigation';
import { PORTAL_HOST_MODULES } from './portalHostApi';

type ExtensionNavigation = {
  openRecord: (collection: string, recordId: string) => void;
  back: () => void;
};

const extensionNavigation = (PORTAL_HOST_MODULES['@microteia/portal'] as {
  usePortalNavigation: () => ExtensionNavigation;
}).usePortalNavigation;

const store = { tenantId: 't1' } as PortalStoreValue;

const seen: { path: string; extension: ExtensionNavigation | null; shell: PortalNavigationValue | null } = {
  path: '',
  extension: null,
  shell: null,
};

const Probe: React.FC = () => {
  const location = useLocation();
  const extension = extensionNavigation();
  const shell = useNavigationStore();
  useEffect(() => {
    seen.path = `${location.pathname}${location.search}`;
    seen.extension = extension;
    seen.shell = shell;
  });
  return null;
};

const mount = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <PortalStoreContext.Provider value={store}>
      <Routes>
        <Route path="/portal" element={<PortalNavigationProvider><Outlet /></PortalNavigationProvider>}>
          <Route path=":tenantId" element={<Probe />} />
          <Route path=":tenantId/:entryId" element={<Probe />} />
        </Route>
      </Routes>
    </PortalStoreContext.Provider>
  </MemoryRouter>,
);

describe('usePortalNavigation().openRecord de um cartão da home', () => {
  it('navega para o endereço do registro, que abre já com ele na pilha', () => {
    mount('/portal/t1');
    act(() => seen.extension?.openRecord('orders', 'o1'));
    expect(seen.path).toBe('/portal/t1/orders?record=o1');
    expect(seen.shell?.stack).toEqual([{ collection: 'orders', projectionId: 'orders__o1' }]);
    expect(seen.shell?.returnsHome).toBe(true);
  });

  it('o Voltar do registro devolve à home pelo histórico', () => {
    mount('/portal/t1');
    act(() => seen.extension?.openRecord('orders', 'o1'));
    act(() => seen.extension?.back());
    expect(seen.path).toBe('/portal/t1');
  });

  it('um filho aberto dentro dele volta primeiro ao registro, e só depois à home', () => {
    mount('/portal/t1');
    act(() => seen.extension?.openRecord('orders', 'o1'));
    act(() => seen.extension?.openRecord('notes', 'n1'));
    expect(seen.shell?.stack).toHaveLength(2);
    act(() => seen.extension?.back());
    expect(seen.path).toBe('/portal/t1/orders?record=o1');
    expect(seen.shell?.stack).toEqual([{ collection: 'orders', projectionId: 'orders__o1' }]);
    act(() => seen.extension?.back());
    expect(seen.path).toBe('/portal/t1');
  });

  it('back() na home, sem nada aberto, não faz nada', () => {
    mount('/portal/t1');
    act(() => seen.extension?.back());
    expect(seen.path).toBe('/portal/t1');
    expect(seen.shell?.stack).toEqual([]);
  });
});

describe('usePortalNavigation().openRecord dentro de um item do menu', () => {
  it('empilha sem trocar de endereço, como sempre', () => {
    mount('/portal/t1/page.ext.board');
    act(() => seen.extension?.openRecord('orders', 'o1'));
    expect(seen.path).toBe('/portal/t1/page.ext.board');
    expect(seen.shell?.stack).toEqual([{ collection: 'orders', projectionId: 'orders__o1' }]);
    expect(seen.shell?.returnsHome).toBe(false);
    act(() => seen.extension?.back());
    expect(seen.shell?.stack).toEqual([]);
    expect(seen.path).toBe('/portal/t1/page.ext.board');
  });

  it('o registro de um aviso (sem vir da home) não volta pelo histórico', () => {
    mount('/portal/t1/orders?record=o1');
    expect(seen.shell?.returnsHome).toBe(false);
    act(() => seen.extension?.back());
    expect(seen.path).toBe('/portal/t1/orders?record=o1');
    expect(seen.shell?.stack).toEqual([]);
  });
});
