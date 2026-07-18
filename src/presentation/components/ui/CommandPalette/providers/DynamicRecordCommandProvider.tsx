import { RiLayoutGridLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { buildListTabKey, buildViewTabKey } from '../../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../../shared/screenIcons';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const DynamicRecordCommandProvider: ICommandPaletteProvider = {
  group: 'Telas Personalizadas',

  getItems(query: string, { screenDefinitions, customRecords, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];

    // Telas filhas existem só dentro do registro-pai: ficam fora do ⌘K, e como `screenByKey`
    // limita os registros, os filhos também não aparecem na busca.
    const enabledScreens = screenDefinitions.filter(
      (def) => !def.builtin && def.enabled && !def.parentEntity,
    );
    const screenByKey = new Map(enabledScreens.map((def) => [def.id, def]));

    const navigationItems: CommandPaletteItem[] = enabledScreens
      .filter((def) => contains(def.titlePlural, query) || contains(def.titleSingular, query))
      .map((def) => ({
        id: `dyn-screen:${def.id}`,
        title: `Abrir ${def.titlePlural}`,
        group: 'Telas Personalizadas',
        icon: getScreenIcon(def.icon, 16),
        onSelect: () => {
          openTab(buildListTabKey(def.id));
          close();
        },
      }));

    const recordItems: CommandPaletteItem[] = customRecords
      .filter((record) => screenByKey.has(record.screenKey) && contains(record.title, query))
      .slice(0, 8)
      .map((record) => {
        const screen = screenByKey.get(record.screenKey);
        return {
          id: `dyn-record:${record.id}`,
          title: record.title,
          subtitle: screen?.titleSingular,
          group: 'Telas Personalizadas',
          icon: screen ? getScreenIcon(screen.icon, 16) : <RiLayoutGridLine size={16} />,
          onSelect: () => {
            openTab(buildViewTabKey(record.screenKey, record.id));
            close();
          },
        };
      });

    return [...navigationItems, ...recordItems];
  },
};
