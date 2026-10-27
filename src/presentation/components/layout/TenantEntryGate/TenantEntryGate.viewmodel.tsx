import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { useDI } from '../../../../infrastructure/di/useDI';
import type { SecondFactorFlowValue } from '../../../../stores/useSecondFactorFlow';
import { useLabel, useLocaleFormat } from '../../../shared/i18n/useT';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import { MFA_STEP_UP_SECONDS, mfaSessionExpiresAt } from '../../../../domain/schema/memberMfa';
import type { SecondFactorEnrollment, SecondFactorStatus } from '../../../../domain/schema/memberMfa';
import {
  makeConfirmSecondFactorUseCase,
  makeEnrollSecondFactorUseCase,
  makeGetSecondFactorStatusUseCase,
  makeRegenerateRecoveryCodesUseCase,
  makeVerifySecondFactorUseCase,
} from '../../../../domain/usecases/mfa/SecondFactorUseCases';

export type TenantEntryGateMode =
  | 'open'
  | 'no-organization'
  | 'loading'
  | 'verify'
  | 'step-up'
  | 'enroll-intro'
  | 'enroll-scan'
  | 'recovery-codes'
  | 'recovery-used';

/**
 * `page` toma a tela inteira — a entrada ainda não aconteceu, e nada do espaço de trabalho monta.
 * `modal` abre por cima do espaço de trabalho já aberto — o pedido de código que venceu, ou um gesto que
 * a pessoa começou em Segurança ou no Perfil —, e nada do que estava na tela se perde.
 */
export type TenantEntryGatePresentation = 'page' | 'modal' | 'none';

type StepUpTarget = 'setup' | 'recovery-codes';

type Flow =
  | { kind: 'idle' }
  | { kind: 'step-up'; then: StepUpTarget }
  | { kind: 'enroll-intro'; replacing: boolean }
  | { kind: 'enroll-scan'; enrollment: SecondFactorEnrollment; replacing: boolean }
  | { kind: 'recovery-codes'; codes: string[]; token: string | null }
  | { kind: 'recovery-used'; left: number };

export interface TenantOption {
  id: string;
  name: string;
}

export interface TenantEntryGateViewModel {
  mode: TenantEntryGateMode;
  presentation: TenantEntryGatePresentation;
  /** Fechado o pedido de código, a faixa continua lembrando — gravar segue recusado até o código. */
  reverifyPending: boolean;
  flowApi: SecondFactorFlowValue;
  tenantName: string;
  otherTenants: TenantOption[];
  code: string;
  useRecoveryCode: boolean;
  busy: boolean;
  error: string | null;
  lockedUntil: string | null;
  reverifyMinutes: string;
  replacing: boolean;
  secret: string;
  secretPlain: string;
  otpauthUri: string;
  qrDataUrl: string | null;
  recoveryCodes: string[];
  recoveryCodesText: string;
  recoveryCodesLeft: string;
  codesSaved: boolean;
  setCode: (value: string) => void;
  toggleRecoveryCode: () => void;
  setCodesSaved: (value: boolean) => void;
  onSubmitCode: (event: FormEvent) => void;
  startEnrollment: () => void;
  finishRecoveryCodes: () => void;
  downloadRecoveryCodes: () => void;
  setUpNewAuthenticator: () => void;
  closeFlow: () => void;
  reopenReverify: () => void;
  switchTenant: (tenantId: string) => void;
  signOut: () => void;
  reload: () => void;
}

/** O segredo em grupos de quatro: é assim que se digita num aplicativo sem errar a posição. */
const groupSecret = (secret: string): string => secret.replace(/(.{4})/g, '$1 ').trim();

