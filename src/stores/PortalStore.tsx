import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { useOptionalLocale } from './useLocale';
import { PortalStoreContext } from './usePortal';
import {
  makeGetPortalContextUseCase,
  makeGetPortalDocumentsUseCase,
  makeGetPortalDocumentUrlUseCase,
  makeListPortalLinkOptionsUseCase,
  makeListPortalMembershipsUseCase,
  makeSubmitPortalRecordUseCase,
} from '../domain/usecases/portal/PortalUseCases';
import type { PortalContext, PortalMembership, PortalRecord } from '../domain/entities/Portal';

const codeOf = (err: unknown): string =>
  typeof (err as { code?: unknown } | null)?.code === 'string' ? (err as { code: string }).code : 'unknown';

export const PortalStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { portalRepository } = useDI();
  const { locale } = useOptionalLocale();

  const uc = useMemo(() => ({
    memberships: makeListPortalMembershipsUseCase(portalRepository),
    context: makeGetPortalContextUseCase(portalRepository),
    documents: makeGetPortalDocumentsUseCase(portalRepository),
    documentUrl: makeGetPortalDocumentUrlUseCase(portalRepository),
    linkOptions: makeListPortalLinkOptionsUseCase(portalRepository),
    submit: makeSubmitPortalRecordUseCase(portalRepository),
  }), [portalRepository]);

  const [memberships, setMemberships] = useState<PortalMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [membershipsFailed, setMembershipsFailed] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [context, setContext] = useState<PortalContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState<'not-invited' | 'failed' | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [contextRevision, setContextRevision] = useState(0);
  const [collection, setCollection] = useState<string | null>(null);
  const [records, setRecords] = useState<PortalRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [membershipsRevision, setMembershipsRevision] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    uc.memberships.execute(user.id)
      .then((loaded) => {
        if (!active) return;
        setMemberships(loaded);
        setMembershipsFailed(false);
      })
      .catch((err: unknown) => {
        console.error('[PortalStore] memberships error:', err);
        if (!active) return;
        setMemberships([]);
        setMembershipsFailed(true);
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
    setErrorCode(null);
    setCollection(null);
    uc.context.execute(tenantId, locale)
      .then((loaded) => {
        if (!active) return;
        setContext(loaded);
        setCollection(loaded.screens[0]?.collection ?? null);
      })
      .catch((err: unknown) => {
        console.error('[PortalStore] context error:', err);
        if (!active) return;
        const code = codeOf(err);
        setError(code === 'functions/permission-denied' ? 'not-invited' : 'failed');
        setErrorCode(code);
      })
      .finally(() => {
        if (active) setContextLoading(false);
      });
    return () => { active = false; };
  }, [tenantId, uc.context, locale, contextRevision]);

  const retryContext = useCallback(() => setContextRevision((current) => current + 1), []);
  const retryMemberships = useCallback(() => {
    setMembershipsLoading(true);
    setMembershipsRevision((current) => current + 1);
  }, []);

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

  const listLinkOptions = useCallback(
    (linkCollection: string) => (tenantId && user ? uc.linkOptions.execute(tenantId, user.id, linkCollection) : Promise.resolve([])),
    [tenantId, user, uc.linkOptions],
  );

  const submit = useCallback(async (targetCollection: string, linkRecordId: string, data: Record<string, unknown>) => {
    if (!tenantId) return;
    await uc.submit.execute({ tenantId, collection: targetCollection, linkRecordId, data, locale });
  }, [tenantId, uc.submit, locale]);

  const value = useMemo(() => ({
    memberships,
    membershipsLoading,
    membershipsFailed,
    tenantId,
    context,
    contextLoading,
    error,
    errorCode,
    retryContext,
    retryMemberships,
    collection,
    records,
    recordsLoading,
    selectTenant: setTenantId,
    selectCollection: setCollection,
    getDocuments,
    getDocumentUrl,
    listLinkOptions,
    submit,
  }), [
    memberships, membershipsLoading, membershipsFailed, tenantId, context, contextLoading, error, errorCode, retryContext, retryMemberships,
    collection, records, recordsLoading, getDocuments, getDocumentUrl, listLinkOptions, submit,
  ]);

  return <PortalStoreContext.Provider value={value}>{children}</PortalStoreContext.Provider>;
};
