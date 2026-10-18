import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { PortalStoreContext } from './usePortal';
import {
  makeGetPortalContextUseCase,
  makeGetPortalDocumentsUseCase,
  makeGetPortalDocumentUrlUseCase,
  makeListPortalMembershipsUseCase,
} from '../domain/usecases/portal/PortalUseCases';
import type { PortalContext, PortalMembership, PortalRecord } from '../domain/entities/Portal';

const CONTEXT_FAILED = '@core.tenant/portal.not-invited';

export const PortalStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { portalRepository } = useDI();

  const uc = useMemo(() => ({
    memberships: makeListPortalMembershipsUseCase(portalRepository),
    context: makeGetPortalContextUseCase(portalRepository),
    documents: makeGetPortalDocumentsUseCase(portalRepository),
    documentUrl: makeGetPortalDocumentUrlUseCase(portalRepository),
  }), [portalRepository]);

  const [memberships, setMemberships] = useState<PortalMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [context, setContext] = useState<PortalContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [records, setRecords] = useState<PortalRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [membershipsRevision, setMembershipsRevision] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    uc.memberships.execute(user.id)
      .then((loaded) => { if (active) setMemberships(loaded); })
      .catch((err: unknown) => {
        console.error('[PortalStore] memberships error:', err);
        if (active) setMemberships([]);
      })
      .finally(() => { if (active) setMembershipsLoading(false); });
    return () => { active = false; };
  }, [user, uc.memberships, membershipsRevision]);

  useEffect(() => {
    const handle = () => {
      if (!document.hidden) setMembershipsRevision((current) => current + 1);
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a troca de escritório zera o que era do anterior antes de carregar o novo
    setContextLoading(true);
    setContext(null);
    setError(null);
    setCollection(null);
    uc.context.execute(tenantId)
      .then((loaded) => {
        if (!active) return;
        setContext(loaded);
        setCollection(loaded.screens[0]?.collection ?? null);
      })
      .catch((err: unknown) => {
        console.error('[PortalStore] context error:', err);
        if (active) setError(CONTEXT_FAILED);
      })
      .finally(() => {
        if (active) setContextLoading(false);
      });
    return () => { active = false; };
  }, [tenantId, uc.context]);

  useEffect(() => {
    if (!tenantId || !collection || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sem tela escolhida não há lista a mostrar
      setRecords([]);
      return;
    }
    setRecordsLoading(true);
    return portalRepository.subscribeRecords(
      tenantId,
      user.id,
      collection,
      (next) => {
        setRecords(next);
        setRecordsLoading(false);
      },
      (err) => {
        console.error('[PortalStore] records error:', err);
        setRecords([]);
        setRecordsLoading(false);
      },
    );
  }, [tenantId, collection, user, portalRepository]);

  const getDocuments = useCallback(
    (projectionId: string) => (tenantId ? uc.documents.execute(tenantId, projectionId) : Promise.resolve([])),
    [tenantId, uc.documents],
  );

  const getDocumentUrl = useCallback(
    (projectionId: string, documentId: string) =>
      (tenantId ? uc.documentUrl.execute(tenantId, projectionId, documentId) : Promise.resolve('')),
    [tenantId, uc.documentUrl],
  );

  const value = useMemo(() => ({
    memberships,
    membershipsLoading,
    tenantId,
    context,
    contextLoading,
    error,
    collection,
    records,
    recordsLoading,
    selectTenant: setTenantId,
    selectCollection: setCollection,
    getDocuments,
    getDocumentUrl,
  }), [
    memberships, membershipsLoading, tenantId, context, contextLoading, error,
    collection, records, recordsLoading, getDocuments, getDocumentUrl,
  ]);

  return <PortalStoreContext.Provider value={value}>{children}</PortalStoreContext.Provider>;
};
