import { useState, useMemo, useCallback } from 'react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import type { WorkflowDefinition } from '../../../domain/entities/Workflow';
import type { FilterDef, FilterToken, FilterOption } from '../../components/ui/CompositeFilter';

import { useT, useLabel } from '../../shared/i18n/useT';

export interface WorkflowsViewModel {
  filteredWorkflows: WorkflowDefinition[];
  nameOf: (workflow: WorkflowDefinition | null) => string;
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
  const t = useT('core.automation');
  const label = useLabel();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowDefinition | null>(null);

  const eventOptions = useMemo<FilterOption[]>(() => {
    const uniqueEvents = Array.from(new Set(workflows.map((w) => w.eventName)));
    return uniqueEvents.map((eventName) => ({ value: eventName, label: eventName }));
  }, [workflows]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: t('core.ui/filter.search'), type: 'text', placeholder: t('workflow.filter.name') },
    { key: 'eventName', label: t('workflow.event.short'), type: 'select', options: eventOptions },
    {
      key: 'enabled', label: t('core.ui/filter.status'), type: 'select', options: [
        { value: 'true', label: t('workflow.active') },
        { value: 'false', label: t('workflow.inactive') },
      ],
    },
  ], [eventOptions, t]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => { map[token.key] = token.values; });
    return map;
  }, [filterTokens]);

  const nameOf = useCallback(
    (workflow: WorkflowDefinition | null) => label(workflow?.name),
    [label],
  );

  const filteredWorkflows = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const eventFilter = tokenMap['eventName'] ?? [];
    const enabledFilter = tokenMap['enabled'] ?? [];

    return [...workflows]
      .filter((w) => {
        if (searchQ && !nameOf(w).toLowerCase().includes(searchQ)) return false;
        if (eventFilter.length > 0 && !eventFilter.includes(w.eventName)) return false;
        if (enabledFilter.length > 0 && !enabledFilter.includes(String(w.enabled))) return false;
        return true;
      })
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }, [workflows, tokenMap, nameOf]);

  const openNewWorkflow = useCallback(() => openTab('new-workflow'), [openTab]);
  const openWorkflow = useCallback((w: WorkflowDefinition) => {
    openTab(`view-workflow:${w.id}`);
  }, [openTab]);

  const toggleEnabled = useCallback((w: WorkflowDefinition) => {
    void updateWorkflow(w.id, { enabled: !w.enabled }).catch(() => notify(t('workflow.update-failed'), 'error'));
  }, [updateWorkflow, notify, t]);

  const handleDelete = useCallback((w: WorkflowDefinition) => {
    setWorkflowToDelete(w);
  }, []);

  const cancelDelete = useCallback(() => setWorkflowToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!workflowToDelete) return;
    try {
      await deleteWorkflow(workflowToDelete.id);
      notify(t('workflow.deleted'), 'success');
    } catch {
      notify(t('workflow.delete-failed'), 'error');
    } finally {
      setWorkflowToDelete(null);
    }
  }, [workflowToDelete, deleteWorkflow, notify, t]);

  return {
    filteredWorkflows,
    nameOf,
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
