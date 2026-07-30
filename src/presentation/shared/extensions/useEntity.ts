import { useCallback, useMemo } from 'react';
import { useLookups } from '../../../stores/useLookups';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecords } from '../../../stores/useRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import {
  buildCloneTabKey,
  buildNewTabKey,
  buildViewTabKey,
} from '../../../shared/constants/dynamicScreenKeys';
import type { EntityRecord, FieldDefinition, ScreenDefinition } from '../../../domain/entities';

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
 * `sourceId` universal — não pela chave instalada, que pode variar por dedup ou desambiguação.
 * Devolve o schema vivo (campos, opções coloridas, máscaras), os registros da COLEÇÃO da tela — com
 * os campos na raiz de cada registro — e a navegação para o detalhe/criação NATIVOS. É o que permite
 * uma view de código ler/gravar os PRÓPRIOS dados sem tocar nenhum repositório específico do app.
 */
export interface ExtensionEntity {
  screen: ScreenDefinition | null;
  screenKey: string | null;
  fields: FieldDefinition[];
  records: EntityRecord[];
  isLoading: boolean;
  optionsFor: (fieldKey: string) => EntityFieldOption[];
  openRecord: (recordId: string) => void;
  newRecord: () => void;
  cloneRecord: (recordId: string) => void;
  deleteRecord: (recordId: string) => Promise<void>;
}

export const useEntity = (sourceId: string): ExtensionEntity => {
  const { dynamicScreens } = useScreenDefinitions();
  const { getOptions } = useLookups();
  const { recordsByCollection, isLoading, deleteRecord } = useRecords();
  const { openTab } = useWorkspace();

  const screen = useMemo(
    () => dynamicScreens.find((definition) => (definition.sourceId ?? definition.id) === sourceId) ?? null,
    [dynamicScreens, sourceId],
  );
  const screenKey = screen?.id ?? null;

  const fields = useMemo(() => screen?.fields ?? [], [screen]);

  const records = useMemo(
    () => (screenKey ? recordsByCollection[screenKey] ?? [] : []),
    [recordsByCollection, screenKey],
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
      const extra: EntityFieldOption[] = getOptions(field?.lookupCollection ?? '')
        .filter((option) => !staticOptions.some((existing) => existing.key === option.label))
        .map((option) => ({ key: option.label, label: option.label, color: option.color }));
      return [...staticOptions, ...extra];
    },
    [screen, getOptions],
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
