import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  ACCESS_UPGRADE_AUTHOR,
  pendingAccessUpgrades,
  upgradeRolePermissions,
} from '../schema/access';
import type { PermissionCatalogCache } from '../../data/services/PermissionCatalogCache';
import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';

export type ApplyAccessUpgradesUseCase = {
  /** Os perfis alterados — zero quando o escritório já tinha recebido tudo. */
  execute: (tenantId: string) => Promise<number>;
};

/**
 * Aplica ao escritório as atualizações de acesso que ele ainda não recebeu (ver `ACCESS_UPGRADES`).
 *
 * **Transação, e não leitura seguida de escrita.** Quem chama é a abertura do app, e dois membros abrindo
 * ao mesmo tempo é o caso comum logo depois de um upgrade. A marca e os perfis gravam juntos: o segundo
 * relê a marca e não faz nada — sem isso, o primeiro a terminar poderia gravar a marca DEPOIS de um
 * administrador já ter tirado a permissão recém-concedida, e o segundo a devolveria.
 *
 * O catálogo é lido FRESCO, fora da transação: a derivação depende das telas, e o cache por instância
 * poderia não conhecer o `allowImport` ligado há um minuto.
 */
export const makeApplyAccessUpgradesUseCase = (
  db: Firestore,
  catalogCache: Pick<PermissionCatalogCache, 'fresh'>,
  audit: CreateAuditLogUseCase,
): ApplyAccessUpgradesUseCase => ({
  execute: async (tenantId) => {
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const before = await tenantRef.get();
    if (!before.exists || pendingAccessUpgrades(before.data()?.accessUpgrades).length === 0) return 0;

    const catalog = await catalogCache.fresh(tenantId);
    const outcome = await db.runTransaction(async (tx) => {
      const tenant = await tx.get(tenantRef);
      const pending = tenant.exists ? pendingAccessUpgrades(tenant.data()?.accessUpgrades) : [];
      if (pending.length === 0) return { pending, changed: 0 };

      const roles = await tx.get(db.collection(`tenants/${tenantId}/roles`));
      let changed = 0;
      for (const role of roles.docs) {
        const current = Array.isArray(role.data().permissions) ? (role.data().permissions as string[]) : [];
        const next = upgradeRolePermissions(pending, catalog, current);
        if (!next) continue;
        tx.update(role.ref, {
          permissions: next,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: ACCESS_UPGRADE_AUTHOR,
        });
        changed += 1;
      }
      tx.update(tenantRef, { accessUpgrades: FieldValue.arrayUnion(...pending) });
      return { pending, changed };
    });

    // Cada perfil alterado já tem a linha de sempre; esta diz POR QUE mudaram sem ninguém ter mexido.
    if (outcome.changed > 0) {
      await audit.execute({
        tenantId,
        title: '@core.access/upgrade.audit.title',
        userId: 'system',
        userName: '@core.access/upgrade.author',
        photoURL: '',
        action: 'SYSTEM',
        severity: 'HIGH',
        entity: 'roles',
        entityId: outcome.pending.join(','),
        text: '@core.access/upgrade.audit.text',
        textParams: { roles: String(outcome.changed), upgrades: outcome.pending.join(', ') },
      });
    }
    return outcome.changed;
  },
});
