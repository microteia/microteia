import React from 'react';
import { RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { usePortalSignInSettingsViewModel } from './PortalSignInSettings.viewmodel';
import { S } from './PortalSignInSettings.styles';
import { Button } from '../../../../../components/ui/Button';
import { Checkbox } from '../../../../../components/ui/Checkbox';
import { Input, Label } from '../../../../../components/ui/Input';
import { InfoBanner } from '../../../../../components/ui/InfoBanner';
import { Spinner } from '../../../../../components/ui/Spinner';
import { CopyButton } from '../../../../../components/ui/CopyButton';
import { useT } from '../../../../../shared/i18n/useT';

interface PortalSignInSettingsProps {
  /** Salvou — a aba relê as claims que um convite pode exigir. */
  onSaved?: () => void;
}

/** Configurações › Portal › Entrada: o link de e-mail e os provedores de identidade do escritório. */
export const PortalSignInSettings: React.FC<PortalSignInSettingsProps> = ({ onSaved }) => {
  const vm = usePortalSignInSettingsViewModel(onSaved);
  const t = useT('core.tenant');

  return (
    <S.Section>
      <S.Title>{t('portal.identity.title')}</S.Title>
      <InfoBanner variant="info" message={t('portal.identity.description')} />
      {vm.loading ? (
        <Spinner />
      ) : (
        <>
          <Checkbox checked={vm.emailLink} onChange={vm.setEmailLink} label={t('portal.identity.email-link')} />
          <S.Hint>{t('portal.identity.email-link.hint')}</S.Hint>

          <Label>{t('portal.identity.callback')}</Label>
          <S.Callback>
            {vm.callbackUrl}
            <CopyButton text={vm.callbackUrl} />
          </S.Callback>
          <S.Hint>{t('portal.identity.callback.hint')}</S.Hint>

          {vm.providers.map((provider) => (
            <S.Provider key={provider.key}>
              <S.Field>
                <Label htmlFor={`${provider.key}-label`}>{t('portal.identity.label')}</Label>
                <Input
                  id={`${provider.key}-label`}
                  value={provider.label}
                  onChange={(event) => vm.updateProvider(provider.key, { label: event.target.value })}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${provider.key}-id`}>{t('portal.identity.id')}</Label>
                <Input
                  id={`${provider.key}-id`}
                  value={provider.id}
                  onChange={(event) => vm.updateProvider(provider.key, { id: event.target.value })}
                  placeholder={t('portal.identity.id.placeholder')}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${provider.key}-issuer`}>{t('portal.identity.issuer')}</Label>
                <Input
                  id={`${provider.key}-issuer`}
                  value={provider.issuer}
                  onChange={(event) => vm.updateProvider(provider.key, { issuer: event.target.value })}
                  placeholder={t('portal.identity.issuer.placeholder')}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${provider.key}-client`}>{t('portal.identity.client-id')}</Label>
                <Input
                  id={`${provider.key}-client`}
                  value={provider.clientId}
                  onChange={(event) => vm.updateProvider(provider.key, { clientId: event.target.value })}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${provider.key}-secret`}>{t('portal.identity.client-secret')}</Label>
                <Input
                  id={`${provider.key}-secret`}
                  type="password"
                  autoComplete="new-password"
                  value={provider.secret}
                  onChange={(event) => vm.updateProvider(provider.key, { secret: event.target.value, clearSecret: false })}
                  placeholder={provider.hasSecret ? t('portal.identity.client-secret.kept') : t('portal.identity.client-secret.none')}
                />
                {provider.hasSecret && (
                  <Checkbox
                    checked={provider.clearSecret}
                    onChange={(checked) => vm.updateProvider(provider.key, { clearSecret: checked, secret: '' })}
                    label={t('portal.identity.client-secret.clear')}
                  />
                )}
              </S.Field>
              <S.Field>
                <Label htmlFor={`${provider.key}-scopes`}>{t('portal.identity.scopes')}</Label>
                <Input
                  id={`${provider.key}-scopes`}
                  value={provider.scopes}
                  onChange={(event) => vm.updateProvider(provider.key, { scopes: event.target.value })}
                  placeholder={t('portal.identity.scopes.placeholder')}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${provider.key}-claims`}>{t('portal.identity.claims')}</Label>
                <Input
                  id={`${provider.key}-claims`}
                  value={provider.claims}
                  onChange={(event) => vm.updateProvider(provider.key, { claims: event.target.value })}
                />
                <S.Hint>{t('portal.identity.claims.hint')}</S.Hint>
              </S.Field>
              <S.Field>
                <Label htmlFor={`${provider.key}-level`}>{t('portal.identity.level-claim')}</Label>
                <Input
                  id={`${provider.key}-level`}
                  value={provider.levelClaim}
                  onChange={(event) => vm.updateProvider(provider.key, { levelClaim: event.target.value })}
                />
                <S.Hint>{t('portal.identity.level-claim.hint')}</S.Hint>
              </S.Field>
              <S.Wide>
                <Checkbox
                  checked={provider.userInfo}
                  onChange={(checked) => vm.updateProvider(provider.key, { userInfo: checked })}
                  label={t('portal.identity.userinfo')}
                />
                <Button variant="ghost" size="sm" onClick={() => vm.removeProvider(provider.key)} title={t('portal.identity.remove')}>
                  <RiDeleteBinLine size={14} />
                </Button>
              </S.Wide>
            </S.Provider>
          ))}

          <S.Actions>
            <Button variant="secondary" onClick={vm.addProvider} disabled={!vm.canAddProvider}>
              <RiAddLine size={14} />
              {t('portal.identity.add')}
            </Button>
            <Button onClick={() => void vm.save()} disabled={vm.saving}>{t('portal.identity.save')}</Button>
          </S.Actions>
        </>
      )}
    </S.Section>
  );
};
