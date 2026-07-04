import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import type { SplitDirection } from '../../../../stores/useWorkspace';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { getPageByKey } from '../../../pages/pageRegistry';
import { parseDynamicTabKey } from '../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../shared/screenIcons';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabKey: string;
}

export interface TabBarProps {
  panelId: string;
}

export interface TabBarViewModel {
  tabs: Array<{ key: string; title: string; icon: React.ReactNode; isActive: boolean }>;
  contextMenu: ContextMenuState;
  canSplit: boolean;
  canCloseOthers: boolean;
  canClosePanel: boolean;
  isPanelActive: boolean;
  handleTabClick: (key: string) => void;
  handleTabClose: (e: React.MouseEvent, key: string) => void;
  handleTabContextMenu: (e: React.MouseEvent, key: string) => void;
  handleSplitFromMenu: (direction: SplitDirection) => void;
  handleCloseFromMenu: () => void;
  handleCloseOthersFromMenu: () => void;
  handleClosePanel: () => void;
  handleMenuMouseDown: (e: React.MouseEvent) => void;
}

export const useTabBarViewModel = ({ panelId }: TabBarProps): TabBarViewModel => {
  const { panels, activePanelId, tabTitleOverrides, activateTab, closeTab, closeOtherTabs, closePanel, splitPanel } = useWorkspace();
  const { definitions } = useScreenDefinitions();
  const panel = panels[panelId];
  const hasMultiplePanels = Object.keys(panels).length > 1;
  const isPanelActive = hasMultiplePanels && activePanelId === panelId;

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, tabKey: '',
  });

  const tabs = (panel?.tabKeys ?? []).map(key => {
    const def = getPageByKey(key);
    const registryTitle = typeof def?.title === 'function' ? def.title(key) : (def?.title ?? key);
    const title = tabTitleOverrides[key] ?? registryTitle;
    const dynamicInfo = parseDynamicTabKey(key);
    const dynamicScreen = dynamicInfo ? definitions.find((d) => d.id === dynamicInfo.screenKey) : undefined;
    const icon = dynamicScreen ? getScreenIcon(dynamicScreen.icon, 20) : (def?.icon ?? null);
    return {
      key,
      title,
      icon,
      isActive: panel?.activeTabKey === key,
    };
  });

  const totalTabCount = useMemo(
    () => Object.values(panels).reduce((sum, p) => sum + p.tabKeys.length, 0),
    [panels],
  );
  const canSplit = totalTabCount > 1;
  const canCloseOthers = (panel?.tabKeys.length ?? 0) > 1;

  const handleTabClick = useCallback((key: string) => {
    activateTab(key, panelId);
  }, [activateTab, panelId]);

  const handleTabClose = useCallback((e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    closeTab(key, panelId);
  }, [closeTab, panelId]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, tabKey: key });
  }, []);

  const handleSplitFromMenu = useCallback((direction: SplitDirection) => {
    splitPanel(panelId, direction);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [splitPanel, panelId]);

  const handleCloseFromMenu = useCallback(() => {
    const key = contextMenu.tabKey;
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (key) closeTab(key, panelId);
  }, [closeTab, contextMenu.tabKey, panelId]);

  const handleCloseOthersFromMenu = useCallback(() => {
    const key = contextMenu.tabKey;
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (key) closeOtherTabs(key, panelId);
  }, [closeOtherTabs, contextMenu.tabKey, panelId]);

  const handleClosePanel = useCallback(() => {
    closePanel(panelId);
  }, [closePanel, panelId]);

  // Prevent mousedown inside the menu from triggering the outside-click dismiss
  const handleMenuMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!panel?.activeTabKey) return;
    const el = document.querySelector<HTMLElement>(
      `[data-tabkey="${panel.activeTabKey}"][data-panelid="${panelId}"]`,
    );
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [panel?.activeTabKey, panelId]);

  // Dismiss on mousedown outside the menu (more reliable than click/contextmenu)
  useEffect(() => {
    if (!contextMenu.visible) return;
    const dismiss = () => setContextMenu(prev => ({ ...prev, visible: false }));
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [contextMenu.visible]);

  return {
    tabs,
    contextMenu,
    canSplit,
    canCloseOthers,
    canClosePanel: hasMultiplePanels,
    isPanelActive,
    handleTabClick,
    handleTabClose,
    handleTabContextMenu,
    handleSplitFromMenu,
    handleCloseFromMenu,
    handleCloseOthersFromMenu,
    handleClosePanel,
    handleMenuMouseDown,
  };
};
