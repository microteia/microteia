import type { IGmailConnectionRepository } from '../repositories/IGmailConnectionRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import { notFound, permissionDenied } from '../errors/DomainError';

/**
 * Revogar é apagar a conexão e o token dela. A conferência de DONO é aqui, e não só a de papel:
 * o id de uma conexão é um palpite curto, e ser administrador de um escritório não pode dar acesso
 * à caixa de e-mail de outro.
 */
export type RevokeGmailConnectionUseCase = {
  execute: (tenantId: string, userId: string, connectionId: string) => Promise<void>;
};

export const makeRevokeGmailConnectionUseCase = (
  gmailConnectionRepo: IGmailConnectionRepository,
  tenantMemberRepo: ITenantMemberRepository,
): RevokeGmailConnectionUseCase => ({
  execute: async (tenantId: string, userId: string, connectionId: string) => {
    const role = await tenantMemberRepo.getMemberRole(tenantId, userId);

    if (role !== 'admin') {
      throw permissionDenied('Apenas administradores podem revogar contas Gmail.');
    }

    const connections = await gmailConnectionRepo.getConnectionsByTenant(tenantId);

    if (!connections.some((connection) => connection.id === connectionId)) {
      throw notFound('Conexão não encontrada neste escritório.');
    }

    await gmailConnectionRepo.deleteConnection(connectionId);
  },
});