/**
 * A ENTRADA no escritório: o que precisa acontecer entre escolher o escritório e ver o espaço de trabalho.
 *
 * Duas coisas param a entrada, e as duas são estados, não falhas: a conta que ainda não foi adicionada a
 * escritório nenhum, e o segundo fator que o escritório exige e esta sessão não provou. Enquanto uma
 * delas valer, os stores do espaço de trabalho nem montam — cada um faria uma leitura que as regras
 * recusam, e a tela mostraria uma dúzia de erros em vez de uma pergunta.
 *
 * A prova que VENCE com a tela aberta é outro caso: a leitura continua valendo, só gravar pede o código
 * de novo. Por isso ali não se desmonta nada — abre-se um pedido por cima.
 */
export const useTenantEntryGateViewModel = (): TenantEntryGateViewModel => {
  const {
    currentTenant,
    availableTenants,
    awaitingOrganization,
    secondFactor,
    completeSecondFactor,
    selectTenant,
  } = useTenant();
  const { signOut } = useAuth();
  const { memberMfaRepository } = useDI();
  const label = useLabel();
  const { formatDateTime } = useLocaleFormat();

  const uc = useMemo(() => ({
    status: makeGetSecondFactorStatusUseCase(memberMfaRepository),
    enroll: makeEnrollSecondFactorUseCase(memberMfaRepository),
    confirm: makeConfirmSecondFactorUseCase(memberMfaRepository),
    verify: makeVerifySecondFactorUseCase(memberMfaRepository),
    regenerate: makeRegenerateRecoveryCodesUseCase(memberMfaRepository),
  }), [memberMfaRepository]);

  const tenantId = currentTenant?.id ?? null;
  const gate = secondFactor && secondFactor.tenantId === tenantId ? secondFactor : null;
  const verifiedAt = gate?.verifiedAt ?? null;
  const blocked = !!gate?.requirement && verifiedAt === null;

  const [flow, setFlow] = useState<Flow>({ kind: 'idle' });
  const [status, setStatus] = useState<{ tenantId: string; value: SecondFactorStatus } | null>(null);
  const [code, setCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codesSaved, setCodesSaved] = useState(false);
  const [qr, setQr] = useState<{ uri: string; dataUrl: string } | null>(null);
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  const [reverifyDismissed, setReverifyDismissed] = useState<number | null>(null);

  const describe = useCallback(
    (cause: unknown) => label(
      cause instanceof Error && cause.message.startsWith('@') ? cause.message : '@core.access/mfa.failed',
      errorParamsOf(cause),
    ),
    [label],
  );

  const statusNeeded = blocked || flow.kind === 'step-up';
  useEffect(() => {
    if (!statusNeeded || !tenantId || status?.tenantId === tenantId) return;
    let active = true;
    uc.status.execute(tenantId)
      .then((value) => { if (active) setStatus({ tenantId, value }); })
      .catch((cause: unknown) => { if (active) setError(describe(cause)); });
    return () => { active = false; };
  }, [statusNeeded, tenantId, status, uc.status, describe]);

  const expiresAt = mfaSessionExpiresAt(gate?.requirement ?? null, verifiedAt);
  useEffect(() => {
    if (expiresAt === null) return;
    const timer = setTimeout(() => setExpiredAt(expiresAt), Math.max(0, expiresAt * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const expired = expiresAt !== null && expiredAt === expiresAt;

  const enrollmentUri = flow.kind === 'enroll-scan' ? flow.enrollment.uri : null;
  useEffect(() => {
    if (!enrollmentUri) return;
    let active = true;
    void import('qrcode-generator').then(({ default: qrcode }) => {
      const image = qrcode(0, 'M');
      image.addData(enrollmentUri);
      image.make();
      if (active) setQr({ uri: enrollmentUri, dataUrl: image.createDataURL(5, 4) });
    });
    return () => { active = false; };
  }, [enrollmentUri]);

  const reverifying = !blocked && flow.kind === 'idle' && expired && reverifyDismissed !== expiresAt;

  let mode: TenantEntryGateMode = 'open';
  if (awaitingOrganization) mode = 'no-organization';
  else if (flow.kind !== 'idle') mode = flow.kind;
  else if (blocked) {
    if (status?.tenantId !== tenantId) mode = 'loading';
    else mode = status.value.enrolled ? 'verify' : 'enroll-intro';
  } else if (reverifying) mode = 'verify';

  let presentation: TenantEntryGatePresentation = 'none';
  if (awaitingOrganization || blocked) presentation = 'page';
  else if (mode !== 'open') presentation = 'modal';

  const resetInput = useCallback(() => {
    setCode('');
    setError(null);
    setUseRecoveryCode(false);
  }, []);

  /** A prova desta sessão é recente o bastante para mexer no próprio fator — a mesma conta do servidor. */
  const sessionIsFresh = useCallback(
    () => verifiedAt !== null && Math.floor(Date.now() / 1000) - verifiedAt < MFA_STEP_UP_SECONDS,
    [verifiedAt],
  );

  const showRecoveryCodes = useCallback(async (token: string | null) => {
    if (!tenantId) return;
    const codes = await uc.regenerate.execute(tenantId);
    setCodesSaved(false);
    setFlow({ kind: 'recovery-codes', codes, token });
  }, [tenantId, uc.regenerate]);

  const continueStepUp = useCallback(async (target: StepUpTarget) => {
    if (target === 'setup') setFlow({ kind: 'enroll-intro', replacing: true });
    else await showRecoveryCodes(null);
  }, [showRecoveryCodes]);

  const startEnrollment = useCallback(() => {
    if (!tenantId) return;
    const replacing = flow.kind === 'enroll-intro' && flow.replacing;
    setBusy(true);
    setError(null);
    uc.enroll.execute(tenantId, window.location.hostname)
      .then((enrollment) => {
        resetInput();
        setFlow({ kind: 'enroll-scan', enrollment, replacing });
      })
      .catch((cause: unknown) => setError(describe(cause)))
      .finally(() => setBusy(false));
  }, [tenantId, flow, uc.enroll, resetInput, describe]);

  const submitCode = useCallback(() => {
    if (!tenantId || code.trim() === '' || busy) return;
    setBusy(true);
    setError(null);
    const finish = async () => {
      if (flow.kind === 'enroll-scan') {
        const session = await uc.confirm.execute(tenantId, code);
        setCodesSaved(false);
        setFlow({ kind: 'recovery-codes', codes: session.recoveryCodes ?? [], token: session.token });
        return;
      }
      const session = await uc.verify.execute(tenantId, code);
      await completeSecondFactor(session.token);
      setReverifyDismissed(null);
      if (flow.kind === 'step-up') await continueStepUp(flow.then);
      else if (session.usedRecoveryCode) setFlow({ kind: 'recovery-used', left: session.recoveryCodesLeft });
    };
    finish()
      .then(resetInput)
      .catch((cause: unknown) => {
        setError(describe(cause));
        setStatus(null);
      })
      .finally(() => setBusy(false));
  }, [tenantId, code, busy, flow, uc.confirm, uc.verify, completeSecondFactor, continueStepUp, resetInput, describe]);

  // Os códigos só se fecham com a sessão aberta DEPOIS de a pessoa dizer que os guardou: abrir antes
  // tiraria a tela que os mostra, e eles não aparecem nunca mais.
  const finishRecoveryCodes = useCallback(() => {
    if (flow.kind !== 'recovery-codes' || !codesSaved) return;
    setBusy(true);
    (flow.token ? completeSecondFactor(flow.token) : Promise.resolve())
      .then(() => {
        setFlow({ kind: 'idle' });
        setStatus(null);
      })
      .catch((cause: unknown) => setError(describe(cause)))
      .finally(() => setBusy(false));
  }, [flow, codesSaved, completeSecondFactor, describe]);

  const recoveryCodes = flow.kind === 'recovery-codes' ? flow.codes : [];
  const recoveryCodesText = recoveryCodes.join('\n');

  const downloadRecoveryCodes = useCallback(() => {
    const blob = new Blob([`${recoveryCodesText}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${window.location.hostname}-recovery-codes.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [recoveryCodesText]);

  const switchTenant = useCallback((id: string) => {
    resetInput();
    setFlow({ kind: 'idle' });
    void selectTenant(id);
  }, [resetInput, selectTenant]);

  const setUp = useCallback(() => {
    if (!tenantId) return;
    resetInput();
    setBusy(true);
    uc.status.execute(tenantId)
      .then((value) => {
        setStatus({ tenantId, value });
        if (!value.enrolled) setFlow({ kind: 'enroll-intro', replacing: false });
        else if (sessionIsFresh()) setFlow({ kind: 'enroll-intro', replacing: true });
        else setFlow({ kind: 'step-up', then: 'setup' });
      })
      .catch((cause: unknown) => setError(describe(cause)))
      .finally(() => setBusy(false));
  }, [tenantId, uc.status, sessionIsFresh, resetInput, describe]);

  const regenerateRecoveryCodes = useCallback(() => {
    resetInput();
    if (!sessionIsFresh()) {
      setFlow({ kind: 'step-up', then: 'recovery-codes' });
      return;
    }
    setBusy(true);
    showRecoveryCodes(null)
      .catch((cause: unknown) => {
        setFlow({ kind: 'step-up', then: 'recovery-codes' });
        setError(describe(cause));
      })
      .finally(() => setBusy(false));
  }, [sessionIsFresh, showRecoveryCodes, resetInput, describe]);

  const flowApi = useMemo<SecondFactorFlowValue>(
    () => ({ setUp, regenerateRecoveryCodes }),
    [setUp, regenerateRecoveryCodes],
  );

  const lockedUntilIso = status?.tenantId === tenantId ? status.value.lockedUntil : null;

  return {
    mode,
    presentation,
    reverifyPending: !blocked && flow.kind === 'idle' && expired && reverifyDismissed === expiresAt,
    flowApi,
    tenantName: currentTenant?.name ?? '',
    otherTenants: availableTenants
      .filter((tenant) => tenant.id !== tenantId)
      .map((tenant) => ({ id: tenant.id, name: tenant.name })),
    code,
    useRecoveryCode,
    busy,
    error,
    lockedUntil: lockedUntilIso ? formatDateTime(lockedUntilIso) : null,
    reverifyMinutes: gate?.requirement ? String(gate.requirement.maxAgeSeconds / 60) : '',
    replacing: (flow.kind === 'enroll-intro' || flow.kind === 'enroll-scan') && flow.replacing,
    secret: flow.kind === 'enroll-scan' ? groupSecret(flow.enrollment.secret) : '',
    secretPlain: flow.kind === 'enroll-scan' ? flow.enrollment.secret : '',
    otpauthUri: enrollmentUri ?? '',
    qrDataUrl: qr && qr.uri === enrollmentUri ? qr.dataUrl : null,
    recoveryCodes,
    recoveryCodesText,
    recoveryCodesLeft: flow.kind === 'recovery-used' ? String(flow.left) : '',
    codesSaved,
    setCode,
    toggleRecoveryCode: () => {
      setUseRecoveryCode((value) => !value);
      setCode('');
      setError(null);
    },
    setCodesSaved,
    onSubmitCode: (event) => {
      event.preventDefault();
      submitCode();
    },
    startEnrollment,
    finishRecoveryCodes,
    downloadRecoveryCodes,
    setUpNewAuthenticator: () => {
      resetInput();
      setFlow({ kind: 'enroll-intro', replacing: true });
    },
    // Fechar o pedido de código que venceu deixa a faixa; fechar um gesto começado pela pessoa só o
    // abandona. Os códigos recém-sorteados não se abandonam: quem os fecha é "Continuar".
    closeFlow: () => {
      resetInput();
      if (reverifying) setReverifyDismissed(expiresAt);
      else if (flow.kind !== 'recovery-codes') setFlow({ kind: 'idle' });
    },
    reopenReverify: () => setReverifyDismissed(null),
    switchTenant,
    signOut: () => { void signOut(); },
    reload: () => window.location.reload(),
  };
};
