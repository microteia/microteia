import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useTenant } from '../../../../stores/useTenant';
import { PORTAL_PATH } from '../../../pages/Portal/portalPaths';
import { parseDeepLink, parseDeepLinkFromPath } from '../../../../infrastructure/deeplink/deepLinkUtils';
import { usePageContributions } from '../../../shared/useUiContributions';
import { homePageKeys } from '../../../shared/resolveUiContributions';
import { useInstalledExtensions } from '../../../../stores/useInstalledExtensions';
import { useInstalledCodeTrust } from '../../../../stores/useExtensionCodeTrust';
import { useOpenLink } from '../../../shared/useOpenLink';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { parseRecordLinkTabKey, TENANT_LINK_PARAM } from '../../../../domain/schema/recordLink';

export const useWorkspaceShellViewModel = () => {
  const { openTabs, panels } = useWorkspace();
  const openLink = useOpenLink();
  const { isLoaded: screensLoaded } = useScreenDefinitions();
  const { user, userRole } = useAuth();
  const { canAny, isLoading: authorizationLoading, isUnrestricted } = useAuthorization();
  const { isLoaded: extensionsLoaded } = useInstalledExtensions();
  const { ready: codeTrustReady } = useInstalledCodeTrust();
  const pageContributions = usePageContributions();
  const location = useLocation();
  const navigate = useNavigate();
  const homeOpenedRef = useRef(false);
  const { portalOnly, currentTenant, availableTenants, selectTenant, members } = useTenant();

  useEffect(() => {
    if (portalOnly) navigate(PORTAL_PATH, { replace: true });
  }, [portalOnly, navigate]);

  const homeKeys = useMemo(
    () => homePageKeys(pageContributions, canAny, userRole === 'SYSTEM'),
    [pageContributions, canAny, userRole],
  );
  // As permissões só respondem de verdade quando o documento de membro DESTE escritório chegou: até lá
  // `canAny` diz não, e uma tela inicial restrita seria pulada para sempre. As páginas de extensão só
  // existem depois da lista instalada e da confiança de código (o hash é assíncrono).
  const memberLoaded = isUnrestricted || members.some(
    (member) => member.tenantId === currentTenant?.id && member.userId === user?.id,
  );
  const homeReady = extensionsLoaded && codeTrustReady && !authorizationLoading && memberLoaded;
  const isWorkspaceEmpty = useMemo(
    () => Object.values(panels).every((panel) => panel.tabKeys.length === 0),
    [panels],
  );

  // As telas iniciais são decididas uma vez só, quando tudo que as declara ou as restringe já chegou —
  // decidir com metade das extensões abriria metade delas. Só entram num espaço de trabalho ainda vazio,
  // para não roubar o foco de um deep link, e fechar todas as abas depois não as reabre.
  useEffect(() => {
    if (homeOpenedRef.current || !homeReady) return;
    homeOpenedRef.current = true;
    if (isWorkspaceEmpty) openTabs(homeKeys);
  }, [homeReady, homeKeys, isWorkspaceEmpty, openTabs]);

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
