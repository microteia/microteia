// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { TenantSecondFactor } from '../../../../stores/useTenant';
import type { SecondFactorStatus } from '../../../../domain/schema/memberMfa';

const tenant = { id: 't1', name: 'Prefeitura' };
const state: {
  awaitingOrganization: boolean;
  secondFactor: TenantSecondFactor | null;
  status: SecondFactorStatus;
} = { awaitingOrganization: false, secondFactor: null, status: {} as SecondFactorStatus };

const completeSecondFactor = vi.fn<(token: string) => Promise<void>>(async () => undefined);
const repo = {
  status: vi.fn(async () => state.status),
  enroll: vi.fn(async () => ({ secret: 'ABCDEFGHIJKLMNOP', uri: 'otpauth://totp/x:y?secret=ABCDEFGHIJKLMNOP', expiresAt: '' })),
  confirm: vi.fn(async () => ({ token: 'token-enroll', verifiedAt: 1, recoveryCodesLeft: 10, usedRecoveryCode: false, recoveryCodes: ['aaaaa-bbbbb'] })),
  verify: vi.fn(async () => ({ token: 'token-verify', verifiedAt: 1, recoveryCodesLeft: 10, usedRecoveryCode: false })),
  regenerateRecoveryCodes: vi.fn(async () => ['ccccc-ddddd']),
};

