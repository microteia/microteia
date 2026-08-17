import React from 'react';
import { S } from './TenantSettings.styles';
import { useTenantSettingsViewModel } from './TenantSettings.viewmodel';
import { TabSurface } from '../../components/layout/TabSurface';
import { TENANT_SETTINGS_SURFACE } from '../../../plugins/core.tenant/surface';
import { useT } from '../../shared/i18n/useT';

/**
 * A tela do escritório é só o TÍTULO e a superfície. Ela não conhece aba nenhuma: as três que
 * existem hoje chegam como contribuição do próprio `core.tenant`, e uma quarta chega da mesma forma,
 * de qualquer extensão, sem que este arquivo mude.
 */
export const TenantSettingsView: React.FC<{ tabKey?: string }> = ({ tabKey }) => {
  const t = useT('core.tenant');
  const vm = useTenantSettingsViewModel(tabKey);

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.tenant-settings')}</S.Title>
      </S.Header>

      <TabSurface surface={TENANT_SETTINGS_SURFACE} initialKey={vm.initialTabKey} />
    </S.Page>
  );
};
