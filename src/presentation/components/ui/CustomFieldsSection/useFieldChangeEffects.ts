import { useCallback, useEffect, useRef, useState } from 'react';
import { useExternalLookupProviders } from '../../../shared/useExternalLookupProviders';
import { useNotification } from '../../../../stores/useNotification';
import { resolveLookupPatch, resolveOnChangePatch } from '../../../../domain/schema/fieldChangeSpec';
import type { RecordResolver } from '../../../../domain/schema/referenceScope';
import type { FieldDefinition } from '../../../../domain/entities';

const LOOKUP_DEBOUNCE_MS = 400;

export interface FieldChangeEffectsInput {
  fields: FieldDefinition[];
  values: Record<string, unknown>;
  resolveRecord: RecordResolver;
  onMergeValues?: (patch: Record<string, unknown>) => void;
  /** Situação do formulário, exposta à expressão `onChange` como `isNew`. */
  isNew: boolean;
}

export interface FieldChangeEffects {
  runFieldChangeEffects: (fieldKey: string, value: unknown) => void;
  isFieldLoading: (fieldKey: string) => boolean;
}

/**
 * Efeitos disparados quando um campo muda: a expressão `onChange` (síncrona) e a busca externa
 * `onChangeLookup` (assíncrona). Ambas produzem um objeto, mesclado pelo mesmo caminho.
 */
export const useFieldChangeEffects = (input: FieldChangeEffectsInput): FieldChangeEffects => {
  const { fields, values, resolveRecord, onMergeValues, isNew } = input;
  const externalLookupServices = useExternalLookupProviders();
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
    async (field: FieldDefinition, rawValue: unknown) => {
      const binding = field.logic?.onChangeLookup;
      if (!binding || !onMergeValues) return;

      const service = externalLookupServices.find((candidate) => candidate.key === binding.provider);
      if (!service) return;

      const seq = (requestSeqRef.current.get(field.key) ?? 0) + 1;
      requestSeqRef.current.set(field.key, seq);

      setLoading(field.key, true);
      try {
        const outcome = await service.lookup(typeof rawValue === 'string' ? rawValue : String(rawValue ?? ''));

        // Chegou fora de ordem: outra digitação já disparou uma busca mais nova.
        if (requestSeqRef.current.get(field.key) !== seq) return;

        if (!outcome.ok) {
          if (outcome.error) notify(outcome.error, 'warning');
          return;
        }
        const fieldKeys = new Set(fields.map((candidate) => candidate.key));
        const patch = resolveLookupPatch(binding, outcome.values, field.key, fieldKeys);
        if (Object.keys(patch).length > 0) onMergeValues(patch);
      } finally {
        if (requestSeqRef.current.get(field.key) === seq) setLoading(field.key, false);
      }
    },
    [externalLookupServices, fields, notify, onMergeValues, setLoading],
  );

  const runFieldChangeEffects = useCallback(
    (fieldKey: string, value: unknown) => {
      const field = fields.find((candidate) => candidate.key === fieldKey);
      if (!field?.logic || !onMergeValues) return;

      // `isDirty` é `true` por construção: a expressão `onChange` só roda porque o usuário ACABOU
      // de alterar um campo. Ler o estado do formulário aqui devolveria o valor de ANTES da mudança
      // (o React ainda não re-renderizou), e daria `false` na primeira alteração de todo formulário.
      const patch = resolveOnChangePatch(field, fields, values, value, resolveRecord, {
        isNew,
        isDirty: true,
      });
      if (Object.keys(patch).length > 0) onMergeValues(patch);

      if (field.logic.onChangeLookup?.provider) {
        const pending = timersRef.current.get(fieldKey);
        if (pending) clearTimeout(pending);
        timersRef.current.set(
          fieldKey,
          setTimeout(() => {
            timersRef.current.delete(fieldKey);
            void runLookup(field, value);
          }, LOOKUP_DEBOUNCE_MS),
        );
      }
    },
    [fields, values, resolveRecord, onMergeValues, isNew, runLookup],
  );

  const isFieldLoading = useCallback((fieldKey: string) => loadingKeys.has(fieldKey), [loadingKeys]);

  return { runFieldChangeEffects, isFieldLoading };
};
