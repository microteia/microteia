import { useState, useMemo, useCallback } from 'react';
import { useActions } from '../../../stores/useActions';
import { useAuthorization } from '../../../stores/useAuthorization';
import { PERMISSION_AUTOMATION_MANAGE } from '../../../domain/schema/access';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import type { ActionDefinition } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import { useT } from '../../shared/i18n/useT';

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
  const t = useT('core.automation');
  const { actions, isLoading, deleteAction } = useActions();
  const { can } = useAuthorization();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [actionToDelete, setActionToDelete] = useState<ActionDefinition | null>(null);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: t('core.ui/filter.search'), type: 'text', placeholder: t('actions.filter.search.placeholder') },
  ], [t]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => { map[token.key] = token.values; });
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
      notify(t('action.deleted'), 'success');
    } catch {
      notify(t('action.delete-failed'), 'error');
    } finally {
      setActionToDelete(null);
    }
  }, [actionToDelete, deleteAction, notify, t]);

  return {
    isAdmin: can(PERMISSION_AUTOMATION_MANAGE),
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
