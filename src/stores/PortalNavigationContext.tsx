import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePortal } from './usePortal';
import { PortalNavigationContext, type PortalCreating, type PortalOpenRecord } from './usePortalNavigation';
import { PORTAL_RECORD_PARAM, portalRecordDocId, portalRecordIdOf, portalRecordPath } from '../domain/schema/portal';

/**
 * Marca, no histórico, a entrada aberta de um cartão da HOME: o "Voltar" do registro devolve à home
 * pelo próprio histórico, em vez de cair na lista do item.
 */
const OPENED_FROM_HOME = 'portalOpenedFromHome';

const openedFromHome = (state: unknown): boolean =>
  !!state && typeof state === 'object' && (state as Record<string, unknown>)[OPENED_FROM_HOME] === true;

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
  const { tenantId: routeTenantId, entryId } = useParams<{ tenantId?: string; entryId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { key: locationKey, state: locationState } = useLocation();
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

  const returnsHome = !!entryId && openedFromHome(locationState);

  // A home não tem pilha: o registro tocado num cartão dela abre no ENDEREÇO dele — o mesmo do e-mail e
  // do sino —, e o item do menu o mostra com tudo o que a pilha já sabe desenhar.
  const openRecord = useCallback((collection: string, projectionId: string) => {
    if (!entryId) {
      if (routeTenantId) {
        navigate(
          portalRecordPath(routeTenantId, collection, portalRecordIdOf(collection, projectionId)),
          { state: { [OPENED_FROM_HOME]: true } },
        );
      }
      return;
    }
    update((current) => ({
      stack: [...current.stack, { collection, projectionId }], creating: null, justSubmitted: false, justSaved: false,
    }));
  }, [entryId, routeTenantId, navigate, update]);
  const back = useCallback(() => {
    if (returnsHome && state.stack.length <= 1) {
      navigate(-1);
      return;
    }
    update((current) => (current.stack.length === 0 ? {} : { stack: current.stack.slice(0, -1), justSaved: false }));
  }, [returnsHome, state.stack.length, navigate, update]);
  const startCreate = useCallback((collection: string, parentRecordId: string | null) => update(() => ({
    creating: { collection, parentRecordId }, justSubmitted: false, justSaved: false,
  })), [update]);
  const startEdit = useCallback((collection: string, recordId: string) => update(() => ({
    creating: { collection, parentRecordId: null, recordId }, justSubmitted: false, justSaved: false,
  })), [update]);
  const cancelCreate = useCallback(() => update(() => ({ creating: null })), [update]);
  const submitted = useCallback(() => update(() => ({ creating: null, justSubmitted: true })), [update]);
  const saved = useCallback(() => update(() => ({ creating: null, justSaved: true })), [update]);

  // Uma lista com repetição, e não um conjunto: duas views do mesmo registro (o detalhe e um cartão)
  // assumem duas vezes, e a primeira a sair não devolve a barra enquanto a outra continua lá.
  const [claimedActions, setClaimedActions] = useState<string[]>([]);
  const claimActions = useCallback((projectionId: string) => {
    setClaimedActions((current) => [...current, projectionId]);
    return () => setClaimedActions((current) => {
      const index = current.indexOf(projectionId);
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)];
    });
  }, []);

  const value = useMemo(() => ({
    stack: state.stack,
    creating: state.creating,
    justSubmitted: state.justSubmitted,
    justSaved: state.justSaved,
    returnsHome,
    openRecord,
    back,
    startCreate,
    startEdit,
    cancelCreate,
    submitted,
    saved,
    claimedActions,
    claimActions,
  }), [state, returnsHome, openRecord, back, startCreate, startEdit, cancelCreate, submitted, saved, claimedActions, claimActions]);

  return <PortalNavigationContext.Provider value={value}>{children}</PortalNavigationContext.Provider>;
};
