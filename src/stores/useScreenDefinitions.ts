import { createContext, useContext } from 'react';
import type { CustomRecordTag, FieldDefinition, ScreenDefinition, ScreenFieldOption } from '../domain/entities';
import type { ScreenDefinitionInput } from '../domain/repositories/IScreenDefinitionRepository';

export type ScreenDefinitionSaveInput = Omit<ScreenDefinitionInput, 'createdBy' | 'updatedBy' | 'updatedByName' | 'updatedByPhotoURL'>;

export interface ScreenDefinitionStoreState {
  definitions: ScreenDefinition[];
  dynamicScreens: ScreenDefinition[];
  getDefinition: (screenKey: string) => ScreenDefinition | undefined;
  getCustomFieldsFor: (entityKey: string) => FieldDefinition[];
  fieldOptionsByField: Record<string, ScreenFieldOption[]>;
  tagsByScreen: Record<string, CustomRecordTag[]>;
  isLoading: boolean;
  saveDefinition: (screenKey: string, data: ScreenDefinitionSaveInput) => Promise<ScreenDefinition>;
  deleteDefinition: (screenKey: string) => Promise<void>;
  addFieldOption: (screenKey: string, fieldKey: string, label: string) => Promise<void>;
  removeFieldOption: (screenKey: string, fieldKey: string, optionKey: string) => Promise<void>;
  createTag: (screenKey: string, name: string, color: string) => Promise<CustomRecordTag>;
  updateTag: (screenKey: string, tagId: string, data: { name: string; color: string }) => Promise<void>;
  deleteTag: (screenKey: string, tagId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const fieldOptionsKey = (screenKey: string, fieldKey: string): string => `${screenKey}:${fieldKey}`;

export const ScreenDefinitionContext = createContext<ScreenDefinitionStoreState | null>(null);

export const useScreenDefinitions = (): ScreenDefinitionStoreState => {
  const ctx = useContext(ScreenDefinitionContext);
  if (!ctx) throw new Error('useScreenDefinitions must be used within ScreenDefinitionStoreProvider');
  return ctx;
};
