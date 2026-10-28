import React from 'react';
import { RiShieldKeyholeLine, RiBuildingLine } from 'react-icons/ri';
import { useSecondFactorFlowHostViewModel, useTenantEntryGateViewModel } from './TenantEntryGate.viewmodel';
import type { TenantEntryGateViewModel } from './TenantEntryGate.viewmodel';
import { S } from './TenantEntryGate.styles';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Checkbox } from '../../ui/Checkbox';
import { CopyButton } from '../../ui/CopyButton';
import { FullPageSpinner, Spinner } from '../../ui/Spinner';
import { SecondFactorFlowContext } from '../../../../stores/useSecondFactorFlow';
import { TenantEntryGateContext } from './useTenantEntryGate';
import { useT } from '../../../shared/i18n/useT';
import type { TranslateFn } from '../../../shared/i18n/useT';

interface PartProps {
  vm: TenantEntryGateViewModel;
  t: TranslateFn;
}

const CodeForm: React.FC<PartProps & { submitLabel: string; allowRecovery: boolean }> = ({ vm, t, submitLabel, allowRecovery }) => (
  <S.Form onSubmit={vm.onSubmitCode}>
    <S.CodeInput
      autoFocus
      value={vm.code}
      onChange={(event) => vm.setCode(event.target.value)}
      inputMode={vm.useRecoveryCode ? 'text' : 'numeric'}
      autoComplete="one-time-code"
      maxLength={vm.useRecoveryCode ? 16 : 7}
      aria-label={t(vm.useRecoveryCode ? 'mfa.gate.recovery.label' : 'mfa.gate.code.label')}
      placeholder={t(vm.useRecoveryCode ? 'mfa.gate.recovery.placeholder' : 'mfa.gate.code.placeholder')}
    />
    {vm.error && <S.Error role="alert">{vm.error}</S.Error>}
    {vm.lockedUntil && <S.Error>{t('mfa.gate.locked', { until: vm.lockedUntil })}</S.Error>}
    <S.Actions>
      {allowRecovery ? (
        <S.LinkButton type="button" onClick={vm.toggleRecoveryCode}>
          {t(vm.useRecoveryCode ? 'mfa.gate.recovery.toggle-back' : 'mfa.gate.recovery.toggle')}
        </S.LinkButton>
      ) : <span />}
      <Button type="submit" disabled={vm.busy || vm.code.trim() === ''}>{submitLabel}</Button>
    </S.Actions>
  </S.Form>
);

const GateBody: React.FC<PartProps> = ({ vm, t }) => (
  <>
    {vm.mode === 'verify' && (
      <>
        <S.Lead>
          {vm.presentation === 'modal'
            ? t('mfa.gate.reverify.lead', { organization: vm.tenantName, minutes: vm.reverifyMinutes })
            : t(vm.useRecoveryCode ? 'mfa.gate.recovery.lead' : 'mfa.gate.verify.lead')}
        </S.Lead>
        <CodeForm vm={vm} t={t} submitLabel={t('mfa.gate.submit')} allowRecovery />
      </>
    )}

    {vm.mode === 'step-up' && (
      <>
        <S.Lead>{t('mfa.gate.step-up.lead')}</S.Lead>
        <CodeForm vm={vm} t={t} submitLabel={t('mfa.gate.submit')} allowRecovery />
      </>
    )}

    {vm.mode === 'enroll-intro' && (
      <>
        <S.Lead>
          {vm.replacing ? t('mfa.gate.enroll.replace-lead') : t('mfa.gate.enroll.lead', { organization: vm.tenantName })}
        </S.Lead>
        {vm.error && <S.Error role="alert">{vm.error}</S.Error>}
        <S.Actions>
          <span />
          <Button type="button" disabled={vm.busy} onClick={vm.startEnrollment}>{t('mfa.gate.enroll.start')}</Button>
        </S.Actions>
      </>
    )}

    {vm.mode === 'enroll-scan' && (
      <>
        <S.Lead>{t('mfa.gate.enroll.scan')}</S.Lead>
        <S.QrFrame>
          {vm.qrDataUrl ? <S.QrImage src={vm.qrDataUrl} alt={t('mfa.gate.enroll.qr-alt')} /> : <Spinner size={32} />}
        </S.QrFrame>
        <S.SecretLabel>{t('mfa.gate.enroll.key')}</S.SecretLabel>
        <S.Secret>
          <span>{vm.secret}</span>
          <CopyButton text={vm.secretPlain} />
        </S.Secret>
        <S.Link href={vm.otpauthUri}>{t('mfa.gate.enroll.open-link')}</S.Link>
        <S.Lead>{t('mfa.gate.enroll.confirm-lead')}</S.Lead>
        <CodeForm vm={vm} t={t} submitLabel={t('mfa.gate.enroll.confirm')} allowRecovery={false} />
      </>
    )}

    {vm.mode === 'recovery-codes' && (
      <>
        <S.Lead>{t('mfa.gate.codes.lead')}</S.Lead>
        <S.Codes>
          {vm.recoveryCodes.map((code) => <li key={code}>{code}</li>)}
        </S.Codes>
        <S.CodesTools>
          <CopyButton text={vm.recoveryCodesText} />
          <Button type="button" variant="secondary" size="sm" onClick={vm.downloadRecoveryCodes}>
            {t('mfa.gate.codes.download')}
          </Button>
        </S.CodesTools>
        <Checkbox checked={vm.codesSaved} onChange={vm.setCodesSaved} label={t('mfa.gate.codes.saved')} />
        {vm.error && <S.Error role="alert">{vm.error}</S.Error>}
        <S.Actions>
          <span />
          <Button type="button" disabled={!vm.codesSaved || vm.busy} onClick={vm.finishRecoveryCodes}>
            {t('mfa.gate.codes.continue')}
          </Button>
        </S.Actions>
      </>
    )}

    {vm.mode === 'recovery-used' && (
      <>
        <S.Lead>{t('mfa.gate.recovery-used.lead', { left: vm.recoveryCodesLeft })}</S.Lead>
        <S.Actions>
          <Button type="button" variant="ghost" onClick={vm.closeFlow}>{t('mfa.gate.recovery-used.continue')}</Button>
          <Button type="button" onClick={vm.setUpNewAuthenticator}>{t('mfa.gate.recovery-used.setup')}</Button>
        </S.Actions>
      </>
    )}
  </>
);

