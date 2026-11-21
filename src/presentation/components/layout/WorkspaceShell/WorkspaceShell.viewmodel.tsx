import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useTenant } from '../../../../stores/useTenant';
import { PORTAL_PATH } from '../../../pages/Portal/portalPaths';
import { parseDeepLink, parseDeepLinkFromPath } from '../../../../infrastructure/deeplink/deepLinkUtils';
import { usePageContributions } from '../../../shared/useUiContributions';
import { homePageKeys, isRestorableTab } from '../../../shared/resolveUiContributions';
import { sanitizeWorkspaceSnapshot } from '../../../../stores/workspaceSession';
import { useSettings } from '../../../../stores/useSettings';
import { useSettingValue } from '../../../shared/settings/useSettingValue';
import { WORKSPACE_RESTORE_TABS_SETTING } from '../../../../domain/schema/ui/uiExtensionPoints';
import { useInstalledExtensions } from '../../../../stores/useInstalledExtensions';
import { useInstalledCodeTrust } from '../../../../stores/useExtensionCodeTrust';
import { useOpenLink } from '../../../shared/useOpenLink';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { parseRecordLinkTabKey, TENANT_LINK_PARAM } from '../../../../domain/schema/recordLink';

export const useWorkspaceShellViewModel = () => {
  const { hydrated, hydrate, loadSavedSession, setPersist } = useWorkspace();
  const { allScopesLoaded: settingsLoaded } = useSettings();
  const restoreTabs = useSettingValue(WORKSPACE_RESTORE_TABS_SETTING) !== false;
  const openLink = useOpenLink();
  const { isLoaded: screensLoaded } = useScreenDefinitions();
  const { user, userRole } = useAuth();
  const { canAny, isLoading: authorizationLoading, isUnrestricted } = useAuthorization();
  const { isLoaded: extensionsLoaded } = useInstalledExtensions();
  const { ready: codeTrustReady } = useInstalledCodeTrust();
  const pageContributions = usePageContributions();
  const location = useLocation();
  const navigate = useNavigate();
  const { portalOnly, currentTenant, availableTenants, selectTenant, members } = useTenant();

  useEffect(() => {
    if (portalOnly) navigate(PORTAL_PATH, { replace: true });
  }, [portalOnly, navigate]);

  const isSystemAdmin = userRole === 'SYSTEM';
  const homeKeys = useMemo(
    () => homePageKeys(pageContributions, canAny, isSystemAdmin),
    [pageContributions, canAny, isSystemAdmin],
  );
  // As permissões só respondem de verdade quando o documento de membro DESTE escritório chegou: até lá
  // `canAny` diz não, e uma tela restrita seria pulada para sempre. As páginas de extensão só existem
  // depois da lista instalada e da confiança de código (o hash é assíncrono).
  const memberLoaded = isUnrestricted || members.some(
    (member) => member.tenantId === currentTenant?.id && member.userId === user?.id,
  );
  const openingReady = extensionsLoaded && codeTrustReady && !authorizationLoading && memberLoaded && settingsLoaded;

  // A abertura do escritório é decidida uma vez por entrada (login ou troca), quando tudo que a muda já
  // chegou — inclusive a preferência PESSOAL de reabrir, que pode divergir do padrão do escritório: a
  // sessão da última vez, filtrada pelo que ainda existe e é permitido, ou as telas iniciais. Um link
  // aberto antes entra junto e mantém o foco; fechar todas as abas depois não reabre nada.
  useEffect(() => {
    if (hydrated || !openingReady) return;
    if (!restoreTabs) {
      setPersist(false);
      hydrate(null, homeKeys, false);
      return;
    }
    const restorable = (tabKey: string) => isRestorableTab(pageContributions, tabKey, canAny, isSystemAdmin);
    hydrate(sanitizeWorkspaceSnapshot(loadSavedSession(), restorable), homeKeys, true);
  }, [hydrated, openingReady, restoreTabs, pageContributions, canAny, isSystemAdmin, homeKeys, hydrate, loadSavedSession, setPersist]);

  // Mudou a escolha com o escritório aberto: ligar passa a gravar já; desligar para e apaga o guardado.
  useEffect(() => {
    if (hydrated) setPersist(restoreTabs);
  }, [hydrated, restoreTabs, setPersist]);

  // O link pode trazer o ESCRITÓRIO (`?tenant=`): o push e o e-mail de um escritório não podem abrir
  // o registro no outro. E um link de registro espera as telas carregarem — é por elas que se sabe
  // qual tela abre aquela coleção.
  const linkTenant = new URLSearchParams(location.search).get(TENANT_LINK_PARAM);
  // Escritório de que a pessoa não é membro: o link abre no atual, em vez de esperar para sempre.
  const [refusedTenant, setRefusedTenant] = useState<string | null>(null);
  const switchingTenant = !!linkTenant && !!currentTenant && linkTenant !== currentTenant.id
    && linkTenant !== refusedTenant && availableTenants.some((tenant) => tenant.id === linkTenant);

  useEffect(() => {
    if (!switchingTenant || !linkTenant) return;
    selectTenant(linkTenant).catch(() => setRefusedTenant(linkTenant));
  }, [switchingTenant, linkTenant, selectTenant]);

  const readyFor = useCallback(
    (tabKey: string) => !switchingTenant && !(parseRecordLinkTabKey(tabKey) && !screensLoaded),
    [switchingTenant, screensLoaded],
  );

  const consumeHashDeepLink = useCallback(() => {
    const hashTabKey = parseDeepLink();
    if (!hashTabKey || !readyFor(hashTabKey)) return false;
    openLink(hashTabKey);
    history.replaceState(null, '', window.location.pathname);
    return true;
  }, [openLink, readyFor]);

  useEffect(() => {
    if (consumeHashDeepLink()) return;

    const pathTabKey = parseDeepLinkFromPath();
    if (pathTabKey && readyFor(pathTabKey)) {
      openLink(pathTabKey);
      navigate('/app', { replace: true });
    }
  }, [location.pathname, openLink, navigate, consumeHashDeepLink, readyFor]);

  useEffect(() => {
    window.addEventListener('hashchange', consumeHashDeepLink);
    return () => window.removeEventListener('hashchange', consumeHashDeepLink);
  }, [consumeHashDeepLink]);
};
