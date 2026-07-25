import { useCallback, useMemo } from 'react';
import { fieldOptionsKey, useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import {
  buildCloneTabKey,
  buildNewTabKey,
  buildViewTabKey,
} from '../../../shared/constants/dynamicScreenKeys';
import type { CustomRecord, FieldDefinition, ScreenDefinition } from '../../../domain/entities';

/**
 * Uma opção de campo (lookup) já achatada para a extensão: chave, rótulo e cor opcional, unindo as
 * opções estáticas do schema com as que o usuário adicionou (armazenadas na coleção de opções).
 */
export interface EntityFieldOption {
  key: string;
  label: string;
  color?: string;
}

/**
 * Acesso GENÉRICO a uma entidade dinâmica (tela criada por extensão/Form Design), resolvido pelo
 * `sourceId` universal — não pela chave instalada, que é namespaced e pode variar por deduplicação.
 * Devolve o schema vivo (campos, opções coloridas, máscaras), os registros da coleção genérica
 * `customRecords` filtrados pela tela, e a navegação para o detalhe/criação NATIVOS. É o que permite
 * uma view de código ler/gravar os PRÓPRIOS dados sem tocar nenhum repositório específico do app.
 */
export interface ExtensionEntity {
  screen: ScreenDefinition | null;
  screenKey: string | null;
  fields: FieldDefinition[];
  records: CustomRecord[];
  isLoading: boolean;
  optionsFor: (fieldKey: string) => EntityFieldOption[];
  openRecord: (recordId: string) => void;
  newRecord: () => void;
  cloneRecord: (recordId: string) => void;
  deleteRecord: (recordId: string) => Promise<void>;
}

export const useEntity = (sourceId: string): ExtensionEntity => {
  const { dynamicScreens, fieldOptionsByField } = useScreenDefinitions();
  const { recordsByScreen, isLoading, deleteRecord } = useCustomRecords();
  const { openTab } = useWorkspace();

  const screen = useMemo(
    () => dynamicScreens.find((definition) => (definition.sourceId ?? definition.id) === sourceId) ?? null,
    [dynamicScreens, sourceId],
  );
  const screenKey = screen?.id ?? null;

  const fields = useMemo(() => screen?.fields ?? [], [screen]);

  const records = useMemo(
    () => (screenKey ? recordsByScreen[screenKey] ?? [] : []),
    [recordsByScreen, screenKey],
  );

  const optionsFor = useCallback(
    (fieldKey: string): EntityFieldOption[] => {
      if (!screen) return [];
      const field = screen.fields.find((candidate) => candidate.key === fieldKey);
      const staticOptions: EntityFieldOption[] = (field?.options ?? []).map((option) => ({
        key: option.key,
        label: option.label,
        color: option.color,
      }));
      const userAdded = fieldOptionsByField[fieldOptionsKey(screen.id, fieldKey)] ?? [];
      const extra: EntityFieldOption[] = userAdded
        .filter((option) => !staticOptions.some((existing) => existing.key === option.key))
        .map((option) => ({ key: option.key, label: option.label }));
      return [...staticOptions, ...extra];
    },
    [screen, fieldOptionsByField],
  );

  const openRecord = useCallback(
    (recordId: string) => {
      if (screenKey) openTab(buildViewTabKey(screenKey, recordId));
    },
    [openTab, screenKey],
  );

  const newRecord = useCallback(() => {
    if (screenKey) openTab(buildNewTabKey(screenKey));
  }, [openTab, screenKey]);

  const cloneRecord = useCallback(
    (recordId: string) => {
      if (screenKey) openTab(buildCloneTabKey(screenKey, recordId));
    },
    [openTab, screenKey],
  );

  const removeRecord = useCallback(
    async (recordId: string) => {
      if (screenKey) await deleteRecord(recordId, screenKey);
    },
    [deleteRecord, screenKey],
  );

  return {
    screen,
    screenKey,
    fields,
    records,
    isLoading,
    optionsFor,
    openRecord,
    newRecord,
    cloneRecord,
    deleteRecord: removeRecord,
  };
};
