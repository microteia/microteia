import { RiLayoutGridLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { buildListTabKey, buildViewTabKey } from '../../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../../shared/screenIcons';
import { resolveRecordTitle } from '../../../../../domain/services/customFieldValues';
import { isOwnedByParentScreen, screenReadPermission } from '../../../../../domain/services/screenDataCollection';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const DynamicRecordCommandProvider: ICommandPaletteProvider = {
  group: '@core.records/command.group',

  getItems(query: string, { screenDefinitions, records, recordMatches, openTab, close, label, can }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];

    // Telas filhas existem só dentro do registro-pai: ficam fora do ⌘K, e como `screenByKey`
    // limita os registros, os filhos também não aparecem na busca.
    //
    // Sem permissão de LER a coleção a tela também sai daqui, pelo mesmo motivo que sai do menu: o
    // ⌘K é o outro caminho de descoberta, e esconder a tela num só deixava a promessa vazia de pé.
    const enabledScreens = screenDefinitions.filter(
      (def) => def.origin !== 'builtin'
        && def.enabled
        && !isOwnedByParentScreen(def)
        && can(screenReadPermission(def)),
    );
    // `hideRecordsFromCommandPalette` tira só os REGISTROS: o "Abrir <tela>" fica, porque numa tela
    // que também declara `hideFromSidebar` ele é a última entrada que sobra para ela.
    const screenByKey = new Map(
      enabledScreens
        .filter((def) => !def.hideRecordsFromCommandPalette)
        .map((def) => [def.id, def]),
    );

    const navigationItems: CommandPaletteItem[] = enabledScreens
      // A comparação é com o rótulo RESOLVIDO: a tela de uma extensão declara `@ns/chave`, e casar a
      // query contra a chave deixava a tela inalcançável para quem digita o nome que lê na tela.
      .filter((def) => contains(label(def.titlePlural), query) || contains(label(def.titleSingular), query))
      .map((def) => ({
        id: `dyn-screen:${def.id}`,
        title: '@core.records/command.open',
        titleParams: { name: def.titlePlural },
        group: '@core.records/command.group',
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
      .map((entry) => ({ ...entry, byTitle: contains(entry.title, query) }))
      .filter(({ record, screen, byTitle }) => !!screen && (byTitle || recordMatches.has(`${record.collection}/${record.id}`)))
      // O que casa pelo título vem antes: é o que a pessoa reconhece de relance. O que o servidor achou
      // por outro campo vem depois, e é o que antes não aparecia de jeito nenhum.
      .sort((left, right) => Number(right.byTitle) - Number(left.byTitle))
      .slice(0, 8)
      .map(({ record, screen, title }) => {
        return {
          id: `dyn-record:${record.id}`,
          title,
          subtitle: label(screen?.titleSingular),
          group: '@core.records/command.group',
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
