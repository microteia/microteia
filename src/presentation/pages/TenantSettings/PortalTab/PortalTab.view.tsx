import React from 'react';
import { RiCloseLine, RiMailSendLine, RiUserUnfollowLine } from 'react-icons/ri';
import { usePortalTabViewModel } from './PortalTab.viewmodel';
import { S } from './PortalTab.styles';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { useT } from '../../../shared/i18n/useT';

export const PortalTabView: React.FC = () => {
  const t = useT('core.tenant');
  const vm = usePortalTabViewModel();

  return (
    <S.Container>
      <InfoBanner variant="info" message={t('portal.tab.description')} />

      {!vm.hasSubjectScreens ? (
        <S.Empty>{t('portal.no-subject-screens')}</S.Empty>
      ) : (
        <S.InviteRow>
          <S.Column>
            <Label>{t('portal.subject.screen')}</Label>
            <SearchSelect
              options={vm.screenOptions}
              value={vm.screenId}
              onChange={vm.setScreenId}
              placeholder={t('portal.subject.screen.placeholder')}
            />
          </S.Column>
          <S.Column>
            <Label>{t('portal.subject.record')}</Label>
            <SearchSelect
              options={vm.recordOptions}
              value={vm.recordId}
              onChange={vm.setRecordId}
              placeholder={t('portal.subject.record.placeholder')}
              disabled={!vm.screenId}
            />
          </S.Column>
          <S.Column>
            <Label>{t('portal.email')}</Label>
            <Input
              type="email"
              value={vm.email}
              onChange={(event) => vm.setEmail(event.target.value)}
              placeholder={t('portal.email.placeholder')}
            />
          </S.Column>
          <Button onClick={() => void vm.invite()} disabled={!vm.canInvite}>
            {vm.isInviting ? t('portal.inviting') : t('portal.invite')}
          </Button>
        </S.InviteRow>
      )}

      {vm.guestsLoading ? (
        <S.SpinnerWrap><Spinner /></S.SpinnerWrap>
      ) : vm.guests.length === 0 ? (
        <S.Empty>{t('portal.guests.empty')}</S.Empty>
      ) : (
        <S.GuestList>
          {vm.guests.map((guest) => (
            <S.GuestRow key={guest.userId}>
              <S.GuestInfo>
                <S.GuestName>{guest.name}</S.GuestName>
                {guest.name !== guest.email && <S.Empty>{guest.email}</S.Empty>}
                <S.Subjects>
                  {guest.subjects.map((subject) => (
                    <S.Subject key={subject.key}>
                      {subject.label}
                      <S.SubjectRemove
                        type="button"
                        onClick={() => void vm.removeSubject(guest, subject.key)}
                        title={t('portal.subject.remove')}
                      >
                        <RiCloseLine size={12} />
                      </S.SubjectRemove>
                    </S.Subject>
                  ))}
                </S.Subjects>
              </S.GuestInfo>
              <S.Actions>
                <Button variant="ghost" size="sm" onClick={() => void vm.resendLink(guest)} title={t('portal.link.resend')}>
                  <RiMailSendLine size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => vm.requestRevoke(guest)} title={t('portal.revoke')}>
                  <RiUserUnfollowLine size={14} />
                </Button>
              </S.Actions>
            </S.GuestRow>
          ))}
        </S.GuestList>
      )}

      <ConfirmModal
        isOpen={!!vm.guestToRevoke}
        onConfirm={() => void vm.confirmRevoke()}
        onCancel={vm.cancelRevoke}
        title={t('portal.revoke.title')}
        message={t('portal.revoke.message', { name: vm.guestToRevoke?.name ?? '' })}
        confirmLabel={t('portal.revoke')}
        variant="danger"
      />
    </S.Container>
  );
};
