import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RecordContext } from './useRecords';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useScreenDefinitions } from './useScreenDefinitions';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToRecordsUseCase } from '../domain/usecases/records/SubscribeToRecordsUseCase';
import { makeCreateRecordUseCase } from '../domain/usecases/records/CreateRecordUseCase';
import { makeUpdateRecordUseCase } from '../domain/usecases/records/UpdateRecordUseCase';
import { makeDeleteRecordUseCase } from '../domain/usecases/records/DeleteRecordUseCase';
import { makeGetRecordsByIdsUseCase } from '../domain/usecases/records/GetRecordsByIdsUseCase';
import { makeSearchRecordsUseCase } from '../domain/usecases/records/SearchRecordsUseCase';
import { screenDataCollection } from '../domain/services/screenDataCollection';
import { memberVisibilityFilter, readMemberVisibility } from '../domain/schema/memberVisibility';
import type { MemberVisibilityFilter, RecordReader } from '../domain/schema/memberVisibility';
import { UNRESTRICTED_PERMISSION } from '../domain/schema/access';
import type { DeletionActor, EntityRecord, EntityRecordValues } from '../domain/entities';

/**
 * Registros das telas SEM store próprio — as do Form Design e as de extensão. As entidades fixas
 * seguem nos seus stores tipados; o contrato de leitura e gravação, porém, já é o mesmo.
 */
/** Quanto uma coleção que ninguém mais pede continua assinada — trocar de aba e voltar não reassina. */
const DEMAND_GRACE_MS = 60_000;

