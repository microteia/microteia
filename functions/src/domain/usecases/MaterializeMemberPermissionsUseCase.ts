import type { Firestore } from 'firebase-admin/firestore';
import type { AssignedRole } from '../schema/access';
import { KERNEL_CATALOG_FINGERPRINT, UNRESTRICTED_PERMISSION, memberPermissions } from '../schema/access';
import type { PermissionCatalogCache } from '../../data/services/PermissionCatalogCache';
import type { IMemberMfaPolicyRepository } from '../repositories/IMemberMfaPolicyRepository';
import { memberMfaRequirementFrom, memberMfaRequirementOf, sameMfaRequirement } from '../schema/memberMfa';

export interface MaterializeInput {
  tenantId: string;
  /** Recalcula só estes membros. Ausente = todos os do escritório. */
  userIds?: string[];
}

export type MaterializeMemberPermissionsUseCase = {
  execute: (input: MaterializeInput) => Promise<number>;
};

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Grava em cada membro as permissões EFETIVAS dele — o cache que as Security Rules leem.
 *
 * Duas propriedades importam mais que o resto:
 *
 * 1. **Não escreve quando nada muda.** É o que torna a rotina idempotente e, sobretudo, o que impede
 *    o laço: gravar no documento de membro dispara o gatilho de membro, que chama isto de novo — e a
 *    segunda passada não grava.
 * 2. **O dono do escritório recebe o curinga.** Sem isso, "nenhum perfil semeado" significaria um
 *    escritório recém-criado sem ninguém capaz de criar o primeiro perfil. Dono é fato do escritório
 *    (`Tenant.ownerId`), não papel concedido por alguém — e por isso não passa por Role nenhuma.
 * 3. **Carimba a digital do catálogo de código junto com o conjunto.** Os dois na MESMA escrita, no
 *    mesmo documento: é o que impede que o carimbo diga uma coisa e o conjunto materializado, outra.
 *    É por ele que o front descobre sozinho que o kernel mudou de ideia sobre uma dependência — ver
 *    `KERNEL_CATALOG_FINGERPRINT`.
 * 4. **A exigência de segundo fator vem junto** (`mfa`), calculada da política do escritório sobre o
 *    MESMO conjunto efetivo — quem recebe uma permissão por dependência a recebe também para a política.
 *    Ela entra na guarda de idempotência como o resto, e ausente continua ausente: num escritório sem
 *    política, nenhum documento de membro ganha campo novo.
 */
export const makeMaterializeMemberPermissionsUseCase = (
  db: Firestore,
  catalogCache: PermissionCatalogCache,
  mfaPolicies: Pick<IMemberMfaPolicyRepository, 'get'>,
): MaterializeMemberPermissionsUseCase => ({
  execute: async ({ tenantId, userIds }) => {
    const [tenantSnap, roleSnap, memberSnap, catalog, mfaPolicy] = await Promise.all([
      db.doc(`tenants/${tenantId}`).get(),
      db.collection(`tenants/${tenantId}/roles`).get(),
      db.collection(`tenants/${tenantId}/members`).get(),
      catalogCache.get(tenantId),
      mfaPolicies.get(tenantId),
    ]);

    if (!tenantSnap.exists) return 0;
    const ownerId = tenantSnap.data()?.ownerId as string | undefined;

    const roles: AssignedRole[] = roleSnap.docs.map((doc) => ({
      id: doc.id,
      permissions: Array.isArray(doc.data().permissions) ? (doc.data().permissions as string[]) : [],
    }));

    const wanted = userIds ? new Set(userIds) : null;
    let written = 0;

    await Promise.all(
      memberSnap.docs.map(async (doc) => {
        const userId = (doc.data().userId as string | undefined) ?? doc.id;
        if (wanted && !wanted.has(userId)) return;

        const roleIds = Array.isArray(doc.data().roleIds) ? (doc.data().roleIds as string[]) : [];
        // AUSENTE não é o mesmo que VAZIO: um membro que nunca foi materializado precisa receber a
        // lista, ainda que vazia. Sem isso o campo nunca nasceria para quem não tem perfil, e o
        // gatilho de membro voltaria a recalcular o escritório a cada escrita nele.
        const current = Array.isArray(doc.data().permissions) ? (doc.data().permissions as string[]) : null;
        const stamped = doc.data().permissionsCatalog as string | undefined;
        const next =
          userId === ownerId
            ? [UNRESTRICTED_PERMISSION]
            : memberPermissions(catalog, roles, roleIds).effective;

        const mfa = memberMfaRequirementOf(mfaPolicy, { roleIds, permissions: next });
        const mfaUnchanged = sameMfaRequirement(memberMfaRequirementFrom(doc.data().mfa), mfa);

        // O carimbo entra na guarda junto com o conjunto: sem isso, um kernel que mudou uma
        // dependência SEM mudar o resultado deste membro deixaria o documento com a digital velha, e
        // o front pediria a mesma recomposição a cada sessão, para sempre.
        if (current !== null && sameSet(current, next) && stamped === KERNEL_CATALOG_FINGERPRINT && mfaUnchanged) return;
        await doc.ref.update({
          permissions: next,
          permissionsCatalog: KERNEL_CATALOG_FINGERPRINT,
          ...(mfaUnchanged ? {} : { mfa }),
        });
        written += 1;
      }),
    );

    return written;
  },
});
