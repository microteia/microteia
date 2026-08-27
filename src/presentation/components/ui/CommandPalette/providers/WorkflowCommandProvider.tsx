import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { getWorkflowEventIcon } from '../../../../shared/workflowEventIcons';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const WorkflowCommandProvider: ICommandPaletteProvider = {
  group: '@core.automation/command.group',

  getItems(query: string, { workflows, openTab, close, label }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];
    return workflows
      // A comparação é com o nome RESOLVIDO, pelo mesmo motivo da tela de extensão: o fluxo que a
      // extensão instalou declara `@ns/chave`, e casar a query contra a chave o deixava inalcançável.
      .filter((w) => contains(label(w.name), query) || contains(w.eventName, query))
      .slice(0, 8)
      .map((w) => {
        const Icon = getWorkflowEventIcon(w.eventName);
        return {
          id: `workflow:${w.id}`,
          title: w.name,
          subtitle: w.eventName,
          group: '@core.automation/command.group',
          icon: <Icon size={16} />,
          onSelect: () => {
            openTab(`view-workflow:${w.id}`);
            close();
          },
        };
      });
  },
};
