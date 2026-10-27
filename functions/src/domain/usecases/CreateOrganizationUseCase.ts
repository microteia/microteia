import type { IUserRepository } from '../repositories/IUserRepository';
import type { ITenantRepository } from '../repositories/ITenantRepository';
import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import { openOwnedTenant } from './BootstrapUserUseCase';
import { failedPrecondition, invalidArgument, notFound } from '../errors/DomainError';

export const ORGANIZATION_NAME_MAX = 120;

export interface CreateOrganizationInput {
  name: unknown;
  ownerEmail: unknown;
  actor: { userId: string; userName: string; photoURL: string };
}

export type CreateOrganizationUseCase = {
  execute: (input: CreateOrganizationInput) => Promise<{ tenantId: string }>;
};

/**
 * O escritório aberto pelo administrador GLOBAL em nome de alguém — o caminho que sobra quando a
 * instalação desliga o autocadastro (`SELF_SERVICE_TENANTS=false`). Sem ele, desligar o autocadastro
 * congelaria a instalação no número de escritórios que ela tinha.
 *
 * O dono precisa ter conta: é a conta que recebe o curinga, e é ela quem forma o primeiro perfil. O
 * convidado do PORTAL é recusado — ele é de fora por definição, e virar dono de um escritório não pode
 * acontecer por um e-mail digitado na lista errada.
 */
export const makeCreateOrganizationUseCase = (deps: {
  users: Pick<IUserRepository, 'findByEmail'>;
  tenants: ITenantRepository;
  audit: CreateAuditLogUseCase;
  random: () => number;
}): CreateOrganizationUseCase => ({
  execute: async ({ name, ownerEmail, actor }) => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (trimmed === '' || trimmed.length > ORGANIZATION_NAME_MAX) {
      throw invalidArgument('@core.admin/access.offices.create.name-invalid', { max: String(ORGANIZATION_NAME_MAX) });
    }
    const email = typeof ownerEmail === 'string' ? ownerEmail.trim() : '';
    const owner = email === '' ? null : await deps.users.findByEmail(email);
    if (!owner) throw notFound('@core.admin/access.offices.create.owner-not-found');
    if (owner.origin === 'portal') throw failedPrecondition('@core.admin/access.offices.create.owner-portal');

    const tenant = await openOwnedTenant(deps.tenants, owner, trimmed, actor.userId, deps.random);
    await deps.audit.execute({
      tenantId: tenant.id,
      ...actor,
      action: 'CREATE',
      type: 'AUDIT',
      severity: 'LOW',
      entity: 'Tenant',
      entityId: tenant.id,
      title: '@core.admin/access.offices.audit.created.title',
      text: '@core.admin/access.offices.audit.created.text',
      textParams: { name: trimmed, owner: owner.email },
    });
    return { tenantId: tenant.id };
  },
});
