import type { IUserRepository } from '../repositories/IUserRepository';
import type { ITenantRepository } from '../repositories/ITenantRepository';

export interface BootstrapUserInput {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

export type BootstrapUserUseCase = {
  execute: (input: BootstrapUserInput) => Promise<void>;
};

// Provisiona um usuário recém-criado no Firebase Auth: documento em users/,
// documento em userProfiles/ e um Tenant próprio com o usuário como admin.
// Limite padrão de 1 membro (o próprio dono) — SYSTEM aumenta depois, se quiser,
// na aba "Escritórios" de Gestão de Acessos.
export const makeBootstrapUserUseCase = (
  userRepo: IUserRepository,
  tenantRepo: ITenantRepository,
): BootstrapUserUseCase => ({
  execute: async ({ userId, email, displayName, photoURL }) => {
    const created = await userRepo.createUserIfMissing(userId, { email, displayName, photoURL });
    if (!created) return; // já provisionado (execução duplicada do trigger)

    await userRepo.createUserProfileIfMissing(userId);

    const tenant = await tenantRepo.createTenant({
      // O nome do escritório é DADO gravado, não texto de interface: nasce uma vez, o escritório o
      // renomeia quando quiser, e traduzi-lo depois mudaria o nome que ele escolheu manter. Fica em
      // português porque é o idioma de quem hoje entra no sistema; um dia virá da preferência do
      // usuário no momento do cadastro, que o backend ainda não conhece.
      name: `Escritório de ${displayName}`,
      ownerId: userId,
      email,
      plan: 'solo',
      memberLimit: 1,
    });

    await tenantRepo.addMemberIfWithinLimit(tenant.id, {
      userId,
      role: 'admin',
      displayName,
      email,
      photoURL,
      addedBy: userId,
    });
  },
});
