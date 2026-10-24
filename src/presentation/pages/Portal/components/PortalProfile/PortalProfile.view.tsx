import React from 'react';
import { usePortalProfileViewModel } from './PortalProfile.viewmodel';
import { S } from './PortalProfile.styles';
import { Button } from '../../../../components/ui/Button';
import { Input, Label } from '../../../../components/ui/Input';
import { useT } from '../../../../shared/i18n/useT';

export const PortalProfile: React.FC = () => {
  const vm = usePortalProfileViewModel();
  const t = useT('core.tenant');

  return (
    <S.Form
      onSubmit={(event) => {
        event.preventDefault();
        void vm.save();
      }}
    >
      <S.Title>{t('portal.profile')}</S.Title>
      <S.Field>
        <Label htmlFor="portal-profile-name">{t('portal.profile.name')}</Label>
        <Input
          id="portal-profile-name"
          value={vm.name}
          maxLength={vm.nameMaxLength}
          autoComplete="name"
          onChange={(event) => vm.setName(event.target.value)}
        />
        <S.Hint>{t('portal.profile.name.hint', { office: vm.office })}</S.Hint>
      </S.Field>
      <S.Field>
        <Label htmlFor="portal-profile-email">{t('portal.profile.email')}</Label>
        <Input id="portal-profile-email" value={vm.email} readOnly disabled />
        <S.Hint>{t('portal.profile.email.hint')}</S.Hint>
      </S.Field>
      <S.Actions>
        <Button type="submit" disabled={vm.saving}>{t('portal.profile.save')}</Button>
        {vm.saved && <S.Success>{t('portal.profile.saved')}</S.Success>}
      </S.Actions>
      {vm.failed && <S.Error>{t('portal.profile.failed')}</S.Error>}
    </S.Form>
  );
};
