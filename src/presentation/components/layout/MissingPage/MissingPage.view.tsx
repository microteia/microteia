import React from 'react';
import { RiErrorWarningLine } from 'react-icons/ri';
import { InfoBanner } from '../../ui/InfoBanner';
import { useMissingPageViewModel, type MissingPageProps } from './MissingPage.viewmodel';
import { S } from './MissingPage.styles';

export const MissingPage: React.FC<MissingPageProps> = (props) => {
  const vm = useMissingPageViewModel(props);
  return (
    <S.Root role="alert">
      <S.Icon><RiErrorWarningLine /></S.Icon>
      <S.Title>{vm.title}</S.Title>
      <S.Detail>
        <InfoBanner message={vm.detail} variant="warning" />
      </S.Detail>
    </S.Root>
  );
};
