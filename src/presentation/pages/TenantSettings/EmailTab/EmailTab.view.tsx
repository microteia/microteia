import React from 'react';
import { RiMailSendLine, RiSave3Line, RiDeleteBinLine } from 'react-icons/ri';
import { useEmailTabViewModel } from './EmailTab.viewmodel';
import { S } from './EmailTab.styles';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { useT } from '../../../shared/i18n/useT';

export const EmailTabView: React.FC = () => {
  const vm = useEmailTabViewModel();
  const t = useT('core.automation');

  if (vm.isLoading) return <Spinner />;

  return (
    <S.Container>
      <S.Intro>
        <S.Title>{t('notifications.email.title')}</S.Title>
        <S.Description>{t('notifications.email.description')}</S.Description>
      </S.Intro>

      <InfoBanner
        variant="info"
        message={vm.configured ? t('notifications.email.banner.configured') : t('notifications.email.banner.missing')}
      />

      <S.Grid>
        <S.Field>
          <S.FieldLabel htmlFor="email-host">{t('notifications.email.field.host')}</S.FieldLabel>
          <Input id="email-host" value={vm.form.host} onChange={(event) => vm.setText('host', event.target.value)} />
        </S.Field>
        <S.Field>
          <S.FieldLabel htmlFor="email-port">{t('notifications.email.field.port')}</S.FieldLabel>
          <Input id="email-port" type="number" value={vm.portText} onChange={(event) => vm.setPort(event.target.value)} />
        </S.Field>
        <S.Field>
          <S.FieldLabel htmlFor="email-username">{t('notifications.email.field.username')}</S.FieldLabel>
          <Input
            id="email-username"
            autoComplete="off"
            value={vm.form.username}
            onChange={(event) => vm.setText('username', event.target.value)}
          />
        </S.Field>
        <S.Field>
          <S.FieldLabel htmlFor="email-password">{t('notifications.email.field.password')}</S.FieldLabel>
          <Input
            id="email-password"
            type="password"
            autoComplete="new-password"
            value={vm.password}
            onChange={(event) => vm.setPassword(event.target.value)}
            placeholder={vm.hasPassword ? t('notifications.email.field.password.kept') : ''}
          />
          <S.FieldHint>{t('notifications.email.field.password.hint')}</S.FieldHint>
        </S.Field>
        <S.Field>
          <S.FieldLabel htmlFor="email-from">{t('notifications.email.field.from-address')}</S.FieldLabel>
          <Input id="email-from" value={vm.form.fromAddress} onChange={(event) => vm.setText('fromAddress', event.target.value)} />
        </S.Field>
        <S.Field>
          <S.FieldLabel htmlFor="email-from-name">{t('notifications.email.field.from-name')}</S.FieldLabel>
          <Input id="email-from-name" value={vm.form.fromName} onChange={(event) => vm.setText('fromName', event.target.value)} />
        </S.Field>
        <S.Field>
          <S.FieldLabel htmlFor="email-app-url">{t('notifications.email.field.app-url')}</S.FieldLabel>
          <Input id="email-app-url" value={vm.form.appUrl} onChange={(event) => vm.setText('appUrl', event.target.value)} />
          <S.FieldHint>{t('notifications.email.field.app-url.hint')}</S.FieldHint>
        </S.Field>
        <S.Field>
          <S.CheckboxSlot>
            <Checkbox checked={vm.form.secure} onChange={vm.setSecure} label={t('notifications.email.field.secure')} />
          </S.CheckboxSlot>
          <S.FieldHint>{t('notifications.email.field.secure.hint')}</S.FieldHint>
        </S.Field>
      </S.Grid>

      {vm.issue && <S.Issue>{vm.issue}</S.Issue>}

      <S.Actions>
        {vm.configured && (
          <Button variant="ghost" onClick={vm.askClear}>
            <RiDeleteBinLine />
            {t('notifications.email.action.clear')}
          </Button>
        )}
        {vm.configured && (
          <Button variant="secondary" onClick={vm.sendTest} disabled={vm.isTesting || vm.isSaving}>
            <RiMailSendLine />
            {t('notifications.email.action.test')}
          </Button>
        )}
        <Button variant="primary" onClick={vm.save} disabled={!vm.canSave}>
          <RiSave3Line />
          {t('notifications.email.action.save')}
        </Button>
      </S.Actions>

      <ConfirmModal
        isOpen={vm.confirmClearOpen}
        title={t('notifications.email.clear.title')}
        message={t('notifications.email.clear.message')}
        variant="danger"
        onConfirm={vm.confirmClear}
        onCancel={vm.cancelClear}
      />
    </S.Container>
  );
};
