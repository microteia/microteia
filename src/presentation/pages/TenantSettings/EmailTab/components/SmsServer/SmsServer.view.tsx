import React from 'react';
import { RiShieldCheckLine, RiSave3Line, RiDeleteBinLine } from 'react-icons/ri';
import { useSmsServerViewModel } from './SmsServer.viewmodel';
import { S } from './SmsServer.styles';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { SearchSelect } from '../../../../../components/ui/SearchSelect';
import { ConfirmModal } from '../../../../../components/ui/ConfirmModal';
import { Spinner } from '../../../../../components/ui/Spinner';
import { InfoBanner } from '../../../../../components/ui/InfoBanner';
import { useT } from '../../../../../shared/i18n/useT';

export const SmsServer: React.FC = () => {
  const vm = useSmsServerViewModel();
  const t = useT('core.automation');

  if (vm.isLoading) return <Spinner />;

  return (
    <S.Container>
      <InfoBanner
        variant="info"
        message={vm.configured ? t('notifications.sms.banner.configured') : t('notifications.sms.banner.missing')}
      />

      <S.Grid>
        <S.Field>
          <S.FieldLabel>{t('notifications.sms.field.provider')}</S.FieldLabel>
          <SearchSelect options={vm.providerOptions} value={vm.form.provider} onChange={vm.setProvider} />
        </S.Field>
        {vm.isTwilio ? (
          <>
            <S.Field>
              <S.FieldLabel htmlFor="sms-account">{t('notifications.sms.field.account-sid')}</S.FieldLabel>
              <Input
                id="sms-account"
                autoComplete="off"
                value={vm.form.accountSid}
                onChange={(event) => vm.setText('accountSid', event.target.value)}
              />
            </S.Field>
            <S.Field>
              <S.FieldLabel htmlFor="sms-secret">{t('notifications.sms.field.secret.twilio')}</S.FieldLabel>
              <Input
                id="sms-secret"
                type="password"
                autoComplete="new-password"
                value={vm.secret}
                onChange={(event) => vm.setSecret(event.target.value)}
                placeholder={vm.hasSecret ? t('notifications.sms.field.secret.kept') : ''}
              />
              <S.FieldHint>{t('notifications.sms.field.secret.hint')}</S.FieldHint>
            </S.Field>
            <S.Field>
              <S.FieldLabel htmlFor="sms-from">{t('notifications.sms.field.from')}</S.FieldLabel>
              <Input id="sms-from" value={vm.form.fromNumber} onChange={(event) => vm.setText('fromNumber', event.target.value)} />
              <S.FieldHint>{t('notifications.sms.field.from.hint')}</S.FieldHint>
            </S.Field>
          </>
        ) : (
          <>
            <S.Field>
              <S.FieldLabel htmlFor="sms-webhook">{t('notifications.sms.field.webhook-url')}</S.FieldLabel>
              <Input id="sms-webhook" value={vm.form.webhookUrl} onChange={(event) => vm.setText('webhookUrl', event.target.value)} />
              <S.FieldHint>{t('notifications.sms.field.webhook-url.hint')}</S.FieldHint>
            </S.Field>
            <S.Field>
              <S.FieldLabel htmlFor="sms-secret">{t('notifications.sms.field.secret.webhook')}</S.FieldLabel>
              <Input
                id="sms-secret"
                type="password"
                autoComplete="new-password"
                value={vm.secret}
                onChange={(event) => vm.setSecret(event.target.value)}
                placeholder={vm.hasSecret ? t('notifications.sms.field.secret.kept') : ''}
              />
              <S.FieldHint>{t('notifications.sms.field.secret.webhook-hint')}</S.FieldHint>
            </S.Field>
          </>
        )}
        <S.Field>
          <S.FieldLabel htmlFor="sms-country">{t('notifications.sms.field.country')}</S.FieldLabel>
          <Input
            id="sms-country"
            inputMode="numeric"
            value={vm.form.defaultCountryCode}
            onChange={(event) => vm.setText('defaultCountryCode', event.target.value)}
          />
          <S.FieldHint>{t('notifications.sms.field.country.hint')}</S.FieldHint>
        </S.Field>
        <S.Field>
          <S.FieldLabel htmlFor="sms-app-url">{t('notifications.sms.field.app-url')}</S.FieldLabel>
          <Input id="sms-app-url" value={vm.form.appUrl} onChange={(event) => vm.setText('appUrl', event.target.value)} />
          <S.FieldHint>{t('notifications.sms.field.app-url.hint')}</S.FieldHint>
        </S.Field>
      </S.Grid>

      {vm.issue && <S.Issue>{vm.issue}</S.Issue>}

      <S.Actions>
        {vm.configured && (
          <Button variant="ghost" onClick={vm.askClear}>
            <RiDeleteBinLine />
            {t('notifications.sms.action.clear')}
          </Button>
        )}
        {vm.configured && (
          <Button variant="secondary" onClick={vm.verify} disabled={vm.isTesting || vm.isSaving}>
            <RiShieldCheckLine />
            {t('notifications.sms.action.test')}
          </Button>
        )}
        <Button variant="primary" onClick={vm.save} disabled={!vm.canSave}>
          <RiSave3Line />
          {t('notifications.sms.action.save')}
        </Button>
      </S.Actions>

      <ConfirmModal
        isOpen={vm.confirmClearOpen}
        title={t('notifications.sms.clear.title')}
        message={t('notifications.sms.clear.message')}
        variant="danger"
        onConfirm={vm.confirmClear}
        onCancel={vm.cancelClear}
      />
    </S.Container>
  );
};
