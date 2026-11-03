import React from 'react';
import { usePortalTabViewModel } from './PortalTab.viewmodel';
import { S } from './PortalTab.styles';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { useT } from '../../../shared/i18n/useT';
import { PortalHomeSettings } from './components/PortalHomeSettings';
import { PortalSignInSettings } from './components/PortalSignInSettings';
import { PortalGuestList } from './components/PortalGuestList';
import { PortalIdentityInviteList } from './components/PortalIdentityInviteList';
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

      <PortalGuestList
        describeSubject={vm.describeSubject}
        verifiedBadge={vm.verifiedBadge}
        identityRequired={vm.identityRequired}
      />
      <PortalIdentityInviteList describeSubject={vm.describeSubject} />

      {vm.hasSubjectScreens && <PortalSignInSettings onSaved={vm.reloadSignIn} />}
      {vm.hasSubjectScreens && <PortalHomeSettings />}
    </S.Container>
  );
};
