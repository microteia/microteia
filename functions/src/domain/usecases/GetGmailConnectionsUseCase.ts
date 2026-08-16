import type { IGmailConnectionRepository } from '../repositories/IGmailConnectionRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { GmailConnection } from '../entities/GmailConnection';
import { permissionDenied } from '../errors/DomainError';

/**
 * As contas autorizadas de um escritório. Passou a ser leitura de servidor quando as conexões
 * saíram do alcance do navegador: quem pergunta é a tela da extensão, e quem confere o papel é
 * este caso de uso — não mais a regra do Firestore.
 */
export type GetGmailConnectionsUseCase = {
  execute: (tenantId: string, userId: string) => Promise<GmailConnection[]>;
};

export const makeGetGmailConnectionsUseCase = (
  gmailConnectionRepo: IGmailConnectionRepository,
  tenantMemberRepo: ITenantMemberRepository,
): GetGmailConnectionsUseCase => ({
  execute: async (tenantId: string, userId: string) => {
    const role = await tenantMemberRepo.getMemberRole(tenantId, userId);

    if (role !== 'admin') {
      throw permissionDenied('@core.workspace/gmail.admin-only');
    }

    return gmailConnectionRepo.getConnectionsByTenant(tenantId);
  },
});
