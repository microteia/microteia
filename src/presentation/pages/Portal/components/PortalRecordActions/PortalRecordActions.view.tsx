import React from 'react';
import { S } from './PortalRecordActions.styles';
import { usePortalRecordActionsViewModel, type PortalRecordActionsProps } from './PortalRecordActions.viewmodel';
import { Button } from '../../../../components/ui/Button';
import { ConfirmModal } from '../../../../components/ui/ConfirmModal';
import { getScreenIcon } from '../../../../shared/screenIcons';
import { useT } from '../../../../shared/i18n/useT';

/** As ações do escritório no registro aberto do portal — botões, a confirmação e o desfecho. */
export const PortalRecordActions: React.FC<PortalRecordActionsProps> = (props) => {
  const vm = usePortalRecordActionsViewModel(props);
  const t = useT('core.tenant');

  if (vm.buttons.length === 0 && !vm.feedback) return null;

  return (
    <S.Box>
      {vm.buttons.length > 0 && (
        <S.Bar>
          {vm.buttons.map((button) => (
            <Button
              key={button.id}
              size="sm"
              variant={button.danger ? 'danger' : 'primary'}
              disabled={button.disabled}
              onClick={() => vm.trigger(button.id)}
            >
              {button.iconKey && getScreenIcon(button.iconKey, 14)}
              {button.title}
            </Button>
          ))}
        </S.Bar>
      )}
      {vm.feedback && <S.Feedback $tone={vm.feedback.tone} role="status">{vm.feedback.message}</S.Feedback>}
      <ConfirmModal
        isOpen={vm.confirmation.isOpen}
        title={vm.confirmation.title}
        message={vm.confirmation.message}
        confirmLabel={t('portal.action.confirm.title')}
        cancelLabel={t('portal.create.cancel')}
        variant={vm.confirmation.danger ? 'danger' : 'default'}
        onConfirm={vm.confirm}
        onCancel={vm.cancelConfirm}
      />
    </S.Box>
  );
};
