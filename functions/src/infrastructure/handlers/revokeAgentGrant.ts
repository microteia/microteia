import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { PERMISSION_AGENT_MANAGE } from '../../domain/schema/access/kernelPermissions';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';

const REGION = 'southamerica-east1';

interface RevokeAgentGrantRequest {
  tenantId: string;
  grantId: string;
}

/**
 * Revoga um acesso de agente.
 *
 * O dono revoga o seu sem permissão nenhuma — é o acesso dele, e tirá-lo não afeta mais ninguém.
 * Revogar o de OUTRO exige `agent.manage`, porque aí é uma decisão sobre o trabalho de terceiro.
 *
 * Idempotente: revogar o que já estava revogado devolve `revoked: false` em vez de falhar. Quem
 * clica duas vezes, ou dois administradores ao mesmo tempo, não têm nada a corrigir.
 */
export const revokeAgentGrant = onCall(
  { region: REGION, cors: true },
  async (request): Promise<{ revoked: boolean }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, grantId } = request.data as RevokeAgentGrantRequest;
    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    if (!grantId) throw new HttpsError('invalid-argument', '@core.access/agent.grant.required');

    const userId = request.auth.uid;
    const repository = getDI().getAgentGrantRepository();

    const grant = await repository.getById(tenantId, grantId);
    // Um acesso que não existe responde como falta de permissão, e não como "não encontrado": dizer
    // qual é qual permitiria descobrir quais ids existem naquele escritório.
    if (grant === null) {
      await requirePermission(tenantId, request.auth, PERMISSION_AGENT_MANAGE);
      return { revoked: false };
    }

    if (grant.userId !== userId) {
      await requirePermission(tenantId, request.auth, PERMISSION_AGENT_MANAGE);
    }

    return { revoked: await repository.revoke(tenantId, grantId, userId) };
  },
);
