import React from 'react';
import { RiLockLine } from 'react-icons/ri';
import { useAccessManagementViewModel } from './AccessManagement.viewmodel';
import { UsersTab } from './UsersTab';
import { OfficesTab } from './OfficesTab';
import { S } from './AccessManagement.styles';

export const AccessManagementView: React.FC = () => {
  const vm = useAccessManagementViewModel();

  if (vm.isUnauthorized) {
    return (
      <S.DeniedPage>
        <S.DeniedIcon><RiLockLine /></S.DeniedIcon>
        <S.DeniedTitle>Acesso Negado</S.DeniedTitle>
        <S.DeniedSubtitle>
          Apenas administradores podem acessar a Gestão de Acessos.
        </S.DeniedSubtitle>
      </S.DeniedPage>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>Gestão de Acessos</S.Title>
        <S.Subtitle>Gerencie as permissões dos usuários e os limites de cada escritório</S.Subtitle>
      </S.Header>

      <S.TabsBar>
        <S.Tab $active={vm.activeTab === 'users'} onClick={() => vm.setActiveTab('users')}>
          Usuários
        </S.Tab>
        <S.Tab $active={vm.activeTab === 'offices'} onClick={() => vm.setActiveTab('offices')}>
          Escritórios
        </S.Tab>
      </S.TabsBar>

      <S.Content>
        {vm.activeTab === 'users' ? <UsersTab /> : <OfficesTab />}
      </S.Content>
    </S.Page>
  );
};
