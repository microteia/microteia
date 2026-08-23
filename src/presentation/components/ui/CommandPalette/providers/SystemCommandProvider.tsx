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
import { PERMISSION_AI_MANAGE, PERMISSION_MEMBERS_MANAGE } from '../../../../../domain/schema/access';

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

export const SystemCommandProvider: ICommandPaletteProvider = {
  group: GROUP,

  getItems(query: string, { themeId, themes, setTheme, signOut, openTab, close, can, t }: CommandPaletteAppContext): CommandPaletteItem[] {
    const items: CommandPaletteItem[] = [];
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

    if (can(PERMISSION_MEMBERS_MANAGE) && (!query || matchesAny(t, 'command.system.members.keywords', query))) {
      items.push({
        id: 'sys:members',
        title: t('command.system.members'),
        group: GROUP,
        icon: <RiTeamLine size={16} />,
        onSelect: () => { openTab('tenant-settings:members'); close(); },
      });
    }

    if (can(PERMISSION_AI_MANAGE) && (!query || matchesAny(t, 'command.system.ai.keywords', query))) {
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
        /**
         * A busca casa pelo NOME do tema, e o nome vem da contribuição — a paleta deixou de ter uma
         * lista de temas em código, então ela funciona igual para um tema que o escritório escreveu
         * ontem. Sem nenhum nome batendo, oferece todos: quem digitou "tema" quer ver a lista.
         */
        const bare = query.toLowerCase().replace(t('command.system.theme.prefix').toLowerCase(), '').trim();
        const matching = themes.filter((option) => contains(option.name.toLowerCase(), bare));
        const offered = matching.length > 0 ? matching : themes;
        for (const option of offered) {
          if (option.id === themeId) continue;
          items.push({
            id: `sys:theme:${option.id}`,
            title: option.name,
            group: GROUP,
            icon: option.base === 'light' ? <RiSunLine size={16} /> : <RiMoonLine size={16} />,
            keywords: keywordsOf(t, 'command.system.theme.keywords'),
            onSelect: () => { setTheme(option.id); close(); },
          });
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
