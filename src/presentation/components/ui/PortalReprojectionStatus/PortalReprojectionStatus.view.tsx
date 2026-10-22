import React from 'react';
import { S } from './PortalReprojectionStatus.styles';
import { InfoBanner } from '../InfoBanner';
import { usePortalReprojectionStatusViewModel } from './PortalReprojectionStatus.viewmodel';

export interface PortalReprojectionStatusProps {
  /** Só esta coleção; ausente, todas as do escritório. */
  collection?: string;
}

/** O andamento da atualização do portal depois que uma declaração mudou. Sem nada a dizer, não desenha. */
export const PortalReprojectionStatus: React.FC<PortalReprojectionStatusProps> = ({ collection }) => {
  const vm = usePortalReprojectionStatusViewModel(collection);
  if (vm.items.length === 0) return null;
  return (
    <S.List>
      {vm.items.map((item) => <InfoBanner key={item.collection} variant={item.variant} message={item.message} />)}
    </S.List>
  );
};
