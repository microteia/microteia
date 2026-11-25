import { useCallback } from 'react';
import type { ActionDefinition } from '../../../domain/entities/Action';
import { workflowRunPermissions } from '../../../domain/schema/access';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';

/**
 * A permissão que falta para executar a AÇÃO, ou `null` quando nada falta (#33).
 *
 * A ação não tem porta própria: ela leva a um fluxo, e quem não pode executar o fluxo pela lista também
 * não o executa pelo botão. É a MESMA lista que `runAction` cobra no servidor — um botão que sempre
 * falharia é pior que botão nenhum. O comando de tela (`copyLink`, `delete`…) não é fluxo: quem decide
 * é a permissão da coleção, na superfície que o desenha.
 */
export const useActionRunGate = (): ((action: ActionDefinition) => string | null) => {
  const { workflows } = useWorkflowStore();
  const { can } = useAuthorization();
  return useCallback((action: ActionDefinition) => {
    if (action.command) return null;
    const workflow = workflows.find((candidate) => candidate.id === action.workflowId);
    if (!workflow) return null;
    return workflowRunPermissions(workflow).find((permission) => !can(permission)) ?? null;
  }, [workflows, can]);
};
