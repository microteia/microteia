import React from 'react';
import { RiLockLine } from 'react-icons/ri';
import { useAccessManagementViewModel } from './AccessManagement.viewmodel';
import { UsersTab } from './UsersTab';
import { OfficesTab } from './OfficesTab';
import { S } from './AccessManagement.styles';

import { useT } from '../../shared/i18n/useT';
export const AccessManagementView: React.FC = () => {
  const t = useT('core.admin');
  const vm = useAccessManagementViewModel();

  if (vm.isUnauthorized) {
    return (
      <S.DeniedPage>
        <S.DeniedIcon><RiLockLine /></S.DeniedIcon>
        <S.DeniedTitle>{t('access.denied')}</S.DeniedTitle>
        <S.DeniedSubtitle>{t('access.denied.subtitle')}</S.DeniedSubtitle>
      </S.DeniedPage>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.access-management')}</S.Title>
        <S.Subtitle>{t('access.subtitle')}</S.Subtitle>
      </S.Header>

      <S.TabsBar>
        <S.Tab $active={vm.activeTab === 'users'} onClick={() => vm.setActiveTab('users')}>
          {t('access.tab.users')}
        </S.Tab>
        <S.Tab $active={vm.activeTab === 'offices'} onClick={() => vm.setActiveTab('offices')}>
          {t('access.tab.offices')}
        </S.Tab>
      </S.TabsBar>

      <S.Content>
        {vm.activeTab === 'users' ? <UsersTab /> : <OfficesTab />}
      </S.Content>
    </S.Page>
  );
};
