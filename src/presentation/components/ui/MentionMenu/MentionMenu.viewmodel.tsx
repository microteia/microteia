import type React from 'react';
import { RiFlowChart } from 'react-icons/ri';
import { useMemo } from 'react';
import { useT, type TranslateFn } from '../../../shared/i18n/useT';

export interface MentionCommand {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}

export const mentionCommands = (t: TranslateFn): MentionCommand[] => [
  {
    key: 'workflow',
    label: t('mention.workflow.label'),
    description: t('mention.workflow.description'),
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
  const t = useT('core.ui');
  const commands = props.commands ?? mentionCommands(t);
  const filteredCommands = useMemo(() => {
    const q = props.query.toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().startsWith(q));
  }, [props.query, commands]);

  return { filteredCommands };
};
