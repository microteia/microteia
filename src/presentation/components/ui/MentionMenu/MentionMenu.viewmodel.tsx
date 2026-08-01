import type React from 'react';
import { RiNewspaperLine, RiFileTextLine, RiFlowChart } from 'react-icons/ri';
import { useMemo } from 'react';

export interface MentionCommand {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}

export const MENTION_COMMANDS: MentionCommand[] = [
  {
    key: 'news',
    label: 'Notícia',
    description: 'Inserir link para uma notícia',
    icon: RiNewspaperLine,
  },
  {
    key: 'contract',
    label: 'Contrato',
    description: 'Inserir link para um contrato',
    icon: RiFileTextLine,
  },
  {
    key: 'workflow',
    label: 'Automação',
    description: 'Inserir link para uma automação',
    icon: RiFlowChart,
  },
];

export interface MentionMenuProps {
  active: boolean;
  query: string;
  highlightedIndex: number;
  position: { top: number; left: number } | null;
  onSelect: (key: string) => void;
  onHover: (index: number) => void;
  /** Comandos disponíveis (nativos + registrados por extensões). Ausente → só os nativos. */
  commands?: MentionCommand[];
}

export interface MentionMenuViewModel {
  filteredCommands: MentionCommand[];
}

export const useMentionMenuViewModel = (props: MentionMenuProps): MentionMenuViewModel => {
  const commands = props.commands ?? MENTION_COMMANDS;
  const filteredCommands = useMemo(() => {
    const q = props.query.toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().startsWith(q));
  }, [props.query, commands]);

  return { filteredCommands };
};
