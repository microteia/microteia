import React, { useCallback, useMemo } from 'react';
import { AuthorizationContext } from './useAuthorization';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { useRoles } from './useRoles';
import { useScreenDefinitions } from './useScreenDefinitions';
import { useLookups } from './useLookups';
import { useTags } from './useTags';
import { useContributions } from './useKernel';
import type { PermissionResource } from '../domain/schema/access';
import {
  ACCESS_PERMISSION_POINT,
  ACCESS_RESOURCE_POINT,
  buildPermissionCatalog,
  declaredPermissionsOf,
  declaredResourcesOf,
  isUnrestricted as grantsEverything,
  memberPermissions,
} from '../domain/schema/access';

/**
 * Quem responde "pode?" — e a razão de o resto do sistema nunca precisar saber quem é quem.
 *
 * O conjunto efetivo é RECALCULADO aqui, a partir dos perfis e do catálogo, em vez de lido do campo
 * materializado no documento de membro. São duas contas sobre os mesmos dados, e é de propósito: a
 * materializada existe para as Security Rules, que não sabem resolver dependência; esta existe para
 * a tela, que precisa acertar no instante em que o administrador salva o perfil — antes de a Cloud
 * Function ter rodado. Divergir por alguns segundos é o comportamento correto: a tela oferece, a
 * regra decide.
 */
export const AuthorizationStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole } = useAuth();
  const { currentTenant, members, isLoading: tenantLoading } = useTenant();
  const { roles, isLoading: rolesLoading } = useRoles();
  const { definitions, isLoading: screensLoading } = useScreenDefinitions();
  const { availableLookups } = useLookups();
  const { availableTagLists } = useTags();
  const permissionContributions = useContributions(ACCESS_PERMISSION_POINT);
  const resourceContributions = useContributions(ACCESS_RESOURCE_POINT);

  /**
   * O catálogo deriva de TODA coleção que o escritório tem: as telas, as listas de opções e os
   * conjuntos de etiquetas. As três passam pelo mesmo curinga das Security Rules, e deixar qualquer
   * uma de fora significaria uma coleção que ninguém consegue gravar — nem o administrador.
   */
  const catalog = useMemo(() => {
    const screenResources: PermissionResource[] = definitions.map((definition) => ({
      id: definition.dataCollection ?? definition.id,
      name: definition.titlePlural || definition.titleSingular || definition.id,
      deriveCrud: true,
      ...(definition.ownerPluginId ? { source: definition.ownerPluginId } : {}),
    }));
    const listResources: PermissionResource[] = [
      ...availableLookups.map((lookup) => ({ id: lookup.collection, name: lookup.label })),
      ...availableTagLists.map((tagList) => ({ id: tagList.collection, name: tagList.label })),
    ].map((resource) => ({ ...resource, deriveCrud: true }));

    return buildPermissionCatalog(
      declaredPermissionsOf(permissionContributions),
      [...declaredResourcesOf(resourceContributions), ...listResources, ...screenResources],
    );
  }, [permissionContributions, resourceContributions, definitions, availableLookups, availableTagLists]);

  const member = useMemo(
    () => members.find((candidate) => candidate.userId === user?.id) ?? null,
    [members, user],
  );

  const isUnrestricted = userRole === 'SYSTEM' || grantsEverything(member?.permissions ?? []);

  const resolved = useMemo(
    () => memberPermissions(catalog, roles, member?.roleIds ?? []),
    [catalog, roles, member],
  );

  const effectiveSet = useMemo(() => new Set(resolved.effective), [resolved]);

  const can = useCallback(
    (permission: string) => isUnrestricted || effectiveSet.has(permission),
    [isUnrestricted, effectiveSet],
  );

  const canAny = useCallback(
    (permissions: string[]) => isUnrestricted || permissions.some((permission) => effectiveSet.has(permission)),
    [isUnrestricted, effectiveSet],
  );

  const canAll = useCallback(
    (permissions: string[]) => isUnrestricted || permissions.every((permission) => effectiveSet.has(permission)),
    [isUnrestricted, effectiveSet],
  );

  const value = useMemo(
    () => ({
      can,
      canAny,
      canAll,
      explicitPermissions: resolved.explicit,
      effectivePermissions: resolved.effective,
      catalog,
      isUnrestricted,
      isLoading: Boolean(currentTenant) && (tenantLoading || rolesLoading || screensLoading),
    }),
    [
      can,
      canAny,
      canAll,
      resolved,
      catalog,
      isUnrestricted,
      currentTenant,
      tenantLoading,
      rolesLoading,
      screensLoading,
    ],
  );

  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>;
};
