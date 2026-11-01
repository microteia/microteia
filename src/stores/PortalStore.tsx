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
  makeListPortalRecordActionsUseCase,
  makeRecordPortalViewUseCase,
  makeRunPortalRecordActionUseCase,
  makeSubmitPortalRecordUseCase,
  makeListPortalCreateTargetsUseCase,
  makeUpdatePortalRecordUseCase,
  makeUploadPortalDocumentUseCase,
} from '../domain/usecases/portal/PortalUseCases';
import type { PortalContext, PortalMembership, PortalRecord } from '../domain/entities/Portal';

/** A recusa do convite suspenso — o servidor a nomeia, e a casca diz o que fazer em vez de "revogado". */
const IDENTITY_REQUIRED = '@core.tenant/portal.signin.identity-required';

const codeOf = (err: unknown): string =>
  typeof (err as { code?: unknown } | null)?.code === 'string' ? (err as { code: string }).code : 'unknown';

/**
 * Falhas que passam sozinhas — a mais comum é a function acordando (início a frio), que recusa a
 * primeira chamada e atende a segunda. Tentar de novo aqui poupa o convidado de apertar um botão.
 */
const TRANSIENT_CODES = new Set(['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded']);
const RETRY_DELAYS_MS = [800, 2000];

const wait = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

const cacheKey = (userId: string, tenantId: string) => `microteia:portalContext:${userId}:${tenantId}`;

/**
 * O contexto guardado no navegador: a casca abre NA HORA com o da última visita e se atualiza em
 * segundo plano. Conveniência do navegador, nunca fonte de verdade — o que o convidado vê continua
 * passando pelas regras, e um convite revogado apaga o guardado.
 */
const readCachedContext = (userId: string, tenantId: string): PortalContext | null => {
  try {
    const raw = localStorage.getItem(cacheKey(userId, tenantId));
    return raw ? (JSON.parse(raw) as PortalContext) : null;
  } catch {
    return null;
  }
};

const writeCachedContext = (userId: string, tenantId: string, context: PortalContext | null): void => {
  try {
    if (context) localStorage.setItem(cacheKey(userId, tenantId), JSON.stringify(context));
    else localStorage.removeItem(cacheKey(userId, tenantId));
  } catch {
    // Sem armazenamento, a próxima visita só espera o servidor — como da primeira vez.
  }
};

