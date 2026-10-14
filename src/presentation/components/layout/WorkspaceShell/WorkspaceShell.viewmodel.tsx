import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { parseDeepLink, parseDeepLinkFromPath } from '../../../../infrastructure/deeplink/deepLinkUtils';
import { usePageContributions } from '../../../shared/useUiContributions';
import { homePageKey } from '../../../shared/resolveUiContributions';

export const useWorkspaceShellViewModel = () => {
  const { openTab, panels } = useWorkspace();
  const { userRole } = useAuth();
  const { canAny } = useAuthorization();
  const pageContributions = usePageContributions();
  const location = useLocation();
  const navigate = useNavigate();
  const homeOpenedRef = useRef(false);

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

  const consumeHashDeepLink = useCallback(() => {
    const hashTabKey = parseDeepLink();
    if (!hashTabKey) return false;
    openTab(hashTabKey);
    history.replaceState(null, '', window.location.pathname);
    return true;
  }, [openTab]);

  useEffect(() => {
    if (consumeHashDeepLink()) return;

    const pathTabKey = parseDeepLinkFromPath();
    if (pathTabKey) {
      openTab(pathTabKey);
      navigate('/app', { replace: true });
    }
  }, [location.pathname, openTab, navigate, consumeHashDeepLink]);

  useEffect(() => {
    window.addEventListener('hashchange', consumeHashDeepLink);
    return () => window.removeEventListener('hashchange', consumeHashDeepLink);
  }, [consumeHashDeepLink]);
};
