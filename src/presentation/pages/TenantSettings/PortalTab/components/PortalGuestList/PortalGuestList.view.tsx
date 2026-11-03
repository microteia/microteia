import React from 'react';
import { RiMailSendLine, RiUserUnfollowLine } from 'react-icons/ri';
import { usePortalGuestListViewModel, type PortalGuestListProps } from './PortalGuestList.viewmodel';
import { Button } from '../../../../../components/ui/Button';
import { ConfirmModal } from '../../../../../components/ui/ConfirmModal';
import { useT } from '../../../../../shared/i18n/useT';
import { PortalListFrame } from '../PortalListFrame';
import { PortalAccessRow } from '../PortalAccessRow';

/** Configurações › Portal: quem de fora do escritório tem acesso, e a quê. */
export const PortalGuestList: React.FC<PortalGuestListProps> = (props) => {
  const t = useT('core.tenant');
  const vm = usePortalGuestListViewModel(props);

  return (
    <>
      <PortalListFrame title={t('portal.guests')} list={vm.list} emptyMessage={t('portal.guests.empty')}>
        {vm.rows.map((row) => (
          <PortalAccessRow
            key={row.userId}
            name={row.name}
            verified={row.verified}
            suspended={row.suspended ? t('portal.guest.suspended') : null}
            meta={row.meta}
            subjects={row.subjects}
            onRemoveSubject={(subjectKey) => void vm.removeSubject(row, subjectKey)}
            actions={(
              <>
                {row.canResendLink && (
                  <Button variant="ghost" size="sm" onClick={() => void vm.resendLink(row)} title={t('portal.link.resend')}>
                    <RiMailSendLine size={14} />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => vm.requestRevoke(row)} title={t('portal.revoke')}>
                  <RiUserUnfollowLine size={14} />
                </Button>
              </>
            )}
          />
        ))}
      </PortalListFrame>
      <ConfirmModal
        isOpen={!!vm.guestToRevoke}
        onConfirm={() => void vm.confirmRevoke()}
        onCancel={vm.cancelRevoke}
        title={t('portal.revoke.title')}
        message={t('portal.revoke.message', { name: vm.guestToRevoke?.name ?? '' })}
        confirmLabel={t('portal.revoke')}
        variant="danger"
      />
    </>
  );
};
