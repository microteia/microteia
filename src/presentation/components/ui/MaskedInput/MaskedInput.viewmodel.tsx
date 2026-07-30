import { useCallback, useMemo } from 'react';
import { applyMaskTemplate, maskPlaceholder } from '../../../../domain/schema/fieldRulePresets';
import { useFieldRulePresets } from '../../../shared/useFieldRulePresets';

export interface MaskedInputViewModel {
  display: string;
  placeholder: string;
  inputMode: 'numeric' | 'text';
  handleChange: (raw: string) => void;
}

/**
 * A máscara é resolvida no catálogo declarado, e não numa lista fixa: uma extensão que declare
 * `com.acme.docs/rg-sp` passa a formatar o campo sem que este componente saiba o que é um RG. Chave
 * desconhecida deixa o valor passar cru — nunca engole o que o usuário digitou.
 */
export const useMaskedInputViewModel = (
  mask: string,
  value: string,
  onChange: (value: string) => void,
  placeholder?: string,
): MaskedInputViewModel => {
  const catalog = useFieldRulePresets();
  const spec = useMemo(() => catalog.get(mask)?.mask, [catalog, mask]);

  const format = useCallback(
    (raw: string) => (spec ? applyMaskTemplate(raw, spec.templates) : raw),
    [spec],
  );

  const handleChange = useCallback((raw: string) => onChange(format(raw)), [format, onChange]);

  return {
    display: format(value),
    placeholder: placeholder || (spec ? maskPlaceholder(spec) : ''),
    inputMode: spec?.inputMode ?? 'text',
    handleChange,
  };
};
