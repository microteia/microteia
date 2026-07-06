import type { ICommandPaletteProvider, CommandPaletteAppContext, CommandPaletteItem } from './ICommandPaletteProvider';
import { getWorkflowEventIcon } from '../../../../shared/workflowEventIcons';

const contains = (text: string | null | undefined, query: string) =>
  !!text && text.toLowerCase().includes(query.toLowerCase());

export const WorkflowCommandProvider: ICommandPaletteProvider = {
  group: 'Automações',

  getItems(query: string, { workflows, openTab, close }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!query) return [];
    return workflows
      .filter((w) => contains(w.name, query) || contains(w.eventName, query))
      .slice(0, 8)
      .map((w) => {
        const Icon = getWorkflowEventIcon(w.eventName);
        return {
          id: `workflow:${w.id}`,
          title: w.name,
          subtitle: w.eventName,
          group: 'Automações',
          icon: <Icon size={16} />,
          onSelect: () => {
            openTab(`view-workflow:${w.id}`);
            close();
          },
        };
      });
  },
};
