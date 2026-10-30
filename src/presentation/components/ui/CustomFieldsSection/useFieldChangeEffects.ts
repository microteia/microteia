import { useCallback, useMemo } from 'react';
import { useExternalLookupProviders } from '../../../shared/useExternalLookupProviders';
import { useExternalLookupRunner } from '../../../shared/useExternalLookupRunner';
import { resolveOnChangePatch } from '../../../../domain/schema/fieldChangeSpec';
import type { RecordResolver } from '../../../../domain/schema/referenceScope';
import type { FieldDefinition } from '../../../../domain/entities';

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
  const fieldKeys = useMemo(() => new Set(fields.map((field) => field.key)), [fields]);
  const { scheduleLookup, isFieldLoading } = useExternalLookupRunner(fieldKeys, onMergeValues);

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

      const binding = field.logic.onChangeLookup;
      const service = binding?.provider
        ? externalLookupServices.find((candidate) => candidate.key === binding.provider)
        : undefined;
      if (binding && service) scheduleLookup({ fieldKey, value, service, binding });
    },
    [fields, values, resolveRecord, onMergeValues, isNew, externalLookupServices, scheduleLookup],
  );

  return { runFieldChangeEffects, isFieldLoading };
};
