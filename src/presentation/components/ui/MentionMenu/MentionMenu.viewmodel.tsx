import type React from 'react';
import { RiNewspaperLine, RiFolderOpenLine, RiTeamLine, RiFileTextLine } from 'react-icons/ri';
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
    key: 'case',
    label: 'Processo',
    description: 'Inserir link para um processo',
    icon: RiFolderOpenLine,
  },
  {
    key: 'person',
    label: 'Pessoa',
    description: 'Inserir link para uma pessoa',
    icon: RiTeamLine,
  },
  {
    key: 'contract',
    label: 'Contrato',
    description: 'Inserir link para um contrato',
    icon: RiFileTextLine,
  },
];

export interface MentionMenuProps {
  active: boolean;
  query: string;
  highlightedIndex: number;
  position: { top: number; left: number } | null;
  onSelect: (key: string) => void;
  onHover: (index: number) => void;
}

export interface MentionMenuViewModel {
  filteredCommands: MentionCommand[];
}

export const useMentionMenuViewModel = (props: MentionMenuProps): MentionMenuViewModel => {
  const filteredCommands = useMemo(() => {
    const q = props.query.toLowerCase();
    if (!q) return MENTION_COMMANDS;
    return MENTION_COMMANDS.filter((c) => c.label.toLowerCase().startsWith(q));
  }, [props.query]);

  return { filteredCommands };
};