const TITLE_KEY: Partial<Record<TenantEntryGateViewModel['mode'], string>> = {
  'recovery-codes': 'mfa.gate.codes.title',
  'recovery-used': 'mfa.gate.recovery-used.title',
};

/**
 * A porta entre escolher o escritório e o espaço de trabalho. Ela envolve a pilha de stores do espaço de
 * trabalho: enquanto a entrada não está resolvida, nada abaixo dela monta. Resolvida, ela continua ali —
 * é quem pede o código de novo quando a prova vence, e quem atende os gestos de `useSecondFactorFlow`.
 * O modal desses dois casos é desenhado pelo `SecondFactorFlowHost`, lá dentro, no idioma do escritório.
 */
export const TenantEntryGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const vm = useTenantEntryGateViewModel();
  const t = useT('core.access');

  if (vm.presentation === 'page' && vm.mode === 'no-organization') {
    return (
      <S.Page>
        <S.Card>
          <S.Header><RiBuildingLine size={22} /><S.Title>{t('entry.no-organization.title')}</S.Title></S.Header>
          <S.Lead>{t('entry.no-organization.lead')}</S.Lead>
          <S.Actions>
            <Button type="button" variant="ghost" onClick={vm.signOut}>{t('mfa.gate.sign-out')}</Button>
            <Button type="button" onClick={vm.reload}>{t('entry.no-organization.reload')}</Button>
          </S.Actions>
        </S.Card>
      </S.Page>
    );
  }

  if (vm.presentation === 'page' && vm.mode === 'loading' && !vm.error) {
    return (
      <FullPageSpinner>
        <Spinner size={40} />
      </FullPageSpinner>
    );
  }

  if (vm.presentation === 'page') {
    return (
      <S.Page>
        <S.Card>
          <S.Header>
            <RiShieldKeyholeLine size={22} />
            <S.Title>{t(TITLE_KEY[vm.mode] ?? 'mfa.gate.title')}</S.Title>
          </S.Header>
          <S.Organization>{vm.tenantName}</S.Organization>
          <GateBody vm={vm} t={t} />
          {vm.mode === 'loading' && (
            <>
              <S.Error role="alert">{vm.error}</S.Error>
              <S.Actions>
                <span />
                <Button type="button" onClick={vm.reload}>{t('entry.no-organization.reload')}</Button>
              </S.Actions>
            </>
          )}
          <S.Footer>
            {vm.otherTenants.map((tenant) => (
              <Button key={tenant.id} type="button" variant="ghost" size="sm" onClick={() => vm.switchTenant(tenant.id)}>
                <RiBuildingLine /> {tenant.name}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={vm.signOut}>{t('mfa.gate.sign-out')}</Button>
          </S.Footer>
        </S.Card>
      </S.Page>
    );
  }

  return (
    <TenantEntryGateContext.Provider value={vm}>
      <SecondFactorFlowContext.Provider value={vm.flowApi}>
        {children}
      </SecondFactorFlowContext.Provider>
    </TenantEntryGateContext.Provider>
  );
};

/**
 * O que o `TenantEntryGate` abre por cima do espaço de trabalho já aberto: o pedido de código que venceu,
 * os gestos de Segurança e do Perfil e a faixa que lembra a prova pendente. Mora dentro do
 * `TenantLocaleProvider` para falar o idioma do escritório.
 */
export const SecondFactorFlowHost: React.FC = () => {
  const vm = useSecondFactorFlowHostViewModel();
  const t = useT('core.access');

  return (
    <>
      {vm.presentation === 'modal' && (
        <Modal title={t(TITLE_KEY[vm.mode] ?? (vm.mode === 'verify' ? 'mfa.gate.reverify.title' : 'mfa.gate.title'))} onClose={vm.closeFlow}>
          <S.ModalBody>
            <GateBody vm={vm} t={t} />
          </S.ModalBody>
        </Modal>
      )}
      {vm.reverifyPending && (
        <S.PendingBar role="status">
          {t('mfa.gate.reverify.pending')}
          <Button type="button" size="sm" onClick={vm.reopenReverify}>{t('mfa.gate.reverify.open')}</Button>
        </S.PendingBar>
      )}
    </>
  );
};
