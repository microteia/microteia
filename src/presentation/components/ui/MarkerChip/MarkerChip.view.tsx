import React from 'react';
import { S } from './MarkerChip.styles';

export interface MarkerChipProps {
  color: string;
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export const MarkerChip: React.FC<MarkerChipProps> = ({ color, active, onClick, children }) => (
  <S.Chip type="button" $color={color} $active={active} onClick={onClick}>
    {children}
  </S.Chip>
);
