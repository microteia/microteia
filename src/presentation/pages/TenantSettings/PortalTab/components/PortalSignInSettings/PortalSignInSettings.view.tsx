import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiEditLine } from 'react-icons/ri';
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
  const ui = useT('core.ui');

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

          {vm.providerRows.length > 0 && (
            <S.List>
              {vm.providerRows.map((row) => (
                <S.Row key={row.key} $active={vm.editing?.key === row.key}>
                  <S.RowText>
                    <S.RowTitle>{row.title}</S.RowTitle>
                    {row.issuer && <S.RowMeta>{row.issuer}</S.RowMeta>}
                  </S.RowText>
                  <Button variant="ghost" size="sm" onClick={() => vm.edit(row.key)} title={ui('action.edit')}>
                    <RiEditLine size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => vm.removeProvider(row.key)} title={t('portal.identity.remove')}>
                    <RiDeleteBinLine size={14} />
                  </Button>
                </S.Row>
              ))}
            </S.List>
          )}

          {vm.editing && (
            <S.Provider>
              <S.Field>
                <Label htmlFor={`${vm.editing.key}-label`}>{t('portal.identity.label')}</Label>
                <Input
                  id={`${vm.editing.key}-label`}
                  value={vm.editing.label}
                  onChange={(event) => vm.updateEditing({ label: event.target.value })}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${vm.editing.key}-id`}>{t('portal.identity.id')}</Label>
                <Input
                  id={`${vm.editing.key}-id`}
                  value={vm.editing.id}
                  onChange={(event) => vm.updateEditing({ id: event.target.value })}
                  placeholder={t('portal.identity.id.placeholder')}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${vm.editing.key}-issuer`}>{t('portal.identity.issuer')}</Label>
                <Input
                  id={`${vm.editing.key}-issuer`}
                  value={vm.editing.issuer}
                  onChange={(event) => vm.updateEditing({ issuer: event.target.value })}
                  placeholder={t('portal.identity.issuer.placeholder')}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${vm.editing.key}-client`}>{t('portal.identity.client-id')}</Label>
                <Input
                  id={`${vm.editing.key}-client`}
                  value={vm.editing.clientId}
                  onChange={(event) => vm.updateEditing({ clientId: event.target.value })}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${vm.editing.key}-secret`}>{t('portal.identity.client-secret')}</Label>
                <Input
                  id={`${vm.editing.key}-secret`}
                  type="password"
                  autoComplete="new-password"
                  value={vm.editing.secret}
                  onChange={(event) => vm.updateEditing({ secret: event.target.value, clearSecret: false })}
                  placeholder={vm.editing.hasSecret ? t('portal.identity.client-secret.kept') : t('portal.identity.client-secret.none')}
                />
                {vm.editing.hasSecret && (
                  <Checkbox
                    checked={vm.editing.clearSecret}
                    onChange={(checked) => vm.updateEditing({ clearSecret: checked, secret: '' })}
                    label={t('portal.identity.client-secret.clear')}
                  />
                )}
              </S.Field>
              <S.Field>
                <Label htmlFor={`${vm.editing.key}-scopes`}>{t('portal.identity.scopes')}</Label>
                <Input
                  id={`${vm.editing.key}-scopes`}
                  value={vm.editing.scopes}
                  onChange={(event) => vm.updateEditing({ scopes: event.target.value })}
                  placeholder={t('portal.identity.scopes.placeholder')}
                />
              </S.Field>
              <S.Field>
                <Label htmlFor={`${vm.editing.key}-claims`}>{t('portal.identity.claims')}</Label>
                <Input
                  id={`${vm.editing.key}-claims`}
                  value={vm.editing.claims}
                  onChange={(event) => vm.updateEditing({ claims: event.target.value })}
                />
                <S.Hint>{t('portal.identity.claims.hint')}</S.Hint>
              </S.Field>
              <S.Field>
                <Label htmlFor={`${vm.editing.key}-level`}>{t('portal.identity.level-claim')}</Label>
                <Input
                  id={`${vm.editing.key}-level`}
                  value={vm.editing.levelClaim}
                  onChange={(event) => vm.updateEditing({ levelClaim: event.target.value })}
                />
                <S.Hint>{t('portal.identity.level-claim.hint')}</S.Hint>
              </S.Field>
              <S.Wide>
                <Checkbox
                  checked={vm.editing.userInfo}
                  onChange={(checked) => vm.updateEditing({ userInfo: checked })}
                  label={t('portal.identity.userinfo')}
                />
                <Button variant="ghost" size="sm" onClick={vm.closeEditor}>
                  {ui('action.close')}
                </Button>
              </S.Wide>
            </S.Provider>
          )}

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
