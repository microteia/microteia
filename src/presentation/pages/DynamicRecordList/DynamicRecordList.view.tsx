import React from 'react';
import { S } from './DynamicRecordList.styles';
import { useDynamicRecordListViewModel } from './DynamicRecordList.viewmodel';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { RecordListSurface } from '../../components/layout/RecordListSurface';

import { useT } from '../../shared/i18n/useT';
export const DynamicRecordListView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const t = useT('core.records');
  const vm = useDynamicRecordListViewModel(tabKey);
  const definition = vm.definition;

  if (!vm.isAvailable || !definition) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>{t('screen.custom')}</S.Title>
        </S.Header>
        <S.BannerWrapper>
          {vm.isLoading ? (
            <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
          ) : (
            <InfoBanner
              variant="info"
              message={t('screen.unavailable')}
            />
          )}
        </S.BannerWrapper>
      </S.Page>
    );
  }

  return <RecordListSurface vm={vm} definition={definition} variant="page" />;
};
