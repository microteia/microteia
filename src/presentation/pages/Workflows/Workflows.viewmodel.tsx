import { useState, useMemo, useCallback } from 'react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import type { WorkflowDefinition, PublicWorkflow } from '../../../domain/entities/Workflow';
import type { FilterDef, FilterToken, FilterOption } from '../../components/ui/CompositeFilter';

export interface WorkflowsViewModel {
  filteredWorkflows: (WorkflowDefinition | PublicWorkflow)[];
  isLoading: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  workflowToDelete: WorkflowDefinition | null;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewWorkflow: () => void;
  openWorkflow: (w: WorkflowDefinition | PublicWorkflow) => void;
  toggleEnabled: (w: WorkflowDefinition | PublicWorkflow) => void;
  handleDelete: (w: WorkflowDefinition | PublicWorkflow) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  copyPublicWorkflow: (w: WorkflowDefinition | PublicWorkflow) => Promise<void>;
  isOwnWorkflow: (w: WorkflowDefinition | PublicWorkflow) => boolean;
  isCopiedWorkflow: (w: WorkflowDefinition | PublicWorkflow) => boolean;
  isOutdatedCopy: (w: WorkflowDefinition | PublicWorkflow) => boolean;
}

export const useWorkflowsViewModel = (): WorkflowsViewModel => {
  const { workflows, publicWorkflows, isLoading, updateWorkflow, deleteWorkflow, copyPublicWorkflow: copyWorkflow } = useWorkflowStore();
  const { currentTenant } = useTenant();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([{ key: 'ownership', values: ['own'] }]);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowDefinition | null>(null);

  const allWorkflows = useMemo(() => {
    if (!currentTenant) return [];
    const ownWorkflowIds = new Set(workflows.map((w) => w.id));
    const publicNotOwn = publicWorkflows.filter((w) => w.originalTenantId !== currentTenant.id && !ownWorkflowIds.has(w.id));
    return [...workflows, ...publicNotOwn];
  }, [workflows, publicWorkflows, currentTenant]);

  const eventOptions = useMemo<FilterOption[]>(() => {
    const uniqueEvents = Array.from(new Set(allWorkflows.map((w) => w.eventName)));
    return uniqueEvents.map((eventName) => ({ value: eventName, label: eventName }));
  }, [allWorkflows]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Nome da automação...' },
    { key: 'eventName', label: 'Evento', type: 'select', options: eventOptions },
    {
      key: 'enabled', label: 'Status', type: 'select', options: [
        { value: 'true', label: 'Habilitado' },
        { value: 'false', label: 'Desabilitado' },
      ],
    },
    {
      key: 'ownership', label: 'Tipo', type: 'select', options: [
        { value: 'own', label: 'Meus Workflows' },
        { value: 'public', label: 'Públicos' },
      ],
    },
  ], [eventOptions]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const isOwnWorkflow = useCallback((w: WorkflowDefinition | PublicWorkflow) => {
    if ('originalTenantId' in w) {
      return w.originalTenantId === currentTenant?.id;
    }
    return w.tenantId === currentTenant?.id;
  }, [currentTenant]);

  const isPublicWorkflow = useCallback((w: WorkflowDefinition | PublicWorkflow) => {
    if ('originalTenantId' in w) return true;
    return !!w.isPublic;
  }, []);

  const filteredWorkflows = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const eventFilter = tokenMap['eventName'] ?? [];
    const enabledFilter = tokenMap['enabled'] ?? [];
    const ownershipFilter = tokenMap['ownership'] ?? [];

    return [...allWorkflows]
      .filter((w) => {
        if (searchQ && !w.name.toLowerCase().includes(searchQ)) return false;
        if (eventFilter.length > 0 && !eventFilter.includes(w.eventName)) return false;
        if (enabledFilter.length > 0 && !enabledFilter.includes(String(w.enabled))) return false;
        if (ownershipFilter.length > 0) {
          const matches = ownershipFilter.some((v) => {
            if (v === 'own') return isOwnWorkflow(w);
            if (v === 'public') return isPublicWorkflow(w);
            return false;
          });
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allWorkflows, tokenMap, isOwnWorkflow, isPublicWorkflow]);

  const openNewWorkflow = useCallback(() => openTab('new-workflow'), [openTab]);
  const openWorkflow = useCallback((w: WorkflowDefinition | PublicWorkflow) => {
    if (isOwnWorkflow(w)) {
      openTab(`view-workflow:${w.id}`);
    }
  }, [openTab, isOwnWorkflow]);

  const toggleEnabled = useCallback((w: WorkflowDefinition | PublicWorkflow) => {
    if (!isOwnWorkflow(w)) return;
    if (!('tenantId' in w)) return;
    void updateWorkflow(w.id, { enabled: !w.enabled }).catch(() => notify('Erro ao atualizar automação.', 'error'));
  }, [updateWorkflow, notify, isOwnWorkflow]);

  const handleDelete = useCallback((w: WorkflowDefinition | PublicWorkflow) => {
    if (isOwnWorkflow(w) && 'tenantId' in w) {
      setWorkflowToDelete(w);
    }
  }, [isOwnWorkflow]);

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

  const copyPublicWorkflow = useCallback(async (w: WorkflowDefinition | PublicWorkflow) => {
    if (isOwnWorkflow(w)) return;
    try {
      const publicWorkflowId = 'originalWorkflowId' in w ? w.originalWorkflowId : w.id;
      const result = await copyWorkflow(publicWorkflowId);
      notify(`Workflow copiado com sucesso! ${result.copiedScripts} script(s) e ${result.copiedSubWorkflows} sub-workflow(s) também foram copiados.`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao copiar workflow.';
      notify(message, 'error');
    }
  }, [copyWorkflow, notify, isOwnWorkflow]);

  const isCopiedWorkflow = useCallback((w: WorkflowDefinition | PublicWorkflow) => {
    if ('originalTenantId' in w) return false;
    return !!(w as WorkflowDefinition).sourceWorkflowId;
  }, []);

  const isOutdatedCopy = useCallback((w: WorkflowDefinition | PublicWorkflow) => {
    if ('originalTenantId' in w) return false;
    const workflow = w as WorkflowDefinition;
    if (!workflow.sourceWorkflowId || !workflow.sourceVersion) return false;
    const sourceWorkflow = publicWorkflows.find((pw) => pw.id === workflow.sourceWorkflowId);
    if (!sourceWorkflow) return false;
    return workflow.sourceVersion !== sourceWorkflow.version;
  }, [publicWorkflows]);

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
    copyPublicWorkflow,
    isOwnWorkflow,
    isCopiedWorkflow,
    isOutdatedCopy,
  };
};
