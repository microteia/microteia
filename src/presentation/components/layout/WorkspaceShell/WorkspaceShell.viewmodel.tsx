import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { parseDeepLink, parseDeepLinkFromPath } from '../../../../infrastructure/deeplink/deepLinkUtils';

export const useWorkspaceShellViewModel = () => {
  const { openTab } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hashTabKey = parseDeepLink();
    if (hashTabKey) {
      openTab(hashTabKey);
      history.replaceState(null, '', window.location.pathname);
      return;
    }

    const pathTabKey = parseDeepLinkFromPath();
    if (pathTabKey) {
      openTab(pathTabKey);
      navigate('/', { replace: true });
    }
  }, [location.pathname, openTab, navigate]);
};
