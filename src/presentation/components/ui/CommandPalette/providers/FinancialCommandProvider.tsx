import { RiMoneyDollarCircleLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const FinancialCommandProvider: ICommandPaletteProvider = {
  group: 'Financeiro',

  getItems(query: string, { financials, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];
    return financials
      .filter(
        (f) =>
          contains(f.category, query) ||
          contains(f.caseNumber, query) ||
          contains(f.personName, query) ||
          contains(f.contractNumber, query),
      )
      .slice(0, 8)
      .map((f) => ({
        id: `financial:${f.id}`,
        title: f.category,
        subtitle: `${f.type} · ${f.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        group: 'Financeiro',
        icon: <RiMoneyDollarCircleLine size={16} />,
        onSelect: () => {
          openTab(`view-financial:${f.id}`);
          close();
        },
      }));
  },
};
