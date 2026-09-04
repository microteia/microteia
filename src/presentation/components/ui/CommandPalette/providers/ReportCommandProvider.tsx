import { RiFileChartLine } from 'react-icons/ri';
import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { collectionPermissionId } from '../../../../../domain/schema/access';
import { buildReportTabKey } from '../../../../../shared/constants/reportKeys';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

/**
 * Os RELATÓRIOS no ⌘K.
 *
 * A busca compara o nome RESOLVIDO, e não a chave declarada: um relatório que veio de extensão diz
 * `@ns/chave` no título, e casar a query contra isso o deixaria inalcançável — o mesmo motivo pelo
 * qual o provedor de automações resolve antes de comparar.
 *
 * O que ele NÃO oferece é o relatório que esta pessoa não poderia executar. A pergunta é a mesma da
 * lista e a mesma do servidor: a leitura de cada coleção que o relatório toca. Oferecer aqui o que a
 * callable vai recusar seria abrir uma porta fechada.
 */
export const ReportCommandProvider: ICommandPaletteProvider = {
  group: '@core.reports/command.group',

  getItems(query: string, { reports, can, openTab, close, label }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];

    return reports
      .filter((report) => report.enabled !== false)
      .filter((report) => report.collections.every((collection) =>
        can(collectionPermissionId(collection, 'read'))))
      .filter((report) => contains(label(report.title), query) || contains(report.key, query))
      .slice(0, 8)
      .map((report) => ({
        id: `report:${report.key}`,
        title: report.title,
        subtitle: report.covers,
        group: '@core.reports/command.group',
        icon: <RiFileChartLine size={16} />,
        keywords: [report.key],
        onSelect: () => {
          openTab(buildReportTabKey(report.key));
          close();
        },
      }));
  },
};
