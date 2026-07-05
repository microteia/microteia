import { RiMoneyDollarCircleLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const FinancialCommandProvider: ICommandPaletteProvider = {
  group: 'Financeiro',

  getItems(query: string, { financials, cases, persons, contracts, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];
    const caseById: Record<string, string> = {};
    cases.forEach((c) => { caseById[c.id] = c.caseNumber; });
    const personById: Record<string, string> = {};
    persons.forEach((p) => { personById[p.id] = p.name; });
    const contractById: Record<string, string> = {};
    contracts.forEach((c) => { contractById[c.id] = c.number; });
    return financials
      .filter(
        (f) =>
          contains(f.category, query) ||
          contains(f.caseId ? caseById[f.caseId] : undefined, query) ||
          contains(f.personId ? personById[f.personId] : undefined, query) ||
          contains(f.contractId ? contractById[f.contractId] : undefined, query),
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
