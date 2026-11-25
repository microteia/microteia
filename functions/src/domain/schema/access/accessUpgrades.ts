// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/accessUpgrades.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { PermissionCatalog } from './resolvePermissions';
import { resolveEffective } from './resolvePermissions';
import { IMPORT_ACTION, collectionPermissionId } from './permission';
import { PERMISSION_RECORD_IMPORT_RUN } from './kernelPermissions';

/**
 * As vezes em que o KERNEL passou a exigir uma permissão nova para algo que o perfil já fazia — e por
 * isso precisa gravar, UMA vez por escritório, o que o administrador teria marcado.
 *
 * A digital do catálogo (`KERNEL_CATALOG_FINGERPRINT`) não serve para isto: ela recompõe o conjunto a
 * partir dos perfis, e aqui o que muda são os PRÓPRIOS perfis. Rodar de novo também não pode: depois da
 * primeira vez, a permissão que falta num perfil é escolha de quem o administra, e devolvê-la a cada
 * versão desfaria essa escolha em silêncio. Por isso o escritório guarda as que já recebeu
 * (`Tenant.accessUpgrades`), e o escritório NOVO nasce com todas — nele não há o que preservar.
 *
 * Os ids são gravados no escritório: renomear um é aplicá-lo de novo em todos.
 */
export const ACCESS_UPGRADES = ['import-per-screen'] as const;

export type AccessUpgradeId = (typeof ACCESS_UPGRADES)[number];

/** O autor carimbado em `updatedBy` do perfil alterado: quem decidiu foi a versão, não quem abriu o app. */
export const ACCESS_UPGRADE_AUTHOR = 'kernel-upgrade';

export const pendingAccessUpgrades = (applied: unknown): AccessUpgradeId[] => {
  const done = new Set(Array.isArray(applied) ? applied.filter((id): id is string => typeof id === 'string') : []);
  return ACCESS_UPGRADES.filter((id) => !done.has(id));
};

/**
 * #29: importar passou a exigir `<coleção>.import` além de `record-import.run`. O perfil que importava
 * numa tela — tinha a do núcleo e podia criar ou alterar ali — continua importando nela. A tela que só
 * ligar `allowImport` depois disto não entra: ali a permissão é concedida por quem administra.
 */
const importPerScreen = (catalog: PermissionCatalog, permissions: readonly string[]): string[] => {
  const { effective } = resolveEffective(catalog, permissions);
  const granted = new Set(effective);
  if (!granted.has(PERMISSION_RECORD_IMPORT_RUN)) return [];
  return catalog.list
    .filter((permission) => permission.derived && permission.action === IMPORT_ACTION)
    .filter((permission) =>
      granted.has(collectionPermissionId(permission.resource, 'create'))
      || granted.has(collectionPermissionId(permission.resource, 'update')))
    .map((permission) => permission.id)
    .filter((id) => !permissions.includes(id));
};

const ADDITIONS: Record<AccessUpgradeId, (catalog: PermissionCatalog, permissions: readonly string[]) => string[]> = {
  'import-per-screen': importPerScreen,
};

/** As permissões explícitas do perfil depois das atualizações pendentes, ou `null` quando nada muda. */
export const upgradeRolePermissions = (
  upgrades: readonly AccessUpgradeId[],
  catalog: PermissionCatalog,
  permissions: readonly string[],
): string[] | null => {
  const next = [...permissions];
  for (const upgrade of upgrades) next.push(...ADDITIONS[upgrade](catalog, next));
  return next.length === permissions.length ? null : next;
};
