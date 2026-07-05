import { useState, useMemo, useCallback } from 'react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import type { WorkflowDefinition } from '../../../domain/entities/Workflow';
import type { FilterDef, FilterToken, FilterOption } from '../../components/ui/CompositeFilter';

export interface WorkflowsViewModel {
  filteredWorkflows: WorkflowDefinition[];
  isLoading: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  workflowToDelete: WorkflowDefinition | null;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewWorkflow: () => void;
  openWorkflow: (w: WorkflowDefinition) => void;
  toggleEnabled: (w: WorkflowDefinition) => void;
  handleDelete: (w: WorkflowDefinition) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const useWorkflowsViewModel = (): WorkflowsViewModel => {
  const { workflows, isLoading, updateWorkflow, deleteWorkflow } = useWorkflowStore();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowDefinition | null>(null);

  const eventOptions = useMemo<FilterOption[]>(() => {
    const uniqueEvents = Array.from(new Set(workflows.map((w) => w.eventName)));
    return uniqueEvents.map((eventName) => ({ value: eventName, label: eventName }));
  }, [workflows]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Nome da automação...' },
    { key: 'eventName', label: 'Evento', type: 'select', options: eventOptions },
    {
      key: 'enabled', label: 'Status', type: 'select', options: [
        { value: 'true', label: 'Habilitado' },
        { value: 'false', label: 'Desabilitado' },
      ],
    },
  ], [eventOptions]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredWorkflows = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const eventFilter = tokenMap['eventName'] ?? [];
    const enabledFilter = tokenMap['enabled'] ?? [];

    return [...workflows]
      .filter((w) => {
        if (searchQ && !w.name.toLowerCase().includes(searchQ)) return false;
        if (eventFilter.length > 0 && !eventFilter.includes(w.eventName)) return false;
        if (enabledFilter.length > 0 && !enabledFilter.includes(String(w.enabled))) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workflows, tokenMap]);

  const openNewWorkflow = useCallback(() => openTab('new-workflow'), [openTab]);
  const openWorkflow = useCallback((w: WorkflowDefinition) => openTab(`view-workflow:${w.id}`), [openTab]);

  const toggleEnabled = useCallback((w: WorkflowDefinition) => {
    void updateWorkflow(w.id, { enabled: !w.enabled }).catch(() => notify('Erro ao atualizar automação.', 'error'));
  }, [updateWorkflow, notify]);

  const handleDelete = useCallback((w: WorkflowDefinition) => setWorkflowToDelete(w), []);
  const cancelDelete = useCallback(() => setWorkflowToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!workflowToDelete) return;
    try {
      await deleteWorkflow(workflowToDelete.id);
      notify('Automação excluída.', 'success');
    } catch {
      notify('Erro ao excluir automação.', 'error');
    } finally {
      setWorkflowToDelete(null);
    }
  }, [workflowToDelete, deleteWorkflow, notify]);

  return {
    filteredWorkflows,
    isLoading,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'workflows',
    workflowToDelete,
    setFilterTokens,
    openNewWorkflow,
    openWorkflow,
    toggleEnabled,
    handleDelete,
    confirmDelete,
    cancelDelete,
  };
};
