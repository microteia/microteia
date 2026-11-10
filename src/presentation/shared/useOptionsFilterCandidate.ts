import { useCallback } from 'react';
import { useLookups } from '../../stores/useLookups';
import { useRecordResolver } from './useRecordResolver';
import { useLabel } from './i18n/useT';
import type { OptionsFilterCandidateOf } from '../../domain/schema/optionsFilter';

/**
 * A opção que um valor designa, na forma que o filtro de opções lê: o registro apontado numa
 * referência, `{ key, label }` numa lista. O seletor que filtra e a validação que recusa leem pela
 * MESMA porta — duas leituras divergiriam no rótulo traduzido de uma opção fixa.
 */
export const useOptionsFilterCandidate = (): OptionsFilterCandidateOf => {
  const resolveRecord = useRecordResolver();
  const { getOptions } = useLookups();
  const label = useLabel();

  return useCallback<OptionsFilterCandidateOf>((field, value) => {
    if (field.type === 'reference') return field.refEntity ? resolveRecord(field.refEntity, value) : null;
    const declared = (field.options ?? []).find((option) => option.key === value);
    if (declared) return { key: declared.key, label: label(declared.label) };
    const listed = getOptions(field.lookupCollection ?? '').find((option) => option.key === value);
    return listed ? { key: listed.key, label: label(listed.label) } : null;
  }, [resolveRecord, getOptions, label]);
};
