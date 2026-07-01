import { RiFileTextLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const ContractCommandProvider: ICommandPaletteProvider = {
  group: 'Contratos',

  getItems(query: string, { contracts, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];
    return contracts
      .filter(
        (c) =>
          contains(c.title, query) ||
          contains(c.number, query),
      )
      .slice(0, 8)
      .map((c) => ({
        id: `contract:${c.id}`,
        title: c.title,
        subtitle: c.number,
        group: 'Contratos',
        icon: <RiFileTextLine size={16} />,
        onSelect: () => {
          openTab(`view-contract:${c.id}`);
          close();
        },
      }));
  },
};