export const PortalStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { portalRepository } = useDI();
  const { locale } = useOptionalLocale();
  const userId = user?.id ?? null;

  const uc = useMemo(() => ({
    memberships: makeListPortalMembershipsUseCase(portalRepository),
    context: makeGetPortalContextUseCase(portalRepository),
    documents: makeGetPortalDocumentsUseCase(portalRepository),
    documentUrl: makeGetPortalDocumentUrlUseCase(portalRepository),
    recordView: makeRecordPortalViewUseCase(portalRepository),
    listActions: makeListPortalRecordActionsUseCase(portalRepository),
    runAction: makeRunPortalRecordActionUseCase(portalRepository),
    linkOptions: makeListPortalLinkOptionsUseCase(portalRepository),
    submit: makeSubmitPortalRecordUseCase(portalRepository),
    createTargets: makeListPortalCreateTargetsUseCase(portalRepository),
    update: makeUpdatePortalRecordUseCase(portalRepository),
    upload: makeUploadPortalDocumentUseCase(portalRepository),
  }), [portalRepository]);

  const [memberships, setMemberships] = useState<PortalMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [membershipsFailed, setMembershipsFailed] = useState(false);
  const [membershipsRevision, setMembershipsRevision] = useState(0);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [context, setContext] = useState<PortalContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState<'not-invited' | 'identity-required' | 'failed' | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [contextRevision, setContextRevision] = useState(0);
  const [recordsByCollection, setRecordsByCollection] = useState<Record<string, PortalRecord[]>>({});
  const [loadedCollections, setLoadedCollections] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    let active = true;
    uc.memberships.execute(userId)
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
  }, [userId, uc.memberships, membershipsRevision]);

  useEffect(() => {
    const handle = () => {
      if (!document.hidden) setMembershipsRevision((current) => current + 1);
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);

  useEffect(() => {
    if (!tenantId || !userId) return;
    let active = true;
    const cached = readCachedContext(userId, tenantId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a troca de escritório mostra o guardado (ou nada) antes de buscar o novo
    setContext(cached);
    setContextLoading(!cached);
    setError(null);
    setErrorCode(null);

    const load = async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const loaded = await uc.context.execute(tenantId, locale);
          if (!active) return;
          setContext(loaded);
          writeCachedContext(userId, tenantId, loaded);
          return;
        } catch (err) {
          const code = codeOf(err);
          if (TRANSIENT_CODES.has(code) && attempt < RETRY_DELAYS_MS.length) {
            await wait(RETRY_DELAYS_MS[attempt]);
            if (!active) return;
            continue;
          }
          console.error('[PortalStore] context error:', err);
          if (!active) return;
          if (code === 'functions/permission-denied') {
            writeCachedContext(userId, tenantId, null);
            setContext(null);
            setError(err instanceof Error && err.message === IDENTITY_REQUIRED ? 'identity-required' : 'not-invited');
            setErrorCode(code);
          } else if (!cached) {
            setError('failed');
            setErrorCode(code);
          }
          return;
        }
      }
    };
    void load().finally(() => { if (active) setContextLoading(false); });
    return () => { active = false; };
  }, [tenantId, userId, uc.context, locale, contextRevision]);

  const collections = useMemo(
    () => [...new Set((context?.screens ?? []).map((screen) => screen.collection))].sort(),
    [context],
  );
  const collectionsKey = collections.join('|');
  const publicCollectionsKey = useMemo(
    () => [...new Set((context?.screens ?? []).filter((screen) => screen.public).map((screen) => screen.collection))].sort().join('|'),
    [context],
  );

  useEffect(() => {
    if (!tenantId || !userId || collectionsKey === '') return;
    const wanted = collectionsKey.split('|');
    const publicOnes = new Set(publicCollectionsKey.split('|'));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- outro conjunto de telas começa sem retrato nenhum
    setLoadedCollections(new Set());
    setRecordsByCollection({});
    const unsubscribes = wanted.map((collection) => {
      const onUpdate = (next: PortalRecord[]) => {
        setRecordsByCollection((prev) => ({ ...prev, [collection]: next }));
        setLoadedCollections((prev) => new Set([...prev, collection]));
      };
      const onError = (err: Error) => {
        console.error('[PortalStore] records error:', collection, err);
        setRecordsByCollection((prev) => ({ ...prev, [collection]: [] }));
        setLoadedCollections((prev) => new Set([...prev, collection]));
      };
      return publicOnes.has(collection)
        ? portalRepository.subscribePublicRecords(tenantId, collection, onUpdate, onError)
        : portalRepository.subscribeRecords(tenantId, userId, collection, onUpdate, onError);
    });
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [tenantId, userId, collectionsKey, publicCollectionsKey, portalRepository]);

  const isCollectionLoading = useCallback((collection: string) => !loadedCollections.has(collection), [loadedCollections]);

  const retryContext = useCallback(() => setContextRevision((current) => current + 1), []);
  const retryMemberships = useCallback(() => {
    setMembershipsLoading(true);
    setMembershipsRevision((current) => current + 1);
  }, []);

  const getDocuments = useCallback(
    (projectionId: string) => (tenantId ? uc.documents.execute(tenantId, projectionId) : Promise.resolve([])),
    [tenantId, uc.documents],
  );

  const subscribeChildren = useCallback((
    childCollection: string,
    parentKey: string,
    max: number,
    onUpdate: (records: PortalRecord[]) => void,
    onError: () => void,
  ) => (tenantId && userId
    ? portalRepository.subscribeChildren(tenantId, userId, childCollection, parentKey, max, onUpdate, onError)
    : () => undefined), [tenantId, userId, portalRepository]);

  const getDocumentUrl = useCallback(
    (projectionId: string, documentId: string) =>
      (tenantId ? uc.documentUrl.execute(tenantId, projectionId, documentId) : Promise.resolve('')),
    [tenantId, uc.documentUrl],
  );

  const recordView = useCallback(
    (projectionId: string) => (tenantId ? uc.recordView.execute(tenantId, projectionId) : Promise.resolve()),
    [tenantId, uc.recordView],
  );

  const listRecordActions = useCallback(
    (projectionId: string) => (tenantId ? uc.listActions.execute(tenantId, projectionId, locale) : Promise.resolve([])),
    [tenantId, uc.listActions, locale],
  );

  const runRecordAction = useCallback(
    (projectionId: string, actionId: string) => {
      if (!tenantId) return Promise.reject(new Error('@core.tenant/portal.action.unavailable'));
      return uc.runAction.execute(tenantId, projectionId, actionId, locale);
    },
    [tenantId, uc.runAction, locale],
  );

  const listLinkOptions = useCallback(
    (linkCollection: string) => (tenantId && userId ? uc.linkOptions.execute(tenantId, userId, linkCollection) : Promise.resolve([])),
    [tenantId, userId, uc.linkOptions],
  );

  const submit = useCallback(async (targetCollection: string, linkRecordId: string, data: Record<string, unknown>) => {
    if (!tenantId) return;
    await uc.submit.execute({ tenantId, collection: targetCollection, linkRecordId, data, locale });
  }, [tenantId, uc.submit, locale]);

  const listCreateTargets = useCallback(async (targetCollection: string, linkRecordIds: string[]) => {
    if (!tenantId || linkRecordIds.length === 0) return [];
    return uc.createTargets.execute({ tenantId, collection: targetCollection, linkRecordIds }).catch(() => []);
  }, [tenantId, uc.createTargets]);

  const update = useCallback(async (targetCollection: string, recordId: string, data: Record<string, unknown>) => {
    if (!tenantId) return;
    await uc.update.execute({ tenantId, collection: targetCollection, recordId, data, locale });
  }, [tenantId, uc.update, locale]);

  const uploadDocument = useCallback(async (targetCollection: string, recordId: string, file: File, type: string) => {
    if (!tenantId || !userId) return;
    await uc.upload.execute({ tenantId, userId, collection: targetCollection, recordId, file, type });
  }, [tenantId, userId, uc.upload]);

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
    recordsByCollection,
    isCollectionLoading,
    selectTenant: setTenantId,
    getDocuments,
    getDocumentUrl,
    recordView,
    listRecordActions,
    runRecordAction,
    subscribeChildren,
    listLinkOptions,
    submit,
    listCreateTargets,
    update,
    userId,
    uploadDocument,
  }), [
    memberships, membershipsLoading, membershipsFailed, tenantId, context, contextLoading, error, errorCode,
    retryContext, retryMemberships, recordsByCollection, isCollectionLoading, getDocuments, getDocumentUrl, recordView, subscribeChildren,
    listRecordActions, runRecordAction, listLinkOptions, submit, listCreateTargets, update, userId, uploadDocument,
  ]);

  return <PortalStoreContext.Provider value={value}>{children}</PortalStoreContext.Provider>;
};
