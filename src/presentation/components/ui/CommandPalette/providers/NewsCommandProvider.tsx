import { RiNewspaperLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';

const contains = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase());

export const NewsCommandProvider: ICommandPaletteProvider = {
  group: 'Notícias',

  getItems(query: string, { news, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];
    return news
      .filter(
        (n) =>
          contains(n.title, query) ||
          contains(n.summary, query),
      )
      .slice(0, 8)
      .map((n) => ({
        id: `news:${n.id}`,
        title: n.title,
        subtitle: n.summary,
        group: 'Notícias',
        icon: <RiNewspaperLine size={16} />,
        onSelect: () => {
          openTab(`view-news:${n.id}`);
          close();
        },
      }));
  },
};