export const RecordStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant, members } = useTenant();
  const { user, userRole, effectiveName } = useAuth();
  const { definitions, dynamicScreens } = useScreenDefinitions();
  const { recordRepository, recordNoteRepository, recordDocumentRepository } = useDI();

  /**
   * O que cada assinatura entregou, por escritório. Uma coleção está CARREGADA quando a assinatura
   * dela respondeu (com dados ou com recusa); a que ninguém mais pede deixa de aparecer em
   * `recordsByCollection` sem precisar ser apagada — o mesmo para a troca de escritório.
   */
  const [snapshots, setSnapshots] = useState<{ tenantId: string | null; byCollection: Record<string, EntityRecord[]> }>(
    { tenantId: null, byCollection: {} },
  );
  /**
   * Muda quando os calendários de dias úteis mudam. Um campo derivado é avaliado na LEITURA, dentro
   * do repositório, e um registro já lido não se recalcula sozinho: reassinar é o que faz o prazo
   * derivado enxergar o dia que o escritório acabou de marcar.
   */
  const [derivationRevision, setDerivationRevision] = useState(0);

  useEffect(
    () => storeEvents.on(StoreEvents.BUSINESS_CALENDARS_UPDATED, () => setDerivationRevision((revision) => revision + 1)),
    [],
  );

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToRecordsUseCase(recordRepository),
    create: makeCreateRecordUseCase(recordRepository),
    update: makeUpdateRecordUseCase(recordRepository),
    getByIds: makeGetRecordsByIdsUseCase(recordRepository),
    search: makeSearchRecordsUseCase(recordRepository),
    delete: makeDeleteRecordUseCase(recordRepository, recordNoteRepository, recordDocumentRepository),
  }), [recordRepository, recordNoteRepository, recordDocumentRepository]);

  // A coleção, não a tela: duas telas sobre a mesma coleção (uma delas BOUND) assinam uma vez só.
  const collections = useMemo(
    () => [...new Set(dynamicScreens.map((def) => screenDataCollection(def)))],
    [dynamicScreens],
  );

  /**
   * Quem lê, pelo conjunto MATERIALIZADO — o mesmo que o `firestore.rules` consulta —, e não pelo que o
   * `AuthorizationStore` recalcula. A consulta é montada para a REGRA aceitar: decidir pela conta da
   * tela mandaria, no intervalo em que as duas divergem, uma consulta sem filtro que seria recusada
   * inteira. O dono e o `SYSTEM` entram com o curinga, como em `can()`.
   */
  const reader = useMemo<RecordReader | null>(() => {
    if (!user) return null;
    const unrestricted = userRole === 'SYSTEM' || currentTenant?.ownerId === user.id;
    const member = members.find((candidate) => candidate.userId === user.id);
    return { uid: user.id, permissions: unrestricted ? [UNRESTRICTED_PERMISSION] : (member?.permissions ?? []) };
  }, [user, userRole, currentTenant, members]);

  /**
   * A restrição de cada coleção para quem lê (`memberVisibility`), lida do documento da COLEÇÃO — o que
   * a regra lê. Vira texto para que a lista de membros relida, com o mesmo conteúdo, não reassine as
   * coleções todas.
   */
  const visibilityKey = useMemo(() => JSON.stringify(collections.map((collection) => [
    collection,
    memberVisibilityFilter(
      readMemberVisibility(definitions.find((definition) => definition.id === collection)?.memberVisibility),
      collection,
      reader,
    ),
  ])), [collections, definitions, reader]);

  const visibleTo = useMemo(
    () => new Map(JSON.parse(visibilityKey) as [string, MemberVisibilityFilter | null][]),
    [visibilityKey],
  );

  /**
   * QUEM precisa de cada coleção, e de quantos registros. Nada é assinado por existir: a tela aberta,
   * a aba de filhos, a view de extensão, o selo do menu e os calendários pedem (`useRecordDemand`) e
   * soltam. Antes, o login assinava a janela de toda coleção do escritório — 500 documentos por tela,
   * relidos a cada volta à aba, para telas que ninguém abria.
   *
   * Soltar espera `DEMAND_GRACE_MS`: trocar de aba e voltar não pode custar uma reassinatura.
   */
  const [demands, setDemands] = useState<Record<string, Record<string, number>>>({});
  const demandSeq = useRef(0);
  const releaseTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = releaseTimers.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const demand = useCallback((wanted: readonly string[], limit: number) => {
    const unique = [...new Set(wanted.filter((collection) => collection !== ''))];
    if (unique.length === 0) return () => undefined;
    demandSeq.current += 1;
    const token = String(demandSeq.current);
    setDemands((prev) => {
      const next = { ...prev };
      for (const collection of unique) next[collection] = { ...(next[collection] ?? {}), [token]: limit };
      return next;
    });
    return () => {
      const timer = setTimeout(() => {
        releaseTimers.current.delete(timer);
        setDemands((prev) => {
          const next = { ...prev };
          for (const collection of unique) {
            const rest = { ...(next[collection] ?? {}) };
            delete rest[token];
            if (Object.keys(rest).length > 0) next[collection] = rest;
            else delete next[collection];
          }
          return next;
        });
      }, DEMAND_GRACE_MS);
      releaseTimers.current.add(timer);
    };
  }, []);

  /** Coleção → a MAIOR janela pedida. Texto, para que um pedido igual não reassine nada. */
  const activeKey = useMemo(() => JSON.stringify(
    Object.entries(demands)
      .map(([collection, byToken]) => [collection, Math.max(...Object.values(byToken))] as const)
      .sort(([left], [right]) => (left < right ? -1 : 1)),
  ), [demands]);

  const tenantId = currentTenant?.id ?? null;
  const subscriptions = useRef(new Map<string, { signature: string; unsubscribe: () => void }>());

  useEffect(() => {
    const current = subscriptions.current;
    const wanted = new Map(JSON.parse(activeKey) as [string, number][]);
    for (const [collection, subscription] of current) {
      if (!tenantId || !wanted.has(collection)) {
        subscription.unsubscribe();
        current.delete(collection);
      }
    }
    if (!tenantId) return;
    for (const [collection, limit] of wanted) {
      const filter = visibleTo.get(collection) ?? null;
      const signature = JSON.stringify([tenantId, limit, filter, derivationRevision]);
      const existing = current.get(collection);
      if (existing?.signature === signature) continue;
      existing?.unsubscribe();
      // Uma coleção que RESPONDE — com dados ou com recusa — está carregada. Esperar só pelo sucesso
      // prendia a tela girando quando a regra negava a leitura.
      const deliver = (records: EntityRecord[]) => setSnapshots((prev) => ({
        tenantId,
        byCollection: { ...(prev.tenantId === tenantId ? prev.byCollection : {}), [collection]: records },
      }));
      const unsubscribe = uc.subscribe.execute(tenantId, collection, deliver, () => deliver([]), filter, limit);
      current.set(collection, { signature, unsubscribe });
    }
  }, [tenantId, activeKey, visibleTo, derivationRevision, uc.subscribe]);

  useEffect(() => {
    const current = subscriptions.current;
    return () => {
      for (const subscription of current.values()) subscription.unsubscribe();
      current.clear();
    };
  }, []);

  const activeCollections = useMemo(
    () => new Set((JSON.parse(activeKey) as [string, number][]).map(([collection]) => collection)),
    [activeKey],
  );

  const recordsByCollection = useMemo(() => {
    if (snapshots.tenantId !== tenantId) return {};
    const visible: Record<string, EntityRecord[]> = {};
    for (const [collection, records] of Object.entries(snapshots.byCollection)) {
      if (activeCollections.has(collection)) visible[collection] = records;
    }
    return visible;
  }, [snapshots, tenantId, activeCollections]);

  const loadedCollections = useMemo(() => new Set(Object.keys(recordsByCollection)), [recordsByCollection]);
  const isLoading = [...activeCollections].some((collection) => !loadedCollections.has(collection));

  /** O mesmo estado, com a gravação local otimista aplicada à coleção que já está na memória. */
  const patchCollection = useCallback((collection: string, change: (records: EntityRecord[]) => EntityRecord[]) => {
    setSnapshots((prev) => {
      const records = prev.byCollection[collection];
      return records ? { ...prev, byCollection: { ...prev.byCollection, [collection]: change(records) } } : prev;
    });
  }, []);

  const allRecords = useMemo(
    () => Object.values(recordsByCollection).flat(),
    [recordsByCollection],
  );

  /**
   * Os registros trazidos FORA da janela, por escritório: trocar de escritório não precisa limpar nada,
   * porque o que é de outro simplesmente deixa de valer. `requested` guarda o que já foi pedido — achado
   * ou não —, para que um nome que não existe mais não seja relido a cada render.
   */
  const [fetched, setFetched] = useState<{ tenantId: string | null; byCollection: Record<string, Record<string, EntityRecord>> }>(
    { tenantId: null, byCollection: {} },
  );
  const requested = useRef<{ tenantId: string | null; keys: Set<string> }>({ tenantId: null, keys: new Set() });
  const fetchedByCollection = useMemo(
    () => (fetched.tenantId === tenantId ? fetched.byCollection : {}),
    [fetched, tenantId],
  );

  const remember = useCallback((owner: string, collection: string, records: EntityRecord[]) => {
    if (records.length === 0) return;
    setFetched((prev) => {
      const base = prev.tenantId === owner ? prev.byCollection : {};
      const merged = { ...(base[collection] ?? {}) };
      for (const record of records) merged[record.id] = record;
      return { tenantId: owner, byCollection: { ...base, [collection]: merged } };
    });
  }, []);

  const markRequested = useCallback((owner: string, keys: string[]): string[] => {
    if (requested.current.tenantId !== owner) requested.current = { tenantId: owner, keys: new Set() };
    const fresh = keys.filter((key) => !requested.current.keys.has(key));
    for (const key of fresh) requested.current.keys.add(key);
    return fresh;
  }, []);

  // O que veio de fora da janela não é assinado: ao voltar à aba, esquece-se, e o próximo pedido relê.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      requested.current = { tenantId: null, keys: new Set() };
      setFetched({ tenantId: null, byCollection: {} });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const knownRecordsByCollection = useMemo(() => {
    const known: Record<string, EntityRecord[]> = { ...recordsByCollection };
    for (const [collection, extras] of Object.entries(fetchedByCollection)) {
      const loaded = recordsByCollection[collection] ?? [];
      const inWindow = new Set(loaded.map((record) => record.id));
      const outside = Object.values(extras).filter((record) => !inWindow.has(record.id));
      if (outside.length > 0) known[collection] = [...loaded, ...outside];
    }
    return known;
  }, [recordsByCollection, fetchedByCollection]);

  const ensureRecords = useCallback((collection: string, ids: readonly string[]) => {
    // Antes de a janela pedida responder, todo id pareceria faltar — e seria lido duas vezes.
    if (!tenantId || ids.length === 0) return;
    if (activeCollections.has(collection) && !loadedCollections.has(collection)) return;
    const inWindow = new Set((recordsByCollection[collection] ?? []).map((record) => record.id));
    const missing = [...new Set(ids)].filter((id) => id !== '' && !inWindow.has(id));
    const fresh = markRequested(tenantId, missing.map((id) => `${collection}/${id}`))
      .map((key) => key.slice(collection.length + 1));
    if (fresh.length === 0) return;
    uc.getByIds.execute(tenantId, collection, fresh, visibleTo.get(collection) ?? null)
      .then((records) => remember(tenantId, collection, records))
      .catch((error: unknown) => console.warn(`[RecordStore] ensureRecords ${collection}:`, (error as Error).message));
  }, [tenantId, activeCollections, loadedCollections, recordsByCollection, markRequested, uc.getByIds, visibleTo, remember]);

  const searchRecords = useCallback(async (collection: string, text: string, max: number) => {
    if (!tenantId) return [];
    const records = await uc.search.execute(tenantId, collection, text, max, visibleTo.get(collection) ?? null);
    markRequested(tenantId, records.map((record) => `${collection}/${record.id}`));
    remember(tenantId, collection, records);
    return records;
  }, [tenantId, uc.search, visibleTo, markRequested, remember]);

  /**
   * A AUTORIA é carimbada aqui, e não em cada tela que grava: o formulário dinâmico, o editor de
   * extensão e o `useEntityForm` gravavam os três o mesmo `createdBy`, e nenhum deles o nome — que é
   * o que uma listagem precisa para mostrar quem escreveu. Um valor explícito em `data` ainda vence,
   * para o caso em que quem cria não é quem está logado.
   */
  const createRecord = useCallback(async (
    collection: string,
    data: EntityRecordValues,
    recordId?: string,
  ) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, collection, {
      createdBy: user?.id ?? '',
      createdByName: effectiveName,
      createdByPhotoURL: user?.photoURL ?? '',
      ...data,
    }, recordId);
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
    return item;
  }, [currentTenant, uc.create, user, effectiveName]);

  /**
   * O id de um registro que AINDA não existe, para que um arquivo escolhido antes do save já suba
   * para o caminho definitivo dele. Quem chama guarda o valor e o devolve ao `createRecord`.
   */
  const newRecordId = useCallback((collection: string) => {
    if (!currentTenant) throw new Error('No tenant selected');
    return recordRepository.newId(currentTenant.id, collection);
  }, [currentTenant, recordRepository]);

  const updateRecord = useCallback(async (
    collection: string,
    recordId: string,
    data: EntityRecordValues,
  ) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, collection, recordId, data);
    patchCollection(collection, (records) => records.map((r) => (r.id === recordId ? { ...r, ...data } : r)));
    // O registro aberto de fora da janela também mostra o que acabou de ser gravado.
    setFetched((prev) => {
      const current = prev.byCollection[collection]?.[recordId];
      if (!current) return prev;
      return { ...prev, byCollection: { ...prev.byCollection, [collection]: { ...prev.byCollection[collection], [recordId]: { ...current, ...data } } } };
    });
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
  }, [currentTenant, uc.update, patchCollection]);

  const deleteRecord = useCallback(async (collection: string, recordId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, collection, recordId, actor);
    patchCollection(collection, (records) => records.filter((r) => r.id !== recordId));
    setFetched((prev) => {
      if (!prev.byCollection[collection]?.[recordId]) return prev;
      const rest = { ...prev.byCollection[collection] };
      delete rest[recordId];
      return { ...prev, byCollection: { ...prev.byCollection, [collection]: rest } };
    });
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
  }, [currentTenant, user, effectiveName, uc.delete, patchCollection]);

  return (
    <RecordContext.Provider value={{
      recordsByCollection,
      allRecords,
      knownRecordsByCollection,
      loadedCollections,
      demand,
      ensureRecords,
      searchRecords,
      isLoading,
      createRecord,
      newRecordId,
      updateRecord,
      deleteRecord,
    }}>
      {children}
    </RecordContext.Provider>
  );
};
