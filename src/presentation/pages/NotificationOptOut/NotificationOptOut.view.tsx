import React from 'react';
import { useNotificationOptOutViewModel } from './NotificationOptOut.viewmodel';
import { S } from './NotificationOptOut.styles';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { useT } from '../../shared/i18n/useT';

export const NotificationOptOutView: React.FC = () => {
  const vm = useNotificationOptOutViewModel();
  const t = useT('core.automation');

  return (
    <S.Page>
      <S.Card>
        <S.Title>{t('notifications.opt-out.title')}</S.Title>
        {vm.isLoading && <Spinner size={28} />}
        {vm.statement && <S.Text>{vm.statement}</S.Text>}
        {vm.saved && <InfoBanner variant="info" message={t('notifications.opt-out.saved')} />}
        {vm.failure && <S.Error>{vm.failure}</S.Error>}
        {vm.statement && (
          <Button variant={vm.optedOut ? 'secondary' : 'primary'} onClick={vm.toggle} disabled={vm.isSaving}>
            {vm.optedOut ? t('notifications.opt-out.action.resume') : t('notifications.opt-out.action.stop')}
          </Button>
        )}
      </S.Card>
    </S.Page>
  );
};
