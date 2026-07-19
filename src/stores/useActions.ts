import { createContext, useContext } from 'react';
import type { ActionDefinition } from '../domain/entities';
import type { ActionDefinitionInput, RunActionInput, RunActionResult } from '../domain/repositories/IActionRepository';

export type ActionSaveInput = Omit<
  ActionDefinitionInput,
  'createdBy' | 'updatedBy' | 'updatedByName' | 'updatedByPhotoURL'
>;

export interface ActionStoreState {
  actions: ActionDefinition[];
  isLoading: boolean;
  getAction: (actionId: string) => ActionDefinition | undefined;
  /** Actions habilitadas para os ids informados, na ordem configurada. */
  getActionsByIds: (actionIds: string[]) => ActionDefinition[];
  createAction: (data: ActionSaveInput) => Promise<ActionDefinition>;
  updateAction: (actionId: string, data: Partial<ActionSaveInput>) => Promise<void>;
  deleteAction: (actionId: string) => Promise<void>;
  runAction: (input: Omit<RunActionInput, 'tenantId'>) => Promise<RunActionResult>;
  refresh: () => Promise<void>;
}

export const ActionContext = createContext<ActionStoreState | null>(null);

export const useActions = (): ActionStoreState => {
  const ctx = useContext(ActionContext);
  if (!ctx) throw new Error('useActions must be used within ActionStoreProvider');
  return ctx;
};
