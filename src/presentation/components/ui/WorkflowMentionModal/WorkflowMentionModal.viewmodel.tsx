import { useState, useMemo, useCallback } from 'react';
import { useWorkflowStore } from '../../../../stores/useWorkflowStore';
import { WORKFLOW_EVENT_CATALOG, resolveEventCatalogLabel } from '../../../../domain/services/workflowEventCatalog';
import type { WorkflowDefinition } from '../../../../domain/entities/Workflow';
import { useLabel } from '../../../shared/i18n/useT';

export interface WorkflowMentionModalProps {
  onSelect: (workflow: WorkflowDefinition) => void;
  onClose: () => void;
}

export interface WorkflowMentionModalViewModel {
  items: WorkflowDefinition[];
  keyword: string;
  setKeyword: (v: string) => void;
  handleSelect: (workflow: WorkflowDefinition) => void;
  nameOf: (workflow: WorkflowDefinition) => string;
  getEventLabel: (eventName: string) => string;
}

export const useWorkflowMentionModalViewModel = (
  props: WorkflowMentionModalProps,
): WorkflowMentionModalViewModel => {
  const { workflows } = useWorkflowStore();
  const label = useLabel();
  const [keyword, setKeyword] = useState('');

  const nameOf = useCallback((w: WorkflowDefinition) => label(w.name), [label]);

  const items = useMemo(() => {
    const q = keyword.toLowerCase();
    if (!q) return workflows;
    return workflows.filter(
      (w) =>
        nameOf(w).toLowerCase().includes(q) ||
        w.eventName.toLowerCase().includes(q),
    );
  }, [workflows, keyword, nameOf]);

  const handleSelect = useCallback(
    (w: WorkflowDefinition) => { props.onSelect(w); },
    [props],
  );

  const getEventLabel = useCallback(
    (eventName: string) => {
      const entry = WORKFLOW_EVENT_CATALOG.find((e) => e.name === eventName);
      return entry ? resolveEventCatalogLabel(label, entry) : eventName;
    },
    [label],
  );

  return { items, keyword, setKeyword, handleSelect, nameOf, getEventLabel };
};
