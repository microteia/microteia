import { useMemo } from 'react';
import { useWorkspaceDock } from '../../../../stores/useWorkspaceDock';
import { useDockPanels } from '../../../shared/useDockPanels';

export interface WorkspaceDockToggle {
  key: string;
  title: string;
  icon: string;
  active: boolean;
}

export interface WorkspaceDockTogglesViewModel {
  toggles: WorkspaceDockToggle[];
  toggle: (key: string) => void;
}

export const useWorkspaceDockTogglesViewModel = (): WorkspaceDockTogglesViewModel => {
  const { openKey, toggle } = useWorkspaceDock();
  const panels = useDockPanels();

  const toggles = useMemo<WorkspaceDockToggle[]>(() => {
    const activeKey = openKey === null ? null : (panels.find((panel) => panel.key === openKey) ?? panels[0])?.key;
    return panels.map((panel) => ({
      key: panel.key,
      title: panel.title,
      icon: panel.icon ?? 'sparkling',
      active: panel.key === activeKey,
    }));
  }, [panels, openKey]);

  return { toggles, toggle };
};
