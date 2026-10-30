import React from 'react';
import { S } from './PortalCardList.styles';
import { PortalTemplateNodes } from '../PortalTemplateNodes';
import type { PortalRecordCard } from '../../Portal.viewmodel';
import type { PortalCardArrangement } from '../../resolvePortalTemplate';

export interface PortalCardListProps {
  cards: PortalRecordCard[];
  arrangement: PortalCardArrangement;
  onOpen: (collection: string, id: string) => void;
}

/**
 * Os cartões de uma tela que declara o próprio cartão (`portal.template.card`) — na lista de topo e na
 * aba de filhos, o mesmo desenho. O cartão inteiro abre o registro.
 */
export const PortalCardList: React.FC<PortalCardListProps> = ({ cards, arrangement, onOpen }) => (
  <S.List $layout={arrangement.layout} $minWidth={arrangement.minWidth}>
    {cards.map((card) => (
      <S.Card key={card.id} type="button" $accent={card.accentColor ?? undefined} onClick={() => onOpen(card.collection, card.id)}>
        <PortalTemplateNodes nodes={card.nodes ?? []} />
      </S.Card>
    ))}
  </S.List>
);
