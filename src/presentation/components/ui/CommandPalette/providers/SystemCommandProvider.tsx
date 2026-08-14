import {
  RiMoonLine,
  RiSunLine,
  RiLogoutBoxLine,
  RiUserLine,
  RiRobot2Line,
  RiPaletteLine,
  RiTeamLine,
} from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import type { TranslateFn } from '../../../../shared/i18n/useT';
import type { ThemeMode } from '../../../../../shared/types';

const GROUP = '@core.workspace/command.group.system';

const contains = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase());

/**
 * As palavras pelas quais o ⌘K encontra um item vêm do CATÁLOGO, separadas por vírgula. Buscar é
 * parte da tradução: quem usa o sistema em português procura por "aparência", e nenhuma tradução do
 * rótulo faria essa palavra casar sozinha.
 */
const keywordsOf = (t: TranslateFn, key: string): string[] =>
  t(key).split(',').map((word) => word.trim()).filter((word) => word !== '');

const matchesAny = (t: TranslateFn, key: string, query: string) =>
  keywordsOf(t, key).some((word) => contains(word, query) || contains(query, word));

const THEME_MODES: { mode: ThemeMode; key: string; light: boolean }[] = [
  { mode: 'microteia', key: 'theme.microteia', light: false },
  { mode: 'dark', key: 'theme.dark', light: false },
  { mode: 'light', key: 'theme.light', light: true },
  { mode: 'claude', key: 'theme.claude', light: true },
  { mode: 'teams', key: 'theme.teams', light: false },
  { mode: 'bruma', key: 'theme.bruma', light: true },
  { mode: 'kindle', key: 'theme.kindle', light: true },
  { mode: 'themis', key: 'theme.themis', light: true },
  { mode: 'themisDark', key: 'theme.themis-dark', light: false },
];

export const SystemCommandProvider: ICommandPaletteProvider = {
  group: GROUP,

  getItems(query: string, { mode, setTheme, signOut, openTab, close, tenantRole, t }: CommandPaletteAppContext): CommandPaletteItem[] {
    const items: CommandPaletteItem[] = [];
    const themes = THEME_MODES.map((option) => ({ ...option, label: t(option.key) }));
    const isThemeQuery = (value: string) => matchesAny(t, 'command.system.theme.keywords', value);

    if (!query || matchesAny(t, 'command.system.profile.keywords', query)) {
      items.push({
        id: 'sys:profile',
        title: t('core.workspace/page.profile'),
        group: GROUP,
        icon: <RiUserLine size={16} />,
        onSelect: () => { openTab('profile'); close(); },
      });
    }

    if (tenantRole === 'admin' && (!query || matchesAny(t, 'command.system.members.keywords', query))) {
      items.push({
        id: 'sys:members',
        title: t('command.system.members'),
        group: GROUP,
        icon: <RiTeamLine size={16} />,
        onSelect: () => { openTab('tenant-settings:members'); close(); },
      });
    }

    if (tenantRole === 'admin' && (!query || matchesAny(t, 'command.system.ai.keywords', query))) {
      items.push({
        id: 'sys:ai',
        title: t('command.system.ai'),
        group: GROUP,
        icon: <RiRobot2Line size={16} />,
        onSelect: () => { openTab('tenant-settings:ai'); close(); },
      });
    }

    if (!query || isThemeQuery(query)) {
      if (query && isThemeQuery(query)) {
        const bare = query.toLowerCase().replace(t('command.system.theme.prefix').toLowerCase(), '').trim();
        for (const option of themes) {
          if (option.mode !== mode && contains(option.label.toLowerCase(), bare)) {
            items.push({
              id: `sys:theme:${option.mode}`,
              title: option.label,
              subtitle: mode === option.mode ? t('command.system.theme.current') : undefined,
              group: GROUP,
              icon: option.light ? <RiSunLine size={16} /> : <RiMoonLine size={16} />,
              keywords: keywordsOf(t, 'command.system.theme.keywords'),
              onSelect: () => { setTheme(option.mode); close(); },
            });
          }
        }
        if (!items.some((item) => item.id.startsWith('sys:theme:'))) {
          for (const option of themes) {
            if (option.mode !== mode) {
              items.push({
                id: `sys:theme:${option.mode}`,
                title: option.label,
                group: GROUP,
                icon: option.light ? <RiSunLine size={16} /> : <RiMoonLine size={16} />,
                keywords: keywordsOf(t, 'command.system.theme.keywords'),
                onSelect: () => { setTheme(option.mode); close(); },
              });
            }
          }
        }
      } else {
        items.push({
          id: 'sys:theme',
          title: t('command.system.theme'),
          subtitle: t('command.system.theme.subtitle'),
          group: GROUP,
          icon: <RiPaletteLine size={16} />,
          onSelect: () => {},
        });
      }
    }

    if (!query || matchesAny(t, 'command.system.signout.keywords', query)) {
      items.push({
        id: 'sys:signout',
        title: t('command.system.signout'),
        subtitle: t('command.system.signout.subtitle'),
        group: GROUP,
        icon: <RiLogoutBoxLine size={16} />,
        keywords: keywordsOf(t, 'command.system.signout.keywords'),
        onSelect: () => { close(); void signOut(); },
      });
    }

    return items;
  },
};
