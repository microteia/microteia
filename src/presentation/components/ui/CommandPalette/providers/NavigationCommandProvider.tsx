import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { getScreenIcon } from '../../../../shared/screenIcons';

const contains = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase());

export const NavigationCommandProvider: ICommandPaletteProvider = {
  group: 'Navegação',

  getItems(query: string, { openTab, close, navigablePages }: CommandPaletteAppContext): CommandPaletteItem[] {
    const filtered = query
      ? navigablePages.filter((page) => contains(page.title, query) || contains(page.key, query))
      : navigablePages;

    return filtered.map((page) => ({
      id: `nav:${page.key}`,
      title: page.title,
      group: 'Navegação',
      icon: getScreenIcon(page.icon, 20),
      keywords: [page.key],
      onSelect: () => {
        openTab(page.key);
        close();
      },
    }));
  },
};
