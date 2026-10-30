import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotification } from '../../stores/useNotification';
import { resolveLookupPatch } from '../../domain/schema/fieldChangeSpec';
import type { FieldLookupBinding } from '../../domain/schema/fieldRules';
import type { IExternalLookupService } from '../../domain/services/IExternalLookupService';

export const LOOKUP_DEBOUNCE_MS = 400;

export interface ExternalLookupRequest {
  fieldKey: string;
  value: unknown;
  service: IExternalLookupService;
  binding: FieldLookupBinding;
}

export interface ExternalLookupRunner {
  scheduleLookup: (request: ExternalLookupRequest) => void;
  isFieldLoading: (fieldKey: string) => boolean;
}

/**
 * Quem dispara a busca externa de um campo `onChangeLookup` — o formulário do escritório e o do portal
 * pelo MESMO caminho. Cada um resolve o provedor do seu jeito (o escritório no catálogo das extensões,
 * o portal na declaração que o servidor entrega); daqui para a frente, espera, corrida e mescla são uma
 * regra só.
 *
 * `fieldKeys` são os campos que a resposta pode preencher: no escritório, os da tela; no portal, só os
 * que o convidado pode escrever.
 */
export const useExternalLookupRunner = (
  fieldKeys: ReadonlySet<string>,
  onMergeValues?: (patch: Record<string, unknown>) => void,
): ExternalLookupRunner => {
  const { notify } = useNotification();
  const [loadingKeys, setLoadingKeys] = useState<ReadonlySet<string>>(new Set());

  // Guarda de corrida: só a resposta da última requisição de cada campo é aplicada. Digitar rápido
  // dois CEPs diferentes não pode deixar o endereço do primeiro no formulário.
  const requestSeqRef = useRef<Map<string, number>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const setLoading = useCallback((fieldKey: string, loading: boolean) => {
    setLoadingKeys((prev) => {
      if (loading === prev.has(fieldKey)) return prev;
      const next = new Set(prev);
      if (loading) next.add(fieldKey);
      else next.delete(fieldKey);
      return next;
    });
  }, []);

  const runLookup = useCallback(
    async ({ fieldKey, value, service, binding }: ExternalLookupRequest) => {
      if (!onMergeValues) return;
      const seq = (requestSeqRef.current.get(fieldKey) ?? 0) + 1;
      requestSeqRef.current.set(fieldKey, seq);

      setLoading(fieldKey, true);
      try {
        const outcome = await service.lookup(typeof value === 'string' ? value : String(value ?? ''));

        // Chegou fora de ordem: outra digitação já disparou uma busca mais nova.
        if (requestSeqRef.current.get(fieldKey) !== seq) return;

        if (!outcome.ok) {
          if (outcome.error) notify(outcome.error, 'warning');
          return;
        }
        const patch = resolveLookupPatch(binding, outcome.values, fieldKey, fieldKeys);
        if (Object.keys(patch).length > 0) onMergeValues(patch);
      } finally {
        if (requestSeqRef.current.get(fieldKey) === seq) setLoading(fieldKey, false);
      }
    },
    [fieldKeys, notify, onMergeValues, setLoading],
  );

  const scheduleLookup = useCallback(
    (request: ExternalLookupRequest) => {
      const pending = timersRef.current.get(request.fieldKey);
      if (pending) clearTimeout(pending);
      timersRef.current.set(
        request.fieldKey,
        setTimeout(() => {
          timersRef.current.delete(request.fieldKey);
          void runLookup(request);
        }, LOOKUP_DEBOUNCE_MS),
      );
    },
    [runLookup],
  );

  const isFieldLoading = useCallback((fieldKey: string) => loadingKeys.has(fieldKey), [loadingKeys]);

  return { scheduleLookup, isFieldLoading };
};
