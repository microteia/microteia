import { useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useSecondFactorFlow } from '../../../../stores/useSecondFactorFlow';
import { useLocaleFormat } from '../../../shared/i18n/useT';
import { makeGetSecondFactorStatusUseCase } from '../../../../domain/usecases/mfa/SecondFactorUseCases';
import type { SecondFactorStatus } from '../../../../domain/schema/memberMfa';

export interface SecondFactorPanelViewModel {
  loading: boolean;
  enrolled: boolean;
  required: boolean;
  enrolledAt: string;
  recoveryCodesLeft: string;
  reverifyMinutes: string;
  setUp: () => void;
  regenerateRecoveryCodes: () => void;
}

/**
 * O PRÓPRIO segundo fator, num escritório: se está cadastrado, se este escritório o exige, quantos
 * códigos de recuperação sobram. Os gestos são do `TenantEntryGate` (`useSecondFactorFlow`) — este
 * painel só mostra e chama. O estado é relido quando a sessão prova o fator de novo, que é o sinal de
 * que um gesto terminou.
 */
export const useSecondFactorPanelViewModel = (): SecondFactorPanelViewModel => {
  const { currentTenant, secondFactor } = useTenant();
  const { memberMfaRepository } = useDI();
  const { setUp, regenerateRecoveryCodes } = useSecondFactorFlow();
  const { formatDate } = useLocaleFormat();
  const getStatus = useMemo(() => makeGetSecondFactorStatusUseCase(memberMfaRepository), [memberMfaRepository]);

  const tenantId = currentTenant?.id ?? null;
  const verifiedAt = secondFactor?.verifiedAt ?? null;
  const [loaded, setLoaded] = useState<{ key: string; status: SecondFactorStatus | null } | null>(null);
  const key = `${tenantId}:${verifiedAt}`;

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    getStatus.execute(tenantId)
      .then((status) => { if (active) setLoaded({ key, status }); })
      .catch(() => { if (active) setLoaded({ key, status: null }); });
    return () => { active = false; };
  }, [tenantId, key, getStatus]);

  const status = loaded?.key === key ? loaded.status : null;

  return {
    loading: loaded?.key !== key,
    enrolled: status?.enrolled ?? false,
    required: status?.required ?? false,
    enrolledAt: status?.enrolledAt ? formatDate(status.enrolledAt) : '',
    recoveryCodesLeft: String(status?.recoveryCodesLeft ?? 0),
    reverifyMinutes: status?.reverifyMinutes ? String(status.reverifyMinutes) : '',
    setUp,
    regenerateRecoveryCodes,
  };
};
