import { RiFolderLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const CaseCommandProvider: ICommandPaletteProvider = {
  group: 'Processos',

  getItems(query: string, { cases, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];
    return cases
      .filter(
        (c) =>
          contains(c.title, query) ||
          contains(c.caseNumber, query) ||
          contains(c.personName, query),
      )
      .slice(0, 8)
      .map((c) => ({
        id: `case:${c.id}`,
        title: c.title,
        subtitle: [c.caseNumber, c.personName].filter(Boolean).join(' · '),
        group: 'Processos',
        icon: <RiFolderLine size={16} />,
        onSelect: () => {
          openTab(`view-case:${c.id}`);
          close();
        },
      }));
  },
};