vi.mock('../../../../stores/useTenant', () => ({
  useTenant: () => ({
    currentTenant: tenant,
    availableTenants: [tenant, { id: 't2', name: 'Outra' }],
    awaitingOrganization: state.awaitingOrganization,
    secondFactor: state.secondFactor,
    completeSecondFactor,
    selectTenant: vi.fn(),
  }),
}));
vi.mock('../../../../stores/useAuth', () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('../../../../infrastructure/di/useDI', () => ({ useDI: () => ({ memberMfaRepository: repo }) }));
// Estáveis entre renders, como os de verdade: uma função nova a cada render refaria os efeitos que
// dependem dela e cancelaria a chamada em voo.
const label = (value: string) => value;
const formatters = { formatDateTime: (value: string) => value };
vi.mock('../../../shared/i18n/useT', () => ({
  useLabel: () => label,
  useLocaleFormat: () => formatters,
}));

import { useTenantEntryGateViewModel } from './TenantEntryGate.viewmodel';

const nowSeconds = () => Math.floor(Date.now() / 1000);
const status = (extra: Partial<SecondFactorStatus>): SecondFactorStatus => ({
  required: true,
  reverifyMinutes: 60,
  enrolled: true,
  enrolledAt: null,
  recoveryCodesLeft: 10,
  lockedUntil: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.awaitingOrganization = false;
  state.secondFactor = null;
  state.status = status({});
});

describe('a entrada no escritório', () => {
  it('sem exigência, o espaço de trabalho abre e nada é perguntado ao servidor', () => {
    state.secondFactor = { tenantId: 't1', requirement: null, verifiedAt: null };
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    expect(result.current.mode).toBe('open');
    expect(result.current.presentation).toBe('none');
    expect(repo.status).not.toHaveBeenCalled();
  });

  it('a conta sem escritório vê a explicação, e não um erro', () => {
    state.awaitingOrganization = true;
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    expect(result.current.mode).toBe('no-organization');
    expect(result.current.presentation).toBe('page');
  });

  it('exigido e não provado: a página pede o código, e o código abre a sessão', async () => {
    state.secondFactor = { tenantId: 't1', requirement: { maxAgeSeconds: 3600 }, verifiedAt: null };
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    expect(result.current.mode).toBe('loading');
    await waitFor(() => expect(result.current.mode).toBe('verify'));
    expect(result.current.presentation).toBe('page');
    expect(result.current.otherTenants).toEqual([{ id: 't2', name: 'Outra' }]);

    act(() => result.current.setCode('123456'));
    act(() => result.current.onSubmitCode({ preventDefault: vi.fn() } as never));
    await waitFor(() => expect(completeSecondFactor).toHaveBeenCalledWith('token-verify'));
    expect(repo.verify).toHaveBeenCalledWith('t1', '123456');
  });

  it('sem fator cadastrado: cadastra, mostra os códigos, e só abre a sessão depois de a pessoa dizer que os guardou', async () => {
    state.secondFactor = { tenantId: 't1', requirement: { maxAgeSeconds: 3600 }, verifiedAt: null };
    state.status = status({ enrolled: false });
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    await waitFor(() => expect(result.current.mode).toBe('enroll-intro'));

    act(() => result.current.startEnrollment());
    await waitFor(() => expect(result.current.mode).toBe('enroll-scan'));
    expect(result.current.secret).toBe('ABCD EFGH IJKL MNOP');
    expect(result.current.secretPlain).toBe('ABCDEFGHIJKLMNOP');
    await waitFor(() => expect(result.current.qrDataUrl).toMatch(/^data:image\/gif;base64,/));

    act(() => result.current.setCode('654321'));
    act(() => result.current.onSubmitCode({ preventDefault: vi.fn() } as never));
    await waitFor(() => expect(result.current.mode).toBe('recovery-codes'));
    expect(result.current.recoveryCodes).toEqual(['aaaaa-bbbbb']);

    act(() => result.current.finishRecoveryCodes());
    expect(completeSecondFactor).not.toHaveBeenCalled();
    act(() => result.current.setCodesSaved(true));
    act(() => result.current.finishRecoveryCodes());
    await waitFor(() => expect(completeSecondFactor).toHaveBeenCalledWith('token-enroll'));
  });

  it('se o estado não vem, a página diz por quê em vez de girar para sempre', async () => {
    state.secondFactor = { tenantId: 't1', requirement: { maxAgeSeconds: 3600 }, verifiedAt: null };
    repo.status.mockRejectedValueOnce(new Error('@core.access/mfa.failed'));
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    await waitFor(() => expect(result.current.error).toBe('@core.access/mfa.failed'));
    expect(result.current.mode).toBe('loading');
    expect(result.current.presentation).toBe('page');
  });

  it('o código errado fica na tela, com o motivo, e o estado é relido', async () => {
    state.secondFactor = { tenantId: 't1', requirement: { maxAgeSeconds: 3600 }, verifiedAt: null };
    repo.verify.mockRejectedValueOnce(Object.assign(new Error('@core.access/mfa.code.invalid'), { details: { attempts: 4 } }));
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    await waitFor(() => expect(result.current.mode).toBe('verify'));

    act(() => result.current.setCode('000000'));
    act(() => result.current.onSubmitCode({ preventDefault: vi.fn() } as never));
    await waitFor(() => expect(result.current.error).toBe('@core.access/mfa.code.invalid'));
    expect(completeSecondFactor).not.toHaveBeenCalled();
    await waitFor(() => expect(repo.status).toHaveBeenCalledTimes(2));
  });

  it('entrou com código de recuperação: oferece cadastrar outro celular', async () => {
    state.secondFactor = { tenantId: 't1', requirement: { maxAgeSeconds: 3600 }, verifiedAt: null };
    repo.verify.mockResolvedValueOnce({ token: 'token-r', verifiedAt: 1, recoveryCodesLeft: 3, usedRecoveryCode: true });
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    await waitFor(() => expect(result.current.mode).toBe('verify'));

    act(() => result.current.toggleRecoveryCode());
    act(() => result.current.setCode('aaaaa-bbbbb'));
    act(() => result.current.onSubmitCode({ preventDefault: vi.fn() } as never));
    await waitFor(() => expect(result.current.mode).toBe('recovery-used'));
    expect(result.current.recoveryCodesLeft).toBe('3');

    act(() => result.current.setUpNewAuthenticator());
    expect(result.current.mode).toBe('enroll-intro');
    expect(result.current.replacing).toBe(true);
  });
});

describe('com o espaço de trabalho aberto', () => {
  it('a prova vence: o pedido abre POR CIMA, e fechá-lo deixa a faixa', async () => {
    state.secondFactor = { tenantId: 't1', requirement: { maxAgeSeconds: 60 }, verifiedAt: nowSeconds() - 120 };
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    await waitFor(() => expect(result.current.mode).toBe('verify'));
    expect(result.current.presentation).toBe('modal');
    expect(result.current.reverifyMinutes).toBe('1');

    act(() => result.current.closeFlow());
    expect(result.current.presentation).toBe('none');
    expect(result.current.reverifyPending).toBe(true);

    act(() => result.current.reopenReverify());
    expect(result.current.presentation).toBe('modal');
  });

  it('códigos novos pedem antes a prova recente; recente, saem direto', async () => {
    state.secondFactor = { tenantId: 't1', requirement: null, verifiedAt: nowSeconds() - 3600 };
    const stale = renderHook(() => useTenantEntryGateViewModel());
    act(() => stale.result.current.flowApi.regenerateRecoveryCodes());
    expect(stale.result.current.mode).toBe('step-up');
    expect(stale.result.current.presentation).toBe('modal');
    expect(repo.regenerateRecoveryCodes).not.toHaveBeenCalled();

    state.secondFactor = { tenantId: 't1', requirement: null, verifiedAt: nowSeconds() };
    const fresh = renderHook(() => useTenantEntryGateViewModel());
    act(() => fresh.result.current.flowApi.regenerateRecoveryCodes());
    await waitFor(() => expect(fresh.result.current.mode).toBe('recovery-codes'));
    expect(fresh.result.current.recoveryCodes).toEqual(['ccccc-ddddd']);

    act(() => fresh.result.current.setCodesSaved(true));
    act(() => fresh.result.current.finishRecoveryCodes());
    await waitFor(() => expect(fresh.result.current.mode).toBe('open'));
    expect(completeSecondFactor).not.toHaveBeenCalled();
  });

  it('cadastrar por vontade própria não pede prova quando ainda não há fator', async () => {
    state.secondFactor = { tenantId: 't1', requirement: null, verifiedAt: null };
    state.status = status({ required: false, enrolled: false });
    const { result } = renderHook(() => useTenantEntryGateViewModel());
    act(() => result.current.flowApi.setUp());
    await waitFor(() => expect(result.current.mode).toBe('enroll-intro'));
    expect(result.current.replacing).toBe(false);
    expect(result.current.presentation).toBe('modal');
  });
});
