import React from 'react';
import { RiNotification3Line } from 'react-icons/ri';
import { usePortalNotificationBellViewModel } from './PortalNotificationBell.viewmodel';
import { S } from './PortalNotificationBell.styles';
import { useT } from '../../../../shared/i18n/useT';

export const PortalNotificationBell: React.FC = () => {
  const { attachPanel, ...vm } = usePortalNotificationBellViewModel();
  const t = useT('core.tenant');

  if (!vm.visible) return null;

  return (
    <S.Wrapper ref={attachPanel}>
      <S.BellButton
        type="button"
        $active={vm.open}
        onClick={vm.toggle}
        title={t('portal.notifications.title')}
        aria-label={t('portal.notifications.title')}
      >
        <RiNotification3Line size={18} />
        {vm.unreadCount > 0 && <S.Badge>{vm.unreadLabel}</S.Badge>}
      </S.BellButton>

      {vm.open && (
        <S.Panel>
          <S.Header>
            <S.HeaderTitle>{t('portal.notifications.title')}</S.HeaderTitle>
            {vm.unreadCount > 0 && (
              <S.HeaderAction type="button" onClick={vm.markAllRead}>
                {t('portal.notifications.mark-all-read')}
              </S.HeaderAction>
            )}
          </S.Header>

          <S.List>
            {vm.items.length === 0 ? (
              <S.Empty>{t('portal.notifications.empty')}</S.Empty>
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
        </S.Panel>
      )}
    </S.Wrapper>
  );
};
