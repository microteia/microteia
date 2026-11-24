import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthorizationContext } from './useAuthorization';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { useRoles } from './useRoles';
import { useScreenDefinitions } from './useScreenDefinitions';
import { useLookups } from './useLookups';
import { useTags } from './useTags';
import { useContributions } from './useKernel';
import { usePlan } from './usePlan';
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
  applyPlanCeiling,
  grants,
  isUnrestricted as grantsEverything,
  memberPermissions,
  planDeniedClosure,
  setAmbientPermissions,
} from '../domain/schema/access';
import { planStamp } from '../domain/schema/plans';
import { onboardingPlanWindowDeadline, type DefaultExtensionsOnboarding } from '../domain/schema/plugin/defaultExtensions';
import { makeSubscribeDefaultExtensionsOnboardingUseCase } from '../domain/usecases/plugins/DefaultExtensionsOnboardingUseCases';
import { useDI } from '../infrastructure/di/useDI';
import { tenantCollectionPermissionResources } from '../domain/schema/tenantCollections';

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
  const { currentPlan, isLoading: planLoading } = usePlan();
  const { extensionOnboardingRepository } = useDI();
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
   *
   * A conta é a de `tenantCollectionPermissionResources`, a mesma do `PermissionCatalogCache`: o que
   * este catálogo oferece em Perfis, na aba de Agentes de IA e no consentimento de OAuth é o que o
   * servidor aceita ao gravar.
   */
  const catalog = useMemo(() => buildPermissionCatalog(
    declaredPermissionsOf(permissionContributions),
    [
      ...declaredResourcesOf(resourceContributions),
      ...tenantCollectionPermissionResources(definitions, availableLookups, availableTagLists),
    ],
    declaredRequirementsOf(requirementContributions),
  ), [
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
  const isSystem = userRole === 'SYSTEM';
  const isOwner =
    grantsEverything(member?.permissions ?? [])
    || (!!user && !!currentTenant && currentTenant.ownerId === user.id);
  const isUnrestricted = isSystem || isOwner;

  /**
   * O que o PLANO do escritório nega, com o que cai junto (#24) — a mesma conta da materialização, sobre
   * o mesmo catálogo. Sai daqui também para a tela de Perfis travar o que o plano não inclui, e por isso
   * é calculada mesmo para o `SYSTEM`, que não é alcançado por ela.
   */
  const planDeniedPermissions = useMemo(
    () => planDeniedClosure(catalog, currentPlan?.deniedPermissions ?? []),
    [catalog, currentPlan],
  );

  const resolved = useMemo(
    () => memberPermissions(catalog, roles, member?.roleIds ?? []),
    [catalog, roles, member],
  );

  /**
   * O conjunto EFETIVO inclui o curinga de quem não tem limite — o administrador global e o DONO do
   * escritório —, e o teto do plano (`!<id>`), que alcança o dono e nunca o `SYSTEM`. Ele é o que de fato vale, e é o que sai daqui para todo lugar que não passa por
   * `can()`: a expressão de uma ação (`hasPermission`), o `ExtensionViewer` de uma extensão, o
   * escopo de um campo.
   *
   * Sem isso, `can()` deixava o dono passar e `hasPermission("<entity>.delete")` na mesma tela dizia
   * que não — a mesma pergunta com duas respostas, conforme por onde se perguntasse. O backend já
   * materializava `*` para o dono; faltava o front dizer a mesma coisa.
   */
  /**
   * A janela de instalação das extensões padrão do escritório novo (#28): enquanto ela vale, o teto do
   * plano não alcança o DONO — a mesma conta que o servidor grava em `planDeferredUntil`. Sem ela, o
   * portão não aparecia para o dono cujo plano nega `extensions.manage`, e a instalação esbarrava em cada
   * automação ou relatório que o plano nega.
   *
   * Só o dono de um escritório cujo plano nega algo assina a lista — para todo o resto ela não muda nada.
   */
  const tenantId = currentTenant?.id ?? null;
  const watchesOnboarding = isOwner && !isSystem && planDeniedPermissions.length > 0 && tenantId !== null;
  const [onboarding, setOnboarding] = useState<{ tenantId: string; state: DefaultExtensionsOnboarding | null } | null>(null);
  const subscribeOnboarding = useMemo(
    () => makeSubscribeDefaultExtensionsOnboardingUseCase(extensionOnboardingRepository),
    [extensionOnboardingRepository],
  );
  useEffect(() => {
    if (!watchesOnboarding || tenantId === null) return undefined;
    return subscribeOnboarding.execute(
      tenantId,
      (state) => setOnboarding({ tenantId, state }),
      () => setOnboarding({ tenantId, state: null }),
    );
  }, [watchesOnboarding, tenantId, subscribeOnboarding]);

  const windowDeadline = useMemo(
    () => (watchesOnboarding && onboarding?.tenantId === tenantId ? onboardingPlanWindowDeadline(onboarding.state) : null),
    [watchesOnboarding, onboarding, tenantId],
  );
  /**
   * O prazo vencido é marcado por um temporizador, e não lendo a hora no render: o React Compiler recusa
   * função impura ali. Até ele disparar, a tela pode oferecer por um instante o que a regra já recusa —
   * quem decide é a regra, que compara com a hora da requisição.
   */
  const [expiredDeadline, setExpiredDeadline] = useState<number | null>(null);
  useEffect(() => {
    if (windowDeadline === null) return undefined;
    const timer = setTimeout(() => setExpiredDeadline(windowDeadline), Math.max(0, windowDeadline - Date.now()));
    return () => clearTimeout(timer);
  }, [windowDeadline]);
  const onboardingWindowOpen = windowDeadline !== null && expiredDeadline !== windowDeadline;

  const effectivePermissions = useMemo(() => {
    if (isSystem) return [UNRESTRICTED_PERMISSION];
    return applyPlanCeiling(
      isOwner ? [UNRESTRICTED_PERMISSION] : resolved.effective,
      onboardingWindowOpen ? [] : planDeniedPermissions,
    );
  }, [isSystem, isOwner, resolved, planDeniedPermissions, onboardingWindowOpen]);

  const healedTenants = useRef(new Set<string>());

  /**
   * O conjunto materializado se recompõe sozinho quando o CATÁLOGO DE CÓDIGO muda — ou quando o teto do
   * PLANO mudou e a recomposição do servidor não chegou a este escritório (#24).
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
    if (!currentTenant || !member || planLoading) return;
    const planInStep = (member.permissionsPlan ?? '') === planStamp(currentPlan?.deniedPermissions ?? []);
    if (member.permissionsCatalog === KERNEL_CATALOG_FINGERPRINT && planInStep) return;
    if (healedTenants.current.has(currentTenant.id)) return;
    healedTenants.current.add(currentTenant.id);
    void syncPermissions().catch(() => healedTenants.current.delete(currentTenant.id));
  }, [currentTenant, member, syncPermissions, planLoading, currentPlan]);

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
    (permission: string) => grants(effectivePermissions, permission),
    [effectivePermissions],
  );

  const canAny = useCallback(
    (permissions: string[]) => permissions.some((permission) => grants(effectivePermissions, permission)),
    [effectivePermissions],
  );

  const canAll = useCallback(
    (permissions: string[]) => permissions.every((permission) => grants(effectivePermissions, permission)),
    [effectivePermissions],
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
      planDeniedPermissions,
      isLoading: Boolean(currentTenant) && (tenantLoading || rolesLoading || screensLoading || planLoading),
    }),
    [
      can,
      canAny,
      canAll,
      resolved,
      effectivePermissions,
      catalog,
      isUnrestricted,
      planDeniedPermissions,
      currentTenant,
      tenantLoading,
      planLoading,
      rolesLoading,
      screensLoading,
    ],
  );

  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>;
};
