import React from 'react';
import { RiRobot2Line } from 'react-icons/ri';
import { useOAuthConsentViewModel } from './OAuthConsent.viewmodel';
import { AGENT_EXPIRY_CHOICES } from '../../shared/agentExpiry';
import { S } from './OAuthConsent.styles.tsx';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { PermissionPicker } from '../../components/ui/PermissionPicker';
import { useT } from '../../shared/i18n/useT';

export const OAuthConsentView: React.FC = () => {
  const vm = useOAuthConsentViewModel();
  const t = useT('core.access');

  const expiryOptions = AGENT_EXPIRY_CHOICES.map((choice) => ({
    value: String(choice.days ?? ''),
    label: t(choice.labelKey),
  }));

  const body = () => {
    if (vm.denied) return <InfoBanner message={t('agent.oauth.denied')} variant="info" />;
    if (vm.error !== null) return <InfoBanner message={vm.error} variant="warning" />;
    if (vm.request === null) return <Spinner />;

    return (
      <>
        <S.Header>
          <S.Mark><RiRobot2Line /></S.Mark>
          <S.Title>{t('agent.oauth.title', { client: vm.request.clientName })}</S.Title>
        </S.Header>

        <S.Description>
          {t('agent.oauth.intro', { client: vm.request.clientName, tenant: vm.tenantName })}
        </S.Description>
        <S.Description>
          {t('agent.oauth.returns-to', { host: vm.request.redirectHost })}
        </S.Description>

        {vm.request.loopbackOnly && (
          <InfoBanner message={t('agent.oauth.loopback')} variant="warning" />
        )}

        {vm.availability !== 'ready' && (
          <InfoBanner
            message={t(vm.availability === 'disabled' ? 'agent.banner.disabled' : 'agent.banner.pending')}
            variant="warning"
          />
        )}

        <S.Field>
          <S.FieldLabel>{t('agent.oauth.tenant')}</S.FieldLabel>
          <S.Tenant>{vm.tenantName}</S.Tenant>
          <S.Hint>{t('agent.oauth.tenant.hint')}</S.Hint>
        </S.Field>

        <S.Field>
          <S.FieldLabel>{t('agent.form.permissions')}</S.FieldLabel>
          <PermissionPicker
            selected={vm.selectedPermissions}
            onChange={vm.setSelectedPermissions}
          />
          <S.Hint>{t('agent.form.permissions.hint')}</S.Hint>
        </S.Field>

        <S.Field>
          <S.FieldLabel>{t('agent.form.expiry')}</S.FieldLabel>
          <SearchSelect
            options={expiryOptions}
            value={String(vm.expiryDays ?? '')}
            onChange={(value) => vm.setExpiryDays(value === '' ? null : Number(value))}
          />
        </S.Field>

        <S.Actions>
          <Button variant="secondary" onClick={vm.deny} disabled={vm.isWorking}>
            {t('agent.oauth.deny')}
          </Button>
          <Button onClick={() => void vm.allow()} disabled={!vm.canAllow || vm.isWorking}>
            {vm.isWorking ? t('agent.oauth.working') : t('agent.oauth.allow')}
          </Button>
        </S.Actions>
      </>
    );
  };

  return (
    <S.Page>
      <S.Card>{body()}</S.Card>
    </S.Page>
  );
};
