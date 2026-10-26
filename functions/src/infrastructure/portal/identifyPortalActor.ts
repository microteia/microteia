import type { WorkflowActor } from '../../domain/entities/WorkflowContext';
import { identifyActor } from '../workflow/identifyActor';
import { getDI } from '../di/container';

/**
 * O convidado como ator: `via: 'portal'`, permissão NENHUMA e — quando ele entrou por um provedor do
 * escritório — a identidade que provou. É ela que a gravação carimba em `portalVerified` e que as
 * expressões leem em `actor.verified`; lida do convite dele, que o login acabou de gravar.
 */
export const identifyPortalActor = async (tenantId: string, userId: string): Promise<WorkflowActor> => {
  const [actor, guest] = await Promise.all([
    identifyActor(userId, 'portal', []),
    getDI().getPortalRepository().getPortalUser(tenantId, userId),
  ]);
  return guest?.identity ? { ...actor, verified: guest.identity } : actor;
};
