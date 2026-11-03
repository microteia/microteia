import React from 'react';
import { RiUserUnfollowLine } from 'react-icons/ri';
import {
  usePortalIdentityInviteListViewModel,
  type PortalIdentityInviteListProps,
} from './PortalIdentityInviteList.viewmodel';
import { Button } from '../../../../../components/ui/Button';
import { ConfirmModal } from '../../../../../components/ui/ConfirmModal';
import { useT } from '../../../../../shared/i18n/useT';
import { PortalListFrame } from '../PortalListFrame';
import { PortalAccessRow } from '../PortalAccessRow';

/** Configurações › Portal: os convites que exigem provar um atributo, aceitos ou não. */
export const PortalIdentityInviteList: React.FC<PortalIdentityInviteListProps> = (props) => {
  const t = useT('core.tenant');
  const vm = usePortalIdentityInviteListViewModel(props);

  if (!vm.visible) return null;

  return (
    <>
      <PortalListFrame title={t('portal.identity-invites')} list={vm.list} emptyMessage={t('portal.guests.empty')}>
        {vm.rows.map((row) => (
          <PortalAccessRow
            key={row.id}
            name={row.name}
            verified={row.claim}
            meta={row.meta}
            subjects={row.subjects}
            onRemoveSubject={(subjectKey) => void vm.removeSubject(row, subjectKey)}
            actions={(
              <Button variant="ghost" size="sm" onClick={() => vm.requestRevoke(row)} title={t('portal.revoke')}>
                <RiUserUnfollowLine size={14} />
              </Button>
            )}
          />
        ))}
      </PortalListFrame>
      <ConfirmModal
        isOpen={!!vm.inviteToRevoke}
        onConfirm={() => void vm.confirmRevoke()}
        onCancel={vm.cancelRevoke}
        title={t('portal.revoke.title')}
        message={t('portal.revoke.message', { name: vm.inviteToRevoke?.name ?? '' })}
        confirmLabel={t('portal.revoke')}
        variant="danger"
      />
    </>
  );
};
