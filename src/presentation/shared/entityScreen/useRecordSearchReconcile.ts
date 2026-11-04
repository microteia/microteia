import { useEffect, useMemo, useRef, useState } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { planRecordSearchBackfill, recordSearchSignature } from '../../../domain/schema/recordSearch';
import type { RecordSearchJobState } from '../../../domain/schema/recordSearch';
import type { ScreenDefinition } from '../../../domain/entities';
import { screenDataCollection } from '../../../domain/services/screenDataCollection';

interface JobSnapshot {
  key: string;
  state: RecordSearchJobState | null;
}

/**
 * A conferência da busca, pedida pela listagem — o molde de `useAggregateBackfillNotice`, sem aviso:
 * a busca continua achando o que achava enquanto o backfill corre, e não há o que a pessoa faça.
 *
 * Cobre o escritório que atualizou o kernel com registros que nunca ganharam termos: ali nenhuma tela
 * muda depois da atualização, e a porta automática (a gravação de tela) nunca dispararia. O primeiro
 * que abre a listagem cura a coleção para todos.
 */
export const useRecordSearchReconcile = (definition: ScreenDefinition | null): void => {
  const { recordSearchJobRepository } = useDI();
  const { currentTenant } = useTenant();

  const tenantId = currentTenant?.id ?? null;
  // O job é da COLEÇÃO, que é a chave que o servidor grava — não da chave da tela.
  const collection = definition ? screenDataCollection(definition) : null;
  const jobKey = tenantId && collection ? `${tenantId}/${collection}` : null;

  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    if (!tenantId || !collection || !jobKey) return undefined;
    return recordSearchJobRepository.subscribeBackfill(tenantId, collection, (state) => setSnapshot({ key: jobKey, state }));
  }, [recordSearchJobRepository, tenantId, collection, jobKey]);

  const job = snapshot && snapshot.key === jobKey ? snapshot : null;
  const signature = useMemo(
    () => (definition ? recordSearchSignature({ titleFieldKey: definition.titleFieldKey, fields: definition.fields }) : null),
    [definition],
  );

  useEffect(() => {
    if (!tenantId || !job || !signature) return;
    const plan = planRecordSearchBackfill(signature, job.state, Date.now());
    if (plan.kind === 'none') return;
    // Uma chamada por situação: a resposta chega pelo próprio job, e uma chamada que falhou não é
    // repetida a cada atualização dele.
    const marker = `${job.key}:${plan.kind}:${signature}`;
    if (requested.current === marker) return;
    requested.current = marker;
    recordSearchJobRepository.reconcile(tenantId).catch(() => undefined);
  }, [recordSearchJobRepository, tenantId, job, signature]);
};
