import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
  }, [currentTenant, user, effectiveName, uc.delete]);

  return (
    <RecordContext.Provider value={{
      recordsByCollection,
      allRecords,
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
