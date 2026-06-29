import React from 'react';
import {
  RiCheckLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiAlertLine,
  RiCloseLine,
} from 'react-icons/ri';
import { useNotificationBannerViewModel } from './NotificationBanner.viewmodel';
import { S } from './NotificationBanner.styles';
import type { NotificationVariant } from '../../../../stores/useNotification';

const ICONS: Record<NotificationVariant, React.ReactNode> = {
  success: <RiCheckLine size={15} />,
  error: <RiErrorWarningLine size={15} />,
  warning: <RiAlertLine size={15} />,
  info: <RiInformationLine size={15} />,
};

export const NotificationBanner: React.FC = () => {
  const vm = useNotificationBannerViewModel();

  if (vm.visibleNotifications.length === 0 && vm.hiddenCount === 0) return null;

  return (
    <S.BannerContainer>
      {vm.visibleNotifications.map(n => (
        <S.NotificationItem key={n.id} $variant={n.variant} $exiting={vm.exitingIds.has(n.id)}>
          <S.Icon $variant={n.variant}>{ICONS[n.variant]}</S.Icon>
          <S.Message>{n.message}</S.Message>
          {n.variant !== 'success' && (
            <S.CloseButton onClick={() => vm.handleDismiss(n.id)} aria-label="Fechar">
              <RiCloseLine size={15} />
            </S.CloseButton>
          )}
        </S.NotificationItem>
      ))}

      {vm.hiddenCount > 0 && (
        <S.MoreBar>
          <S.MoreLabel>
            +{vm.hiddenCount} mensagem{vm.hiddenCount > 1 ? 'ns' : ''} oculta{vm.hiddenCount > 1 ? 's' : ''}
          </S.MoreLabel>
          <S.DismissAllButton onClick={vm.handleDismissAll}>Limpar tudo</S.DismissAllButton>
        </S.MoreBar>
      )}
    </S.BannerContainer>
  );
};
