import { useEffect, useMemo, useRef, useState } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { useAuthorization } from '../../../stores/useAuthorization';
import { planRecordKeyAdoption } from '../../../domain/schema/recordKeyAdoption';
import type { RecordKeyAdoptionState } from '../../../domain/schema/recordKeyAdoption';
import { recordKeyAdoptionNotices } from '../../../domain/services/recordKeyAdoptionNotice';
import { recordKeySignaturesFor, recordKeysFor } from '../../../data/utils/recordRulesGate';
import type { ScreenDefinition } from '../../../domain/entities';
import { useLabel, useT } from '../i18n/useT';

export interface RecordKeyAdoptionNoticeView {
  message: string;
  variant: 'info' | 'warning';
}

interface JobSnapshot {
  key: string;
  state: RecordKeyAdoptionState | null;
}

/**
 * A adoção das chaves de uma tela, vista da listagem dela — para quem administra telas.
 *
 * O AVISO é de quem pode resolver: a varredura em curso, a formatação que falta, e sobretudo os
 * valores repetidos que impedem a chave de valer. Quem só usa a tela não precisa dele — o valor novo
 * repetido já é recusado no formulário, com a mensagem de sempre.
 *
 * A CONFERÊNCIA é o molde de `useAggregateBackfillNotice`: o escritório que já tinha chaves antes de a
 * adoção existir não muda tela nenhuma depois da atualização, e o primeiro administrador que abre a
 * listagem põe a adoção em marcha.
 */
export const useRecordKeyAdoptionNotice = (
  definition: ScreenDefinition | null,
): RecordKeyAdoptionNoticeView[] => {
  const { recordKeyAdoptionRepository } = useDI();
  const { currentTenant } = useTenant();
  const { can } = useAuthorization();
  const t = useT('core.records');
  const label = useLabel();

  const manages = can('screens.manage');
  const tenantId = currentTenant?.id ?? null;
  const collection = definition ? definition.dataCollection ?? definition.id : null;
  const declared = useMemo(
    () => (collection && definition ? recordKeySignaturesFor(collection) : {}),
    [collection, definition],
  );
  const hasKeys = Object.keys(declared).length > 0;
  const jobKey = manages && hasKeys && tenantId && collection ? `${tenantId}/${collection}` : null;

  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    if (!jobKey || !tenantId || !collection) return undefined;
    return recordKeyAdoptionRepository.subscribe(tenantId, collection, (state) => setSnapshot({ key: jobKey, state }));
  }, [recordKeyAdoptionRepository, tenantId, collection, jobKey]);

  const job = snapshot && snapshot.key === jobKey ? snapshot : null;

  useEffect(() => {
    if (!tenantId || !job) return;
    const plan = planRecordKeyAdoption(declared, job.state, Date.now());
    if (plan.kind !== 'start' && plan.kind !== 'nudge') return;

    const marker = `${job.key}:${plan.kind}:${JSON.stringify(declared)}`;
    if (requested.current === marker) return;
    requested.current = marker;
    recordKeyAdoptionRepository.reconcile(tenantId).catch(() => undefined);
  }, [recordKeyAdoptionRepository, tenantId, job, declared]);

  return useMemo(() => {
    if (!job || !collection) return [];
    const keys = recordKeysFor(collection);
    const fieldLabel = (key: string): string =>
      label(definition?.fields.find((field) => field.key === key)?.label ?? key);
    const keyLabel = (name: string): string => {
      const spec = keys.find((key) => key.name === name);
      return spec ? spec.fields.map(fieldLabel).join(' + ') : name;
    };
    return recordKeyAdoptionNotices(job.state, keyLabel).map((notice) => ({
      message: t(notice.messageKey, notice.params),
      variant: notice.variant,
    }));
  }, [job, collection, definition, label, t]);
};
