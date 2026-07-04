import { useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { parseDeepLink, parseDeepLinkFromPath } from '../../../../infrastructure/deeplink/deepLinkUtils';

export const useWorkspaceShellViewModel = () => {
  const { openTab } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

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
