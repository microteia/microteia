import React, { useCallback, useMemo, useState } from 'react';
import { usePortal } from './usePortal';
import { PortalNavigationContext, type PortalCreating, type PortalOpenRecord } from './usePortalNavigation';

interface NavigationState {
  /** De que escritório é esta navegação — trocar de escritório a zera sem efeito nenhum. */
  tenantId: string | null;
  rootChoice: string | null;
  stack: PortalOpenRecord[];
  creating: PortalCreating | null;
  justSubmitted: boolean;
}

const EMPTY = (tenantId: string | null): NavigationState => ({
  tenantId,
  rootChoice: null,
  stack: [],
  creating: null,
  justSubmitted: false,
});

export const PortalNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId } = usePortal();
  const [stored, setStored] = useState<NavigationState>(() => EMPTY(tenantId));
  const state = stored.tenantId === tenantId ? stored : EMPTY(tenantId);

  const update = useCallback((patch: (current: NavigationState) => Partial<NavigationState>) => {
    setStored((prev) => {
      const current = prev.tenantId === tenantId ? prev : EMPTY(tenantId);
      return { ...current, ...patch(current) };
    });
  }, [tenantId]);

  const selectRoot = useCallback((collection: string) => update(() => ({
    rootChoice: collection, stack: [], creating: null, justSubmitted: false,
  })), [update]);
  const openRecord = useCallback((collection: string, projectionId: string) => update((current) => ({
    stack: [...current.stack, { collection, projectionId }], creating: null, justSubmitted: false,
  })), [update]);
  const back = useCallback(() => update((current) => ({ stack: current.stack.slice(0, -1) })), [update]);
  const startCreate = useCallback((collection: string, parentRecordId: string | null) => update(() => ({
    creating: { collection, parentRecordId }, justSubmitted: false,
  })), [update]);
  const cancelCreate = useCallback(() => update(() => ({ creating: null })), [update]);
  const submitted = useCallback(() => update(() => ({ creating: null, justSubmitted: true })), [update]);

  const value = useMemo(() => ({
    rootChoice: state.rootChoice,
    stack: state.stack,
    creating: state.creating,
    justSubmitted: state.justSubmitted,
    selectRoot,
    openRecord,
    back,
    startCreate,
    cancelCreate,
    submitted,
  }), [state, selectRoot, openRecord, back, startCreate, cancelCreate, submitted]);

  return <PortalNavigationContext.Provider value={value}>{children}</PortalNavigationContext.Provider>;
};
