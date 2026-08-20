import { useState, useMemo, useCallback } from 'react';
import { useScriptStore } from '../../../stores/useScriptStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import type { Script } from '../../../domain/entities/Script';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

import { useT } from '../../shared/i18n/useT';
export interface ScriptsViewModel {
  filteredScripts: Script[];
  isLoading: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  scriptToDelete: Script | null;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewScript: () => void;
  openScript: (s: Script) => void;
  handleDelete: (s: Script) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const useScriptsViewModel = (): ScriptsViewModel => {
  const t = useT('core.automation');
  const { scripts, isLoading, deleteScript } = useScriptStore();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);

  const filterDefs = useMemo<FilterDef[]>(() => [
    {
      key: 'search',
      label: t('core.ui/filter.search'),
      type: 'text',
      placeholder: t('scripts.filter.search.placeholder'),
    },
  ], [t]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => { map[token.key] = token.values; });
    return map;
  }, [filterTokens]);

  const filteredScripts = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    return [...scripts]
      .filter((s) => !searchQ || s.name.toLowerCase().includes(searchQ))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [scripts, tokenMap]);

  const openNewScript = useCallback(() => openTab('new-script'), [openTab]);
  const openScript = useCallback((s: Script) => openTab(`view-script:${s.id}`), [openTab]);

  const handleDelete = useCallback((s: Script) => setScriptToDelete(s), []);
  const cancelDelete = useCallback(() => setScriptToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!scriptToDelete) return;
    try {
      await deleteScript(scriptToDelete.id);
      notify(t('script.deleted'), 'success');
    } catch {
      notify(t('script.delete-failed'), 'error');
    } finally {
      setScriptToDelete(null);
    }
  }, [scriptToDelete, deleteScript, notify, t]);

  return {
    filteredScripts,
    isLoading,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'scripts',
    scriptToDelete,
    setFilterTokens,
    openNewScript,
    openScript,
    handleDelete,
    confirmDelete,
    cancelDelete,
  };
};
