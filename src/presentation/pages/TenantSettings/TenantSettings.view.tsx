import React from 'react';
import { S } from './TenantSettings.styles';
import { useTenantSettingsViewModel } from './TenantSettings.viewmodel';
import { OfficeTab } from './OfficeTab';
import { MembersTab } from './MembersTab';
import { AITab } from './AITab';
import { PushTab } from './PushTab';

export const TenantSettingsView: React.FC<{ tabKey?: string }> = ({ tabKey }) => {
  const initialTab =
    tabKey === 'tenant-settings:ai'
      ? 'ai'
      : tabKey === 'tenant-settings:members'
        ? 'members'
        : tabKey === 'tenant-settings:push'
          ? 'push'
          : 'office';

  const vm = useTenantSettingsViewModel(initialTab);

  return (
    <S.Page>
      <S.Header>
        <S.Title>Configurações do Escritório</S.Title>
      </S.Header>

      <S.TabsBar>
        <S.Tab $active={vm.activeTab === 'office'} onClick={() => vm.setActiveTab('office')}>
          Dados do Escritório
        </S.Tab>
        {vm.isAdmin && (
          <S.Tab $active={vm.activeTab === 'members'} onClick={() => vm.setActiveTab('members')}>
            Membros
          </S.Tab>
        )}
        {vm.isAdmin && (
          <S.Tab $active={vm.activeTab === 'ai'} onClick={() => vm.setActiveTab('ai')}>
            Conexão IA
          </S.Tab>
        )}
        {vm.isAdmin && (
          <S.Tab $active={vm.activeTab === 'push'} onClick={() => vm.setActiveTab('push')}>
            Push
          </S.Tab>
        )}
      </S.TabsBar>

      <S.Content>
        {vm.activeTab === 'office' && (
          <S.Section>
            <S.SectionBody>
              <OfficeTab />
            </S.SectionBody>
          </S.Section>
        )}

        {vm.activeTab === 'members' && vm.isAdmin && (
          <S.Section>
            <MembersTab />
          </S.Section>
        )}

        {vm.activeTab === 'ai' && vm.isAdmin && (
          <S.Section>
            <S.SectionBody>
              <AITab />
            </S.SectionBody>
          </S.Section>
        )}

        {vm.activeTab === 'push' && vm.isAdmin && (
          <S.Section>
            <S.SectionBody>
              <PushTab />
            </S.SectionBody>
          </S.Section>
        )}
      </S.Content>
    </S.Page>
  );
};
