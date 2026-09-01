import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
  ACCESS_REQUIREMENT_POINT,
  ACCESS_RESOURCE_POINT,
  KERNEL_CATALOG_FINGERPRINT,
  buildPermissionCatalog,
  declaredPermissionsOf,
  declaredRequirementsOf,
  declaredResourcesOf,
  UNRESTRICTED_PERMISSION,
  isUnrestricted as grantsEverything,
  memberPermissions,
  setAmbientPermissions,
} from '../domain/schema/access';
import { screenDataCollection } from '../domain/services/screenDataCollection';
import { collectionPermissionResources } from '../domain/services/collectionPermissionResources';

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
  const { roles, isLoading: rolesLoading, syncPermissions } = useRoles();
  const { definitions, isLoading: screensLoading } = useScreenDefinitions();
  const { availableLookups } = useLookups();
  const { availableTagLists } = useTags();
  const permissionContributions = useContributions(ACCESS_PERMISSION_POINT);
  const resourceContributions = useContributions(ACCESS_RESOURCE_POINT);
  const requirementContributions = useContributions(ACCESS_REQUIREMENT_POINT);

  /**
   * O catálogo deriva de TODA coleção que o escritório tem: as telas, as listas de opções e os
   * conjuntos de etiquetas. As três passam pelo mesmo curinga das Security Rules, e deixar qualquer
   * uma de fora significaria uma coleção que ninguém consegue gravar — nem o administrador.
   */
  const catalog = useMemo(() => {
    const screenResources: PermissionResource[] = definitions.map((definition) => ({
      id: screenDataCollection(definition),
      name: definition.titlePlural || definition.titleSingular || definition.id,
      deriveCrud: true,
      ...(definition.ownerPluginId ? { source: definition.ownerPluginId } : {}),
    }));
    const listResources = collectionPermissionResources(availableLookups, availableTagLists);

    return buildPermissionCatalog(
      declaredPermissionsOf(permissionContributions),
      [...declaredResourcesOf(resourceContributions), ...listResources, ...screenResources],
      declaredRequirementsOf(requirementContributions),
    );
  }, [
    permissionContributions,
    resourceContributions,
    requirementContributions,
    definitions,
    availableLookups,
    availableTagLists,
  ]);

  const member = useMemo(
    () => members.find((candidate) => candidate.userId === user?.id) ?? null,
    [members, user],
  );

  /**
   * O DONO do escritório é lido de `Tenant.ownerId`, e não só do curinga materializado — a mesma
   * frase que o `firestore.rules` diz. Depender do curinga faria a tela do dono ficar vazia até a
   * Cloud Function de materialização rodar pela primeira vez, enquanto o servidor já o deixava
   * passar: a UI esconderia o que a regra aceita, que é o pior dos dois erros possíveis aqui.
   */
  const isUnrestricted =
    userRole === 'SYSTEM'
    || grantsEverything(member?.permissions ?? [])
    || (!!user && !!currentTenant && currentTenant.ownerId === user.id);

  const resolved = useMemo(
    () => memberPermissions(catalog, roles, member?.roleIds ?? []),
    [catalog, roles, member],
  );

  /**
   * O conjunto EFETIVO inclui o curinga de quem não tem limite — o administrador global e o DONO do
   * escritório. Ele é o que de fato vale, e é o que sai daqui para todo lugar que não passa por
   * `can()`: a expressão de uma ação (`hasPermission`), o `ExtensionViewer` de uma extensão, o
   * escopo de um campo.
   *
   * Sem isso, `can()` deixava o dono passar e `hasPermission("<entity>.delete")` na mesma tela dizia
   * que não — a mesma pergunta com duas respostas, conforme por onde se perguntasse. O backend já
   * materializava `*` para o dono; faltava o front dizer a mesma coisa.
   */
  const effectivePermissions = useMemo(
    () => (isUnrestricted ? [UNRESTRICTED_PERMISSION] : resolved.effective),
    [isUnrestricted, resolved],
  );

  const effectiveSet = useMemo(() => new Set(effectivePermissions), [effectivePermissions]);

  const healedTenants = useRef(new Set<string>());

  /**
   * O conjunto materializado se recompõe sozinho quando o CATÁLOGO DE CÓDIGO muda.
   *
   * Uma versão nova do kernel pode alterar de que uma permissão depende, e nesse dia nenhuma escrita
   * acontece no banco — então nenhum dos gatilhos de materialização acorda. Quem fica velho é só o
   * campo que as Security Rules leem: esta tela recalcula por conta própria e segue acertando, e o
   * que a pessoa vive é a tela oferecendo o que salvar recusa.
   *
   * A digital carimbada no membro é o que torna a diferença VISÍVEL sem custar leitura nenhuma — o
   * documento de membro já está assinado aqui. Divergiu, pede a recomposição uma vez por escritório
   * por sessão; o primeiro que abrir o app depois do upgrade cura o escritório inteiro, e nenhum
   * administrador precisa saber que algo aconteceu.
   *
   * Falhar é SILENCIOSO de propósito: ninguém pediu isto, e o que se perde ao falhar é exatamente o
   * que já se tinha. A tentativa volta na sessão seguinte.
   */
  useEffect(() => {
    if (!currentTenant || !member) return;
    if (member.permissionsCatalog === KERNEL_CATALOG_FINGERPRINT) return;
    if (healedTenants.current.has(currentTenant.id)) return;
    healedTenants.current.add(currentTenant.id);
    void syncPermissions().catch(() => healedTenants.current.delete(currentTenant.id));
  }, [currentTenant, member, syncPermissions]);

  /**
   * O gate de módulo é o CAMINHO DE RESERVA de `hasPermission(...)`: quem avalia uma expressão de
   * tela passa o conjunto pelo contexto, que é o que a torna uma dependência de render. Este efeito
   * atende quem avalia fora de uma tela — e nunca deve ser o caminho principal, porque efeito roda
   * depois do render e não provoca recálculo nenhum.
   */
  useEffect(() => {
    setAmbientPermissions(effectivePermissions);
  }, [effectivePermissions]);

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
      effectivePermissions,
      catalog,
      isUnrestricted,
      isLoading: Boolean(currentTenant) && (tenantLoading || rolesLoading || screensLoading),
    }),
    [
      can,
      canAny,
      canAll,
      resolved,
      effectivePermissions,
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
