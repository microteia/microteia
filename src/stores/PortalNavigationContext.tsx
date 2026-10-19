import React, { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePortal } from './usePortal';
import { PortalNavigationContext, type PortalCreating, type PortalOpenRecord } from './usePortalNavigation';

interface NavigationState {
  /**
   * De QUAL item do menu é esta pilha (`escritório|item`). Trocar de escritório ou de item a zera sem
   * efeito nenhum — a pilha do prestador não sobrevive a ir para o Extrato.
   */
  scope: string;
  stack: PortalOpenRecord[];
  creating: PortalCreating | null;
  justSubmitted: boolean;
}

const EMPTY = (scope: string): NavigationState => ({ scope, stack: [], creating: null, justSubmitted: false });

export const PortalNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId } = usePortal();
  const { entryId } = useParams<{ entryId?: string }>();
  const scope = `${tenantId ?? ''}|${entryId ?? ''}`;
  const [stored, setStored] = useState<NavigationState>(() => EMPTY(scope));
  const state = stored.scope === scope ? stored : EMPTY(scope);

  const update = useCallback((patch: (current: NavigationState) => Partial<NavigationState>) => {
    setStored((prev) => {
      const current = prev.scope === scope ? prev : EMPTY(scope);
      return { ...current, ...patch(current) };
    });
  }, [scope]);

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
    stack: state.stack,
    creating: state.creating,
    justSubmitted: state.justSubmitted,
    openRecord,
    back,
    startCreate,
    cancelCreate,
    submitted,
  }), [state, openRecord, back, startCreate, cancelCreate, submitted]);

  return <PortalNavigationContext.Provider value={value}>{children}</PortalNavigationContext.Provider>;
};
