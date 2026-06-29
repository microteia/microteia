import React from 'react';
import { RiPriceTag3Line } from 'react-icons/ri';
import { S } from './TagIconButton.styles';

export interface TagIconButtonProps {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}

export const TagIconButton: React.FC<TagIconButtonProps> = ({ onClick }) => (
  <S.Btn type="button" onClick={onClick} title="Gerenciar etiquetas">
    <RiPriceTag3Line size={15} />
  </S.Btn>
);
