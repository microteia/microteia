import React from 'react';
import {
  RiCheckLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiAlertLine,
  RiCloseLine,
} from 'react-icons/ri';
import { useNotificationBannerViewModel, type NotificationBannerProps } from './NotificationBanner.viewmodel';
import { S } from './NotificationBanner.styles';
import type { NotificationVariant } from '../../../../stores/useNotification';

import { useT } from '../../../shared/i18n/useT';

const ICONS: Record<NotificationVariant, React.ReactNode> = {
  success: <RiCheckLine size={15} />,
  error: <RiErrorWarningLine size={15} />,
  warning: <RiAlertLine size={15} />,
  info: <RiInformationLine size={15} />,
};

export const NotificationBanner: React.FC<NotificationBannerProps> = (props) => {
  const vm = useNotificationBannerViewModel(props);
  const t = useT('core.ui');

  if (vm.visibleNotifications.length === 0 && vm.hiddenCount === 0) return null;

  return (
    <S.BannerContainer>
      {vm.visibleNotifications.map(n => (
        <S.NotificationItem
          key={n.id}
          $variant={n.variant}
          $exiting={vm.exitingIds.has(n.id)}
          onMouseEnter={() => vm.handleMouseEnter(n.id)}
          onMouseLeave={() => vm.handleMouseLeave(n.id)}
        >
          <S.Icon $variant={n.variant}>{ICONS[n.variant]}</S.Icon>
          <S.Message>{n.message}</S.Message>
          <S.CloseButton onClick={() => vm.handleDismiss(n.id)} aria-label={t('action.close')}>
            <RiCloseLine size={15} />
          </S.CloseButton>
        </S.NotificationItem>
      ))}

      {vm.hiddenCount > 0 && (
        <S.MoreBar>
          <S.MoreLabel>
            {t('notification.hidden', { count: vm.hiddenCount })}
          </S.MoreLabel>
          <S.DismissAllButton onClick={vm.handleDismissAll}>{t('action.clear-all')}</S.DismissAllButton>
        </S.MoreBar>
      )}
    </S.BannerContainer>
  );
};
