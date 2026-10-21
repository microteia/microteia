import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useTenant } from '../../../../stores/useTenant';
import { PORTAL_PATH } from '../../../pages/Portal/portalPaths';
import { parseDeepLink, parseDeepLinkFromPath } from '../../../../infrastructure/deeplink/deepLinkUtils';
import { usePageContributions } from '../../../shared/useUiContributions';
import { homePageKey } from '../../../shared/resolveUiContributions';
import { useOpenLink } from '../../../shared/useOpenLink';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { parseRecordLinkTabKey, TENANT_LINK_PARAM } from '../../../../domain/schema/recordLink';

export const useWorkspaceShellViewModel = () => {
  const { openTab, panels } = useWorkspace();
  const openLink = useOpenLink();
  const { isLoading: screensLoading } = useScreenDefinitions();
  const { userRole } = useAuth();
  const { canAny } = useAuthorization();
  const pageContributions = usePageContributions();
  const location = useLocation();
  const navigate = useNavigate();
  const homeOpenedRef = useRef(false);
  const { portalOnly, currentTenant, availableTenants, selectTenant } = useTenant();

  useEffect(() => {
    if (portalOnly) navigate(PORTAL_PATH, { replace: true });
  }, [portalOnly, navigate]);

  const homeKey = useMemo(
    () => homePageKey(pageContributions, canAny, userRole === 'SYSTEM'),
    [pageContributions, canAny, userRole],
  );
  const isWorkspaceEmpty = useMemo(
    () => Object.values(panels).every((panel) => panel.tabKeys.length === 0),
    [panels],
  );

  // A tela inicial chega quando a extensão que a declara carrega — às vezes depois do primeiro
  // render. Só entra num espaço de trabalho ainda vazio, para não roubar o foco de um deep link, e
  // é decidida uma vez só: fechar todas as abas depois não a reabre.
  useEffect(() => {
    if (homeOpenedRef.current || !homeKey) return;
    homeOpenedRef.current = true;
    if (isWorkspaceEmpty) openTab(homeKey);
  }, [homeKey, isWorkspaceEmpty, openTab]);

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
    (tabKey: string) => !switchingTenant && !(parseRecordLinkTabKey(tabKey) && screensLoading),
    [switchingTenant, screensLoading],
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
