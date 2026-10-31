import React from 'react';
import { RiCloseLine, RiMailSendLine, RiShieldCheckLine, RiUserUnfollowLine } from 'react-icons/ri';
import { usePortalTabViewModel } from './PortalTab.viewmodel';
import { S } from './PortalTab.styles';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { useT } from '../../../shared/i18n/useT';
import { PortalHomeSettings } from './components/PortalHomeSettings';
import { PortalSignInSettings } from './components/PortalSignInSettings';
import { PortalReprojectionStatus } from '../../../components/ui/PortalReprojectionStatus';

export const PortalTabView: React.FC = () => {
  const t = useT('core.tenant');
  const vm = usePortalTabViewModel();

  return (
    <S.Container>
      <InfoBanner variant="info" message={t('portal.tab.description')} />
      <PortalReprojectionStatus />

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
          <S.Column>
            <Label>{t('portal.role')}</Label>
            <Input
              value={vm.role}
              onChange={(event) => vm.setRole(event.target.value)}
              placeholder={t('portal.role.placeholder')}
            />
          </S.Column>
          <Button onClick={() => void vm.invite()} disabled={!vm.canInvite}>
            {vm.isInviting ? t('portal.inviting') : t('portal.invite')}
          </Button>
          {vm.claimOptions.length > 0 && (
            <S.ClaimRow>
              <S.Column>
                <Label>{t('portal.claim.name')}</Label>
                <SearchSelect options={vm.claimOptions} value={vm.claimName} onChange={vm.setClaimName} />
              </S.Column>
              <S.Column>
                <Label>{t('portal.claim.value')}</Label>
                <Input
                  value={vm.claimValue}
                  onChange={(event) => vm.setClaimValue(event.target.value)}
                  disabled={!vm.claimName}
                />
              </S.Column>
              <S.Column>
                <Label>{t('portal.claim.normalize')}</Label>
                <SearchSelect
                  options={vm.normalizeOptions}
                  value={vm.claimNormalize}
                  onChange={vm.setClaimNormalize}
                  disabled={!vm.claimName}
                />
              </S.Column>
            </S.ClaimRow>
          )}
        </S.InviteRow>
      )}
      {vm.hasSubjectScreens && vm.identityRequired && (
        <InfoBanner variant="info" message={t('portal.claim.required-hint')} />
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
                <S.GuestName>
                  {guest.name}
                  {guest.verified && <S.Verified><RiShieldCheckLine size={12} />{guest.verified}</S.Verified>}
                  {guest.suspended && <S.Suspended>{t('portal.guest.suspended')}</S.Suspended>}
                </S.GuestName>
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
                {guest.canResendLink && (
                  <Button variant="ghost" size="sm" onClick={() => void vm.resendLink(guest)} title={t('portal.link.resend')}>
                    <RiMailSendLine size={14} />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => vm.requestRevoke(guest)} title={t('portal.revoke')}>
                  <RiUserUnfollowLine size={14} />
                </Button>
              </S.Actions>
            </S.GuestRow>
          ))}
        </S.GuestList>
      )}

      {vm.identityInvites.length > 0 && (
        <S.GuestList>
          <S.ListTitle>{t('portal.identity-invites')}</S.ListTitle>
          {vm.identityInvites.map((invite) => (
            <S.GuestRow key={invite.id}>
              <S.GuestInfo>
                <S.GuestName>
                  {invite.name}
                  <S.Verified><RiShieldCheckLine size={12} />{invite.claim}</S.Verified>
                </S.GuestName>
                <S.Empty>
                  {invite.email}
                  {' · '}
                  {invite.accepted ? t('portal.identity-invite.accepted') : t('portal.identity-invite.pending')}
                </S.Empty>
                <S.Subjects>
                  {invite.subjects.map((subject) => (
                    <S.Subject key={subject.key}>
                      {subject.label}
                      <S.SubjectRemove
                        type="button"
                        onClick={() => void vm.removeInviteSubject(invite, subject.key)}
                        title={t('portal.subject.remove')}
                      >
                        <RiCloseLine size={12} />
                      </S.SubjectRemove>
                    </S.Subject>
                  ))}
                </S.Subjects>
              </S.GuestInfo>
              <S.Actions>
                <Button variant="ghost" size="sm" onClick={() => vm.requestRevokeInvite(invite)} title={t('portal.revoke')}>
                  <RiUserUnfollowLine size={14} />
                </Button>
              </S.Actions>
            </S.GuestRow>
          ))}
        </S.GuestList>
      )}

      {vm.hasSubjectScreens && <PortalSignInSettings onSaved={vm.reloadSignIn} />}
      {vm.hasSubjectScreens && <PortalHomeSettings />}

      <ConfirmModal
        isOpen={!!vm.guestToRevoke}
        onConfirm={() => void vm.confirmRevoke()}
        onCancel={vm.cancelRevoke}
        title={t('portal.revoke.title')}
        message={t('portal.revoke.message', { name: vm.guestToRevoke?.name ?? '' })}
        confirmLabel={t('portal.revoke')}
        variant="danger"
      />
      <ConfirmModal
        isOpen={!!vm.inviteToRevoke}
        onConfirm={() => void vm.confirmRevokeInvite()}
        onCancel={vm.cancelRevokeInvite}
        title={t('portal.revoke.title')}
        message={t('portal.revoke.message', { name: vm.inviteToRevoke?.name ?? '' })}
        confirmLabel={t('portal.revoke')}
        variant="danger"
      />
    </S.Container>
  );
};
