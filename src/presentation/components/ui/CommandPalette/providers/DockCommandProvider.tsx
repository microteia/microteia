import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { getScreenIcon } from '../../../../shared/screenIcons';

const GROUP = '@core.workspace/command.group.panels';

const contains = (text: string, query: string) => text.toLowerCase().includes(query.toLowerCase());

/**
 * Um item por painel do dock — "Abrir <painel>". Não conhece painel nenhum: lê os que o dock
 * oferece a esta pessoa, já filtrados por permissão e por function no ar.
 */
export const DockCommandProvider: ICommandPaletteProvider = {
  group: GROUP,

  getItems(query: string, { dockPanels, openDock, close, t }: CommandPaletteAppContext): CommandPaletteItem[] {
    return dockPanels
      .filter((panel) => !query || contains(panel.title, query) || contains(t('core.workspace/command.dock.open', { title: panel.title }), query))
      .map((panel) => ({
        id: `dock:${panel.key}`,
        title: '@core.workspace/command.dock.open',
        titleParams: { title: panel.title },
        group: GROUP,
        icon: getScreenIcon(panel.icon ?? 'sparkling', 16),
        keywords: [panel.title],
        onSelect: () => { openDock(panel.key); close(); },
      }));
  },
};
