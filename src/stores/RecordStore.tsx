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
export const RecordStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant, members } = useTenant();
  const { user, userRole, effectiveName } = useAuth();
  const { definitions, dynamicScreens } = useScreenDefinitions();
  const { recordRepository, recordNoteRepository, recordDocumentRepository } = useDI();

  const [recordsByCollection, setRecordsByCollection] = useState<Record<string, EntityRecord[]>>({});
  const [isLoading, setIsLoading] = useState(false);
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

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setRecordsByCollection({});
      return;
    }
    setIsLoading(true);
    let pending = collections.length;
    if (pending === 0) setIsLoading(false);
    // Uma coleção que RESPONDE — com dados ou com recusa — deixa de ser esperada. Contar só as
    // respostas de sucesso é o que prendia a tela girando quando a regra negava a leitura: o erro
    // ia para o console e o contador nunca chegava a zero.
    const settle = () => {
      pending -= 1;
      if (pending <= 0) setIsLoading(false);
    };
    const unsubscribers = collections.map((collection) =>
      uc.subscribe.execute(
        currentTenant.id,
        collection,
        (records) => {
          setRecordsByCollection((prev) => ({ ...prev, [collection]: records }));
          settle();
        },
        (deniedCollection) => {
          setRecordsByCollection((prev) => ({ ...prev, [deniedCollection]: [] }));
          settle();
        },
        visibleTo.get(collection) ?? null,
      ),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [currentTenant, collections, uc.subscribe, derivationRevision, visibleTo]);

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
  const tenantId = currentTenant?.id ?? null;
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
    // Antes de a janela responder, todo id pareceria faltar — e seria lido duas vezes.
    if (!tenantId || isLoading || ids.length === 0) return;
    const inWindow = new Set((recordsByCollection[collection] ?? []).map((record) => record.id));
    const missing = [...new Set(ids)].filter((id) => id !== '' && !inWindow.has(id));
    const fresh = markRequested(tenantId, missing.map((id) => `${collection}/${id}`))
      .map((key) => key.slice(collection.length + 1));
    if (fresh.length === 0) return;
    uc.getByIds.execute(tenantId, collection, fresh, visibleTo.get(collection) ?? null)
      .then((records) => remember(tenantId, collection, records))
      .catch((error: unknown) => console.warn(`[RecordStore] ensureRecords ${collection}:`, (error as Error).message));
  }, [tenantId, isLoading, recordsByCollection, markRequested, uc.getByIds, visibleTo, remember]);

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
    setRecordsByCollection((prev) => ({
      ...prev,
      [collection]: (prev[collection] ?? []).map((r) => (r.id === recordId ? { ...r, ...data } : r)),
    }));
    // O registro aberto de fora da janela também mostra o que acabou de ser gravado.
    setFetched((prev) => {
      const current = prev.byCollection[collection]?.[recordId];
      if (!current) return prev;
      return { ...prev, byCollection: { ...prev.byCollection, [collection]: { ...prev.byCollection[collection], [recordId]: { ...current, ...data } } } };
    });
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
  }, [currentTenant, uc.update]);

  const deleteRecord = useCallback(async (collection: string, recordId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, collection, recordId, actor);
    setRecordsByCollection((prev) => ({
      ...prev,
      [collection]: (prev[collection] ?? []).filter((r) => r.id !== recordId),
    }));
    setFetched((prev) => {
      if (!prev.byCollection[collection]?.[recordId]) return prev;
      const rest = { ...prev.byCollection[collection] };
      delete rest[recordId];
      return { ...prev, byCollection: { ...prev.byCollection, [collection]: rest } };
    });
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
  }, [currentTenant, user, effectiveName, uc.delete]);

  return (
    <RecordContext.Provider value={{
      recordsByCollection,
      allRecords,
      knownRecordsByCollection,
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
