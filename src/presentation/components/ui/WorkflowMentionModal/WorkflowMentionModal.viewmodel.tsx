import { useState, useMemo, useCallback } from 'react';
import { useWorkflowStore } from '../../../../stores/useWorkflowStore';
import { WORKFLOW_EVENT_CATALOG } from '../../../../domain/services/workflowEventCatalog';
import type { WorkflowDefinition } from '../../../../domain/entities/Workflow';

export interface WorkflowMentionModalProps {
  onSelect: (workflow: WorkflowDefinition) => void;
  onClose: () => void;
}

export interface WorkflowMentionModalViewModel {
  items: WorkflowDefinition[];
  keyword: string;
  setKeyword: (v: string) => void;
  handleSelect: (workflow: WorkflowDefinition) => void;
  getEventLabel: (eventName: string) => string;
}

export const useWorkflowMentionModalViewModel = (
  props: WorkflowMentionModalProps,
): WorkflowMentionModalViewModel => {
  const { workflows } = useWorkflowStore();
  const [keyword, setKeyword] = useState('');

  const items = useMemo(() => {
    const q = keyword.toLowerCase();
    if (!q) return workflows;
    return workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.eventName.toLowerCase().includes(q),
    );
  }, [workflows, keyword]);

  const handleSelect = useCallback(
    (w: WorkflowDefinition) => { props.onSelect(w); },
    [props],
  );

  const getEventLabel = useCallback(
    (eventName: string) => WORKFLOW_EVENT_CATALOG.find((e) => e.name === eventName)?.label ?? eventName,
    [],
  );

  return { items, keyword, setKeyword, handleSelect, getEventLabel };
};
