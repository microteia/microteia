import React from 'react';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { PAGE_REGISTRY } from '../../../../pages/pageRegistry';

const contains = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase());

export const NavigationCommandProvider: ICommandPaletteProvider = {
  group: 'Navegação',

  getItems(query: string, { openTab, close, userRole }: CommandPaletteAppContext): CommandPaletteItem[] {
    const navigable = PAGE_REGISTRY.filter((p) => {
      if (!p.key || p.keyPrefix) return false;
      if (p.requiredRole && userRole !== p.requiredRole && userRole !== 'SYSTEM') return false;
      return true;
    });

    const filtered = query
      ? navigable.filter((p) => {
          const title = typeof p.title === 'string' ? p.title : p.title('');
          return contains(title, query) || contains(p.key, query);
        })
      : navigable;

    return filtered.map((p) => ({
      id: `nav:${p.key}`,
      title: typeof p.title === 'string' ? p.title : p.title(''),
      group: 'Navegação',
      icon: p.icon as React.ReactNode,
      keywords: [p.key],
      onSelect: () => {
        openTab(p.key);
        close();
      },
    }));
  },
};
