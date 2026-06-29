import {
  RiMoonLine,
  RiSunLine,
  RiLogoutBoxLine,
  RiUserLine,
  RiRobot2Line,
  RiPaletteLine,
} from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import type { ThemeMode } from '../../../../../shared/types';

const contains = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase());

const THEME_OPTIONS: { mode: ThemeMode; label: string; light: boolean }[] = [
  { mode: 'curatino', label: 'Tema Curatino', light: false },
  { mode: 'dark',     label: 'Tema Escuro',   light: false },
  { mode: 'light',    label: 'Tema Claro',    light: true  },
  { mode: 'claude',   label: 'Tema Claude',   light: true  },
  { mode: 'teams',    label: 'Tema Teams',    light: false },
  { mode: 'bruma',    label: 'Tema Bruma',    light: true  },
  { mode: 'kindle',   label: 'Tema Kindle',   light: true  },
];

const THEME_KEYWORDS = ['tema', 'theme', 'aparência', 'cor', 'cores', 'escuro', 'claro', 'dark', 'light'];

const isThemeQuery = (query: string) =>
  THEME_KEYWORDS.some((kw) => contains(kw, query) || contains(query, kw));

export const SystemCommandProvider: ICommandPaletteProvider = {
  group: 'Sistema',

  getItems(query: string, { mode, setTheme, signOut, openTab, close, tenantRole }: CommandPaletteAppContext): CommandPaletteItem[] {
    const items: CommandPaletteItem[] = [];

    if (!query || contains('perfil', query) || contains('profile', query)) {
      items.push({
        id: 'sys:profile',
        title: 'Meu Perfil',
        group: 'Sistema',
        icon: <RiUserLine size={16} />,
        onSelect: () => { openTab('profile'); close(); },
      });
    }

    if (tenantRole === 'admin' && (!query || contains('ia', query) || contains('ai', query) || contains('inteligência', query) || contains('conexão', query))) {
      items.push({
        id: 'sys:ai',
        title: 'Conexão de IA',
        group: 'Sistema',
        icon: <RiRobot2Line size={16} />,
        onSelect: () => { openTab('tenant-settings:ai'); close(); },
      });
    }

    if (!query || isThemeQuery(query)) {
      if (query && isThemeQuery(query)) {
        for (const opt of THEME_OPTIONS) {
          if (opt.mode !== mode && contains(opt.label.toLowerCase(), query.toLowerCase().replace(/tema\s*/, '').trim() || '')) {
            items.push({
              id: `sys:theme:${opt.mode}`,
              title: opt.label,
              subtitle: mode === opt.mode ? 'Tema atual' : undefined,
              group: 'Sistema',
              icon: opt.light ? <RiSunLine size={16} /> : <RiMoonLine size={16} />,
              keywords: ['tema', 'aparência'],
              onSelect: () => { setTheme(opt.mode); close(); },
            });
          }
        }
        if (!items.some((i) => i.id.startsWith('sys:theme:'))) {
          for (const opt of THEME_OPTIONS) {
            if (opt.mode !== mode) {
              items.push({
                id: `sys:theme:${opt.mode}`,
                title: opt.label,
                group: 'Sistema',
                icon: opt.light ? <RiSunLine size={16} /> : <RiMoonLine size={16} />,
                keywords: ['tema', 'aparência'],
                onSelect: () => { setTheme(opt.mode); close(); },
              });
            }
          }
        }
      } else {
        items.push({
          id: 'sys:theme',
          title: 'Alterar tema',
          subtitle: 'Digite "tema" para ver opções',
          group: 'Sistema',
          icon: <RiPaletteLine size={16} />,
          onSelect: () => {},
        });
      }
    }

    if (!query || contains('sair', query) || contains('logout', query) || contains('desconectar', query)) {
      items.push({
        id: 'sys:signout',
        title: 'Sair',
        subtitle: 'Encerrar sessão',
        group: 'Sistema',
        icon: <RiLogoutBoxLine size={16} />,
        keywords: ['sair', 'logout'],
        onSelect: () => { close(); void signOut(); },
      });
    }

    return items;
  },
};
