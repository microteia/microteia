import type { PortalActionRunner } from '../../domain/usecases/PortalActionUseCases';
import { getDI } from '../di/container';
import { identifyPortalActor } from './identifyPortalActor';

/**
 * Roda o fluxo de uma ação do portal pelo MESMO motor do `runAction` do escritório — o "Chamar Workflow"
 * com "Aguardar retorno" —, com o convidado como ator: `via: 'portal'`, permissão nenhuma, e a identidade
 * que ele provou ao entrar. O que o fluxo gravar sai em nome dele; `hasPermission(...)` responde não.
 */
export const portalActionRunner: PortalActionRunner = async ({ tenantId, userId, workflowId, params }) => {
  const di = getDI();
  await di.ensureWorkflowStepsRegistered();
  const result = await di.getRunCalledWorkflowUseCase().execute({
    tenantId,
    targetWorkflowId: workflowId,
    params,
    actor: await identifyPortalActor(tenantId, userId),
    callDepth: 1,
  });
  if (!result.found || result.status !== 'SUCCESS') return { ok: false };
  return { ok: true, outputs: (result.outputs ?? {}) as Record<string, unknown> };
};
