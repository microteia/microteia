import React from 'react';
import { RiPriceTag3Line } from 'react-icons/ri';
import { S } from './TagIconButton.styles';

import { useT } from '../../../shared/i18n/useT';

export interface TagIconButtonProps {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}

export const TagIconButton: React.FC<TagIconButtonProps> = ({ onClick }) => {
  const t = useT('core.ui');

  return (
  <S.Btn type="button" onClick={onClick} title={t('core.records/action.manage-tags')}>
    <RiPriceTag3Line size={15} />
  </S.Btn>
  );
};
