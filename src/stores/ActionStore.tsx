import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionContext } from './useActions';
import type { ActionSaveInput } from './useActions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetActionsUseCase } from '../domain/usecases/actions/GetActionsUseCase';
import { makeSubscribeToActionsUseCase } from '../domain/usecases/actions/SubscribeToActionsUseCase';
import { makeCreateActionUseCase } from '../domain/usecases/actions/CreateActionUseCase';
import { makeUpdateActionUseCase } from '../domain/usecases/actions/UpdateActionUseCase';
import { makeDeleteActionUseCase } from '../domain/usecases/actions/DeleteActionUseCase';
import { makeRunActionUseCase } from '../domain/usecases/actions/RunActionUseCase';
import type { ActionDefinition, DeletionActor } from '../domain/entities';
import type { RunActionInput } from '../domain/repositories/IActionRepository';

import { LocalizedError } from '../domain/errors/LocalizedError';
export const ActionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { actionRepository } = useDI();

  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetActionsUseCase(actionRepository),
    subscribe: makeSubscribeToActionsUseCase(actionRepository),
    create: makeCreateActionUseCase(actionRepository),
    update: makeUpdateActionUseCase(actionRepository),
    delete: makeDeleteActionUseCase(actionRepository),
    run: makeRunActionUseCase(actionRepository),
  }), [actionRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      setActions(await uc.get.execute(currentTenant.id));
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa o cache ao sair do escritório
      setActions([]);
      return;
    }
    setIsLoading(true);
    const unsub = uc.subscribe.execute(currentTenant.id, (list) => {
      setActions(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [currentTenant, uc.subscribe]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.ACTIONS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const getAction = useCallback(
    (actionId: string) => actions.find((action) => action.id === actionId),
    [actions],
  );

  const getActionsByIds = useCallback(
    (actionIds: string[]): ActionDefinition[] =>
      actionIds
        .map((actionId) => actions.find((action) => action.id === actionId))
        .filter((action): action is ActionDefinition => !!action && action.enabled),
    [actions],
  );

  const createAction = useCallback(async (data: ActionSaveInput, id?: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const created = await uc.create.execute(currentTenant.id, {
      ...data,
      createdBy: user.id,
      updatedBy: user.id,
      updatedByName: effectiveName,
      updatedByPhotoURL: user.photoURL ?? '',
    }, id);
    storeEvents.emit(StoreEvents.ACTIONS_UPDATED);
    return created;
  }, [currentTenant, user, effectiveName, uc.create]);

  const updateAction = useCallback(async (actionId: string, data: Partial<ActionSaveInput>) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    await uc.update.execute(currentTenant.id, actionId, {
      ...data,
      updatedBy: user.id,
      updatedByName: effectiveName,
      updatedByPhotoURL: user.photoURL ?? '',
    });
    storeEvents.emit(StoreEvents.ACTIONS_UPDATED);
  }, [currentTenant, user, effectiveName, uc.update]);

  const deleteAction = useCallback(async (actionId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, actionId, actor);
    storeEvents.emit(StoreEvents.ACTIONS_UPDATED);
  }, [currentTenant, user, effectiveName, uc.delete]);

  const runAction = useCallback(async (input: Omit<RunActionInput, 'tenantId'>) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    return uc.run.execute({ ...input, tenantId: currentTenant.id });
  }, [currentTenant, uc.run]);

  return (
    <ActionContext.Provider value={{
      actions,
      isLoading,
      getAction,
      getActionsByIds,
      createAction,
      updateAction,
      deleteAction,
      runAction,
      refresh,
    }}>
      {children}
    </ActionContext.Provider>
  );
};
