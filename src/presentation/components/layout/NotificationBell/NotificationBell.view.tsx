import React from 'react';
import { RiNotification3Line } from 'react-icons/ri';
import { useNotificationBellViewModel } from './NotificationBell.viewmodel';
import { S } from './NotificationBell.styles';
import { useT } from '../../../shared/i18n/useT';

export const NotificationBell: React.FC = () => {
  const { attachPanel, ...vm } = useNotificationBellViewModel();
  const t = useT('core.automation');

  if (!vm.visible) return null;

  return (
    <S.Wrapper ref={attachPanel}>
      <S.BellButton
        type="button"
        $active={vm.open}
        onClick={vm.toggle}
        title={t('notifications.bell.title')}
        aria-label={t('notifications.bell.title')}
      >
        <RiNotification3Line size={18} />
        {vm.unreadCount > 0 && <S.Badge>{vm.unreadLabel}</S.Badge>}
      </S.BellButton>

      {vm.open && (
        <S.Panel>
          <S.Header>
            <S.HeaderTitle>{t('notifications.bell.title')}</S.HeaderTitle>
            {vm.unreadCount > 0 && (
              <S.HeaderAction type="button" onClick={vm.markAllRead}>
                {t('notifications.bell.mark-all-read')}
              </S.HeaderAction>
            )}
          </S.Header>

          <S.List>
            {vm.items.length === 0 ? (
              <S.Empty>{t('notifications.bell.empty')}</S.Empty>
            ) : (
              vm.items.map((item) => (
                <S.Item key={item.id} type="button" $unread={!item.read} $clickable={item.hasLink} onClick={() => vm.openItem(item.id)}>
                  {!item.read && <S.UnreadDot />}
                  <S.ItemBody>
                    <S.ItemTitle>{item.title}</S.ItemTitle>
                    {item.message && <S.ItemMessage>{item.message}</S.ItemMessage>}
                    <S.ItemWhen>{item.when}</S.ItemWhen>
                  </S.ItemBody>
                </S.Item>
              ))
            )}
          </S.List>

          {vm.pushStatus !== 'unsupported' && (
            <S.Footer>
              <S.FooterText>
                {vm.pushStatus === 'enabled'
                  ? t('notifications.push.enabled')
                  : vm.pushStatus === 'denied'
                    ? t('notifications.push.blocked')
                    : t('notifications.push.offer')}
              </S.FooterText>
              {vm.pushStatus === 'available' && (
                <S.HeaderAction type="button" onClick={vm.enablePush} disabled={vm.pushBusy}>
                  {t('notifications.push.enable')}
                </S.HeaderAction>
              )}
              {vm.pushStatus === 'enabled' && (
                <S.HeaderAction type="button" onClick={vm.disablePush} disabled={vm.pushBusy}>
                  {t('notifications.push.disable')}
                </S.HeaderAction>
              )}
            </S.Footer>
          )}
        </S.Panel>
      )}
    </S.Wrapper>
  );
};
