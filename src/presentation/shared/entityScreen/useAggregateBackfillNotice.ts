import { useEffect, useMemo, useRef, useState } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { declaredAggregationSignatures, planAggregateBackfill } from '../../../domain/schema/aggregateBackfill';
import type { AggregateBackfillState } from '../../../domain/schema/aggregateBackfill';
import { aggregateBackfillNotice } from '../../../domain/services/aggregateBackfillNotice';
import type { ScreenDefinition } from '../../../domain/entities';
import { screenDataCollection } from '../../../domain/services/screenDataCollection';
import { useLabel, useT } from '../i18n/useT';

export interface AggregateBackfillNoticeView {
  message: string;
  variant: 'info' | 'warning';
}

interface JobSnapshot {
  key: string;
  state: AggregateBackfillState | null;
}

/**
 * O recálculo dos agregados de uma tela, visto da listagem dela.
 *
 * Duas coisas, e nenhuma é um botão. A primeira é o AVISO: uma passada em curso explica o campo vazio,
 * uma bloqueada diz qual declaração corrigir, uma com falhas conta os registros. A segunda é a
 * CONFERÊNCIA: quando a tela declara um agregado que o job ainda não recalculou — o caso do escritório
 * que já tinha agregados antes de o recálculo existir, em que nenhuma tela muda depois da atualização —
 * o próprio app pede ao servidor que o ponha em marcha. É o molde de `syncTenantPermissions`: o
 * primeiro que abre a tela cura o escritório inteiro.
 */
export const useAggregateBackfillNotice = (
  definition: ScreenDefinition | null,
): AggregateBackfillNoticeView | null => {
  const { aggregateBackfillRepository } = useDI();
  const { currentTenant } = useTenant();
  const t = useT('core.records');
  const label = useLabel();

  const tenantId = currentTenant?.id ?? null;
  // O job é da COLEÇÃO, que é a chave que o servidor grava — não da chave da tela.
  const table = definition ? screenDataCollection(definition) : null;
  const jobKey = tenantId && table ? `${tenantId}/${table}` : null;

  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    if (!tenantId || !table || !jobKey) return undefined;
    return aggregateBackfillRepository.subscribe(tenantId, table, (state) => setSnapshot({ key: jobKey, state }));
  }, [aggregateBackfillRepository, tenantId, table, jobKey]);

  const job = snapshot && snapshot.key === jobKey ? snapshot : null;
  const declared = useMemo(() => declaredAggregationSignatures(definition?.fields ?? []), [definition]);

  useEffect(() => {
    if (!tenantId || !job) return;
    const plan = planAggregateBackfill(declared, job.state, Date.now());
    if (plan.kind !== 'start' && plan.kind !== 'nudge') return;

    // Uma chamada por situação: a resposta do servidor chega pelo próprio job, e uma chamada que
    // falhou não é repetida a cada atualização dele.
    const marker = `${job.key}:${plan.kind}:${JSON.stringify(declared)}`;
    if (requested.current === marker) return;
    requested.current = marker;
    aggregateBackfillRepository.reconcile(tenantId).catch(() => undefined);
  }, [aggregateBackfillRepository, tenantId, job, declared]);

  return useMemo(() => {
    const fieldLabel = (key: string): string =>
      label(definition?.fields.find((field) => field.key === key)?.label ?? key);
    const notice = aggregateBackfillNotice(job?.state ?? null, fieldLabel);
    return notice ? { message: t(notice.messageKey, notice.params), variant: notice.variant } : null;
  }, [job, definition, label, t]);
};
