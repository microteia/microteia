import React, { useEffect, useMemo, useState } from 'react';
import { PlanContext } from './usePlan';
import { useTenant } from './useTenant';
import { useDI } from '../infrastructure/di/useDI';
import type { PlanDefinition } from '../domain/schema/plans';

/**
 * O plano do escritório corrente (#24) — o teto que o `AuthorizationStore` aplica e o nome que a barra
 * de status mostra.
 *
 * Assinado ao vivo, e por isso sem `visibilitychange` nem evento de store: quando o `SYSTEM` muda o
 * teto, a tela de quem está no escritório estreita na hora, junto com a materialização que as rules
 * leem. Ler uma vez deixaria a tela oferecendo, até recarregar, o que o servidor já recusa.
 *
 * Falhar é tratado como "sem plano": a tela fica sem restrição, e quem decide é a regra — que lê o
 * conjunto materializado, e não este documento.
 */
export const PlanStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { planRepository } = useDI();
  const { currentTenant } = useTenant();
  const planId = currentTenant?.plan ?? null;

  const [loaded, setLoaded] = useState<{ planId: string; plan: PlanDefinition | null } | null>(null);

  useEffect(() => {
    if (!planId) return undefined;
    return planRepository.subscribePlan(
      planId,
      (plan) => setLoaded({ planId, plan }),
      () => setLoaded({ planId, plan: null }),
    );
  }, [planId, planRepository]);

  const value = useMemo(() => {
    const current = planId && loaded?.planId === planId ? loaded : null;
    return {
      currentPlan: current?.plan ?? null,
      isLoading: planId !== null && current === null,
    };
  }, [planId, loaded]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};
