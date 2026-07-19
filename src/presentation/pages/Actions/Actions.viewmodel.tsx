import { useState, useMemo, useCallback } from 'react';
import { useActions } from '../../../stores/useActions';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import type { ActionDefinition } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface ActionsViewModel {
  isAdmin: boolean;
  filteredActions: ActionDefinition[];
  isLoading: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  actionToDelete: ActionDefinition | null;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewAction: () => void;
  openAction: (action: ActionDefinition) => void;
  handleDelete: (action: ActionDefinition) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const useActionsViewModel = (): ActionsViewModel => {
  const { actions, isLoading, deleteAction } = useActions();
  const { tenantRole } = useTenant();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [actionToDelete, setActionToDelete] = useState<ActionDefinition | null>(null);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Título ou identificador...' },
  ], []);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredActions = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    return [...actions]
      .filter((action) => !searchQ
        || action.title.toLowerCase().includes(searchQ)
        || action.key.toLowerCase().includes(searchQ))
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }, [actions, tokenMap]);

  const openNewAction = useCallback(() => openTab('new-action'), [openTab]);
  const openAction = useCallback((action: ActionDefinition) => openTab(`view-action:${action.id}`), [openTab]);

  const handleDelete = useCallback((action: ActionDefinition) => setActionToDelete(action), []);
  const cancelDelete = useCallback(() => setActionToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!actionToDelete) return;
    try {
      await deleteAction(actionToDelete.id);
      notify('Ação excluída.', 'success');
    } catch {
      notify('Erro ao excluir a ação.', 'error');
    } finally {
      setActionToDelete(null);
    }
  }, [actionToDelete, deleteAction, notify]);

  return {
    isAdmin: tenantRole === 'admin',
    filteredActions,
    isLoading,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'actions',
    actionToDelete,
    setFilterTokens,
    openNewAction,
    openAction,
    handleDelete,
    confirmDelete,
    cancelDelete,
  };
};
