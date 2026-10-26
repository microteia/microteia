import type { IUserRepository } from '../repositories/IUserRepository';
import type { ITenantRepository } from '../repositories/ITenantRepository';
import { generateArtifactPrefix } from '../schema/plugin/artifactPrefix';
import { normalizePortalEmail } from '../schema/portal';
import { isPortalIdentityAccount } from '../schema/portalIdentity';

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
  random: () => number = Math.random,
  portalInvites: { hasInvite: (email: string) => Promise<boolean> } = { hasInvite: async () => false },
): BootstrapUserUseCase => ({
  execute: async ({ userId, email, displayName, photoURL }) => {
    // Quem chegou por um convite do PORTAL é de fora: entra no escritório que o convidou, como
    // convidado, e não ganha um escritório próprio. A marca é gravada antes de a conta existir, por
    // isso está aqui quando o gatilho roda. A conta aberta por um provedor de identidade do portal não
    // tem e-mail para marcar — o uid dela é a prova, porque só o servidor escolhe uid.
    const fromPortal = isPortalIdentityAccount(userId)
      || (email !== '' && await portalInvites.hasInvite(normalizePortalEmail(email)));
    const created = await userRepo.createUserIfMissing(userId, {
      email,
      displayName,
      photoURL,
      ...(fromPortal ? { origin: 'portal' as const } : {}),
    });
    if (!created) return; // já provisionado (execução duplicada do trigger)

    await userRepo.createUserProfileIfMissing(userId);
    if (fromPortal) return;

    const tenant = await tenantRepo.createTenant({
      // O nome do escritório é DADO gravado, não texto de interface: nasce uma vez e o escritório
      // o renomeia quando quiser — traduzi-lo depois mudaria o nome que ele escolheu manter. Por
      // isso é montado só com o que o usuário trouxe: sem palavra nossa, não há idioma para ficar
      // preso. O e-mail entra porque dois usuários homônimos precisam se distinguir na lista.
      name: `${displayName}(${email})`,
      ownerId: userId,
      email,
      plan: 'solo',
      memberLimit: 1,
      // Sorteado: o escritório ainda não escolheu nada, e quatro letras ao acaso bastam para que o que
      // ele criar não colida com o de outro. Quem tem a permissão troca depois, em Configurações.
      artifactPrefix: generateArtifactPrefix(random),
    });

    // Sem perfil nenhum, e é de propósito: quem dá poder ao DONO é o curinga que
    // `materializeMemberPermissions` carimba a partir de `Tenant.ownerId`. Semear um perfil aqui
    // seria vocabulário nosso dentro do escritório — o defeito que este modelo existe para não ter.
    await tenantRepo.addMemberIfWithinLimit(tenant.id, {
      userId,
      roleIds: [],
      displayName,
      email,
      photoURL,
      addedBy: userId,
    });
  },
});
