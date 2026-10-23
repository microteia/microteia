import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { usePortal } from './usePortal';
import { PortalNavigationContext, type PortalCreating, type PortalOpenRecord } from './usePortalNavigation';
import { PORTAL_RECORD_PARAM, portalRecordDocId } from '../domain/schema/portal';

interface NavigationState {
  /**
   * De QUAL item do menu é esta pilha (`escritório|item`). Trocar de escritório ou de item a zera sem
   * efeito nenhum — a pilha do prestador não sobrevive a ir para o Extrato.
   */
  scope: string;
  stack: PortalOpenRecord[];
  creating: PortalCreating | null;
  justSubmitted: boolean;
  justSaved: boolean;
}

const EMPTY = (scope: string, stack: PortalOpenRecord[] = []): NavigationState => ({
  scope, stack, creating: null, justSubmitted: false, justSaved: false,
});

export const PortalNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId } = usePortal();
  const { entryId } = useParams<{ entryId?: string }>();
  const [searchParams] = useSearchParams();
  const { key: locationKey } = useLocation();
  // O endereço de um registro (`?record=`, o link de um aviso) abre a pilha JÁ com ele, sob a coleção
  // dele. A chave da navegação entra no escopo para que abrir o mesmo aviso de novo o reabra, mesmo
  // depois de o convidado ter voltado ou ido a um filho.
  const linkedRecordId = entryId ? searchParams.get(PORTAL_RECORD_PARAM) ?? '' : '';
  const scope = `${tenantId ?? ''}|${entryId ?? ''}|${linkedRecordId ? `${linkedRecordId}|${locationKey}` : ''}`;
  const initialStack = useMemo<PortalOpenRecord[]>(
    () => (entryId && linkedRecordId ? [{ collection: entryId, projectionId: portalRecordDocId(entryId, linkedRecordId) }] : []),
    [entryId, linkedRecordId],
  );
  const [stored, setStored] = useState<NavigationState>(() => EMPTY(scope, initialStack));
  const state = stored.scope === scope ? stored : EMPTY(scope, initialStack);

  const update = useCallback((patch: (current: NavigationState) => Partial<NavigationState>) => {
    setStored((prev) => {
      const current = prev.scope === scope ? prev : EMPTY(scope, initialStack);
      return { ...current, ...patch(current) };
    });
  }, [scope, initialStack]);

  const openRecord = useCallback((collection: string, projectionId: string) => update((current) => ({
    stack: [...current.stack, { collection, projectionId }], creating: null, justSubmitted: false, justSaved: false,
  })), [update]);
  const back = useCallback(() => update((current) => ({ stack: current.stack.slice(0, -1), justSaved: false })), [update]);
  const startCreate = useCallback((collection: string, parentRecordId: string | null) => update(() => ({
    creating: { collection, parentRecordId }, justSubmitted: false, justSaved: false,
  })), [update]);
  const startEdit = useCallback((collection: string, recordId: string) => update(() => ({
    creating: { collection, parentRecordId: null, recordId }, justSubmitted: false, justSaved: false,
  })), [update]);
  const cancelCreate = useCallback(() => update(() => ({ creating: null })), [update]);
  const submitted = useCallback(() => update(() => ({ creating: null, justSubmitted: true })), [update]);
  const saved = useCallback(() => update(() => ({ creating: null, justSaved: true })), [update]);

  const value = useMemo(() => ({
    stack: state.stack,
    creating: state.creating,
    justSubmitted: state.justSubmitted,
    justSaved: state.justSaved,
    openRecord,
    back,
    startCreate,
    startEdit,
    cancelCreate,
    submitted,
    saved,
  }), [state, openRecord, back, startCreate, startEdit, cancelCreate, submitted, saved]);

  return <PortalNavigationContext.Provider value={value}>{children}</PortalNavigationContext.Provider>;
};
