import { createContext, useContext } from 'react';
import type { FieldDefinition, ScreenDefinition } from '../domain/entities';
import type { ScreenDefinitionInput } from '../domain/repositories/IScreenDefinitionRepository';

export type ScreenDefinitionSaveInput = Omit<ScreenDefinitionInput, 'createdBy' | 'updatedBy' | 'updatedByName' | 'updatedByPhotoURL'>;

export interface ScreenDefinitionStoreState {
  definitions: ScreenDefinition[];
  dynamicScreens: ScreenDefinition[];
  /** `dynamicScreens` sem as telas filhas — para menu lateral e busca ⌘K. */
  sidebarScreens: ScreenDefinition[];
  getDefinition: (screenKey: string) => ScreenDefinition | undefined;
  /** Campos que a tela do tenant declara para a coleção (sem os fixos do código). */
  getScreenFieldsFor: (collection: string) => FieldDefinition[];
  isLoading: boolean;
  saveDefinition: (screenKey: string, data: ScreenDefinitionSaveInput) => Promise<ScreenDefinition>;
  deleteDefinition: (screenKey: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const ScreenDefinitionContext = createContext<ScreenDefinitionStoreState | null>(null);

export const useScreenDefinitions = (): ScreenDefinitionStoreState => {
  const ctx = useContext(ScreenDefinitionContext);
  if (!ctx) throw new Error('useScreenDefinitions must be used within ScreenDefinitionStoreProvider');
  return ctx;
};
