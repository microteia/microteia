import React from 'react';
import { useSecurityTabViewModel } from './SecurityTab.viewmodel';
import { S } from './SecurityTab.styles';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { MultiSearchSelect } from '../../../components/ui/MultiSearchSelect';
import { Spinner } from '../../../components/ui/Spinner';
import { SecondFactorPanel } from '../../../components/ui/SecondFactorPanel';
import { useT } from '../../../shared/i18n/useT';

export const SecurityTabView: React.FC = () => {
  const vm = useSecurityTabViewModel();
  const t = useT('core.access');

  return (
    <S.Container>
      <S.Intro>
        <S.Title>{t('mfa.tab.title')}</S.Title>
        <S.Description>{t('mfa.tab.description')}</S.Description>
      </S.Intro>

      <SecondFactorPanel />

      {vm.loading && <Spinner size={24} />}
      {vm.loadError && <InfoBanner message={vm.loadError} variant="warning" />}

      {!vm.loading && !vm.loadError && (
        <>
          <S.Section>
            <S.Subtitle>{t('mfa.policy.title')}</S.Subtitle>
            <Checkbox checked={vm.enabled} onChange={vm.setEnabled} label={t('mfa.policy.enabled')} />
            {vm.enabled && (
              <>
                <Checkbox checked={vm.everyone} onChange={vm.setEveryone} label={t('mfa.policy.everyone')} />
                {!vm.everyone && (
                  <>
                    <S.Field>
                      <S.FieldLabel>{t('mfa.policy.roles')}</S.FieldLabel>
                      <MultiSearchSelect options={vm.roleOptions} values={vm.roleIds} onChange={vm.setRoleIds} placeholder={t('mfa.policy.roles.placeholder')} />
                      <S.FieldHint>{t('mfa.policy.roles.hint')}</S.FieldHint>
                    </S.Field>
                    <S.Field>
                      <S.FieldLabel>{t('mfa.policy.permissions')}</S.FieldLabel>
                      <MultiSearchSelect options={vm.permissionOptions} values={vm.permissions} onChange={vm.setPermissions} placeholder={t('mfa.policy.permissions.placeholder')} />
                      <S.FieldHint>{t('mfa.policy.permissions.hint')}</S.FieldHint>
                    </S.Field>
                    {vm.scopeEmpty && <S.FieldError>{t('mfa.policy.scope-empty.hint')}</S.FieldError>}
                  </>
                )}
                <S.Field>
                  <S.FieldLabel htmlFor="mfa-reverify">{t('mfa.policy.reverify')}</S.FieldLabel>
                  <S.NumberInput
                    id="mfa-reverify"
                    inputMode="numeric"
                    value={vm.reverifyMinutes}
                    onChange={(event) => vm.setReverifyMinutes(event.target.value)}
                  />
                  {vm.reverifyInvalid
                    ? <S.FieldError>{t('mfa.policy.reverify.range', { min: vm.reverifyMin, max: vm.reverifyMax })}</S.FieldError>
                    : <S.FieldHint>{t('mfa.policy.reverify.hint')}</S.FieldHint>}
                </S.Field>
                <InfoBanner message={t('mfa.policy.self-first')} variant="info" />
              </>
            )}
            <S.Actions>
              <Button type="button" onClick={vm.save} disabled={!vm.canSave}>{t('mfa.policy.save')}</Button>
              {vm.dirty && <Button type="button" variant="ghost" onClick={vm.discard}>{t('mfa.policy.discard')}</Button>}
            </S.Actions>
          </S.Section>

          <S.Section>
            <S.Subtitle>{t('mfa.members.title')}</S.Subtitle>
            <S.Description>{t('mfa.members.summary', { required: vm.requiredCount, missing: vm.missingCount })}</S.Description>
            <S.Table>
              <S.HeaderRow>
                <span>{t('mfa.members.column.member')}</span>
                <span>{t('mfa.members.column.required')}</span>
                <span>{t('mfa.members.column.enrolled')}</span>
                <span>{t('mfa.members.column.last')}</span>
                <span />
              </S.HeaderRow>
              {vm.members.map((row) => (
                <S.Row key={row.userId}>
                  <S.Person>
                    <span>{row.name}</span>
                    <S.PersonEmail>{row.email}</S.PersonEmail>
                  </S.Person>
                  <S.Status $tone={row.required ? 'warn' : 'muted'}>{t(row.required ? 'mfa.members.required.yes' : 'mfa.members.required.no')}</S.Status>
                  <S.Status $tone={row.enrolled ? 'ok' : 'muted'}>{row.enrolled ? row.enrolledAt : t('mfa.members.not-enrolled')}</S.Status>
                  <span>{row.lastVerifiedAt}</span>
                  {row.enrolled
                    ? <Button type="button" variant="ghost" size="sm" onClick={() => vm.askReset(row)}>{t('mfa.members.reset')}</Button>
                    : <span />}
                </S.Row>
              ))}
            </S.Table>
          </S.Section>
        </>
      )}

      <ConfirmModal
        isOpen={vm.pendingResetName !== ''}
        title={t('mfa.reset.confirm.title')}
        message={t('mfa.reset.confirm.message', { member: vm.pendingResetName })}
        confirmLabel={t('mfa.members.reset')}
        variant="danger"
        loading={vm.resetting}
        onConfirm={vm.confirmReset}
        onCancel={vm.cancelReset}
      />
    </S.Container>
  );
};
