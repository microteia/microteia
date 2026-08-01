import { RiLayoutGridLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { buildListTabKey, buildViewTabKey } from '../../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../../shared/screenIcons';
import { resolveRecordTitle } from '../../../../../domain/services/customFieldValues';
import { isOwnedByParentScreen } from '../../../../../domain/services/screenDataCollection';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const DynamicRecordCommandProvider: ICommandPaletteProvider = {
  group: 'Telas Personalizadas',

  getItems(query: string, { screenDefinitions, records, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];

    // Telas filhas existem só dentro do registro-pai: ficam fora do ⌘K, e como `screenByKey`
    // limita os registros, os filhos também não aparecem na busca.
    const enabledScreens = screenDefinitions.filter(
      (def) => def.origin !== 'builtin' && def.enabled && !isOwnedByParentScreen(def),
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

    const recordItems: CommandPaletteItem[] = records
      .map((record) => {
        const screen = screenByKey.get(record.collection);
        return { record, screen, title: resolveRecordTitle(record, screen?.titleFieldKey ?? '') };
      })
      .filter(({ screen, title }) => !!screen && contains(title, query))
      .slice(0, 8)
      .map(({ record, screen, title }) => {
        return {
          id: `dyn-record:${record.id}`,
          title,
          subtitle: screen?.titleSingular,
          group: 'Telas Personalizadas',
          icon: screen ? getScreenIcon(screen.icon, 16) : <RiLayoutGridLine size={16} />,
          onSelect: () => {
            openTab(buildViewTabKey(record.collection, record.id));
            close();
          },
        };
      });

    return [...navigationItems, ...recordItems];
  },
};
