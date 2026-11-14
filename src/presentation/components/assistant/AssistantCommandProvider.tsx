import { RiChatNewLine } from 'react-icons/ri';
import type {
  CommandPaletteAppContext,
  CommandPaletteItem,
  ICommandPaletteProvider,
} from '../ui/CommandPalette/providers/ICommandPaletteProvider';
import { ASSISTANT_DOCK_PANEL_KEY, ASSISTANT_NEW_CONVERSATION_INTENT } from './assistantItems';

const GROUP = '@core.workspace/command.group.panels';

const contains = (text: string, query: string) => text.toLowerCase().includes(query.toLowerCase());

/**
 * "Nova conversa com o assistente" no ⌘K. Só aparece quando o painel do assistente está entre os do
 * dock desta pessoa — a mesma conta de permissão e de function no ar que mostra o botão.
 */
export const AssistantCommandProvider: ICommandPaletteProvider = {
  group: GROUP,

  getItems(query: string, { dockPanels, openDock, close, t }: CommandPaletteAppContext): CommandPaletteItem[] {
    if (!dockPanels.some((panel) => panel.key === ASSISTANT_DOCK_PANEL_KEY)) return [];
    const title = t('core.assistant/command.palette.new');
    const keywords = t('core.assistant/command.palette.new.keywords').split(',').map((word) => word.trim()).filter(Boolean);
    if (query && !contains(title, query) && !keywords.some((word) => contains(word, query) || contains(query, word))) return [];
    return [{
      id: 'assistant:new',
      title,
      group: GROUP,
      icon: <RiChatNewLine size={16} />,
      keywords,
      onSelect: () => { openDock(ASSISTANT_DOCK_PANEL_KEY, ASSISTANT_NEW_CONVERSATION_INTENT); close(); },
    }];
  },
};
