import { RiTeamLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const PersonCommandProvider: ICommandPaletteProvider = {
  group: 'Pessoas',

  getItems(query: string, { persons, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];
    return persons
      .filter(
        (c) =>
          contains(c.name, query) ||
          contains(c.cpf, query) ||
          contains(c.cnpj, query) ||
          contains(c.email, query) ||
          contains(c.phone, query),
      )
      .slice(0, 8)
      .map((c) => ({
        id: `person:${c.id}`,
        title: c.name,
        subtitle: c.type === 'Pessoa Física'
          ? [c.cpf, c.email].filter(Boolean).join(' · ')
          : [c.cnpj, c.email].filter(Boolean).join(' · '),
        group: 'Pessoas',
        icon: <RiTeamLine size={16} />,
        onSelect: () => {
          openTab(`view-person:${c.id}`);
          close();
        },
      }));
  },
};
