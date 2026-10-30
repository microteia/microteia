import { useMemo } from 'react';
import { useTheme } from 'styled-components';
import { resolveCardNodes } from '../../../shared/entityScreen/resolveCardTemplate';
import type { CardTemplateResolvers, ResolvedCardNode } from '../../../shared/entityScreen/resolveCardTemplate';
import type { CardNode, CardWidth } from '../../../../domain/schema/ui/cardTemplate';
import type { EntityRecord } from '../../../../domain/entities';

export interface RecordCardTemplateProps {
  body: readonly CardNode[];
  record: EntityRecord;
  resolvers: CardTemplateResolvers;
  /** Ícone da TELA — o avatar de um registro sem imagem. */
  screenIcon: string;
  /** Cor da faixa no topo, já resolvida pela listagem (`accent`). */
  accentColor?: string;
  onOpen: () => void;
}

export interface RecordCardTemplateViewModel {
  nodes: ResolvedCardNode[];
  accentColor?: string;
  screenIcon: string;
  /** O lado do avatar em pixels, pelo token do tema — `UserAvatar` recebe número. */
  avatarPixels: Record<CardWidth, number>;
  onOpen: () => void;
}

export const useRecordCardTemplateViewModel = ({
  body,
  record,
  resolvers,
  screenIcon,
  accentColor,
  onOpen,
}: RecordCardTemplateProps): RecordCardTemplateViewModel => {
  const theme = useTheme();
  const nodes = useMemo(() => resolveCardNodes(body, record, resolvers), [body, record, resolvers]);
  const avatarPixels = useMemo<Record<CardWidth, number>>(() => ({
    sm: parseInt(theme.listCard.avatar.sm, 10),
    md: parseInt(theme.listCard.avatar.md, 10),
    lg: parseInt(theme.listCard.avatar.lg, 10),
  }), [theme]);
  return { nodes, accentColor, screenIcon, avatarPixels, onOpen };
};
