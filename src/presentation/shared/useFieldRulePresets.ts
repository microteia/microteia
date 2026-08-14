import { useMemo } from 'react';
import {
  DATA_FIELD_RULE_PRESET_POINT,
  fieldRulePresetOf,
} from '../../domain/schema/dataExtensionPoints';
import type { FieldRulePreset, FieldRulePresetCatalog } from '../../domain/schema/fieldRulePresets';
import { buildFieldRulePresetCatalog } from '../../domain/schema/fieldRulePresets';
import { useContributions } from '../../stores/useKernel';


export interface FieldRulePresetOption {
  value: string;
  label: string;
}

/**
 * As máscaras, formatações e validações prontas disponíveis ao tenant corrente — as do núcleo mais as
 * declaradas pelas extensões instaladas. Fonte única da UI: a autoria, o formulário e o gate de
 * gravação enxergam exatamente o mesmo catálogo.
 */
export const useFieldRulePresets = (): FieldRulePresetCatalog => {
  const contributions = useContributions(DATA_FIELD_RULE_PRESET_POINT);

  return useMemo(() => {
    const declared = contributions
      .map(fieldRulePresetOf)
      .filter((preset): preset is FieldRulePreset => preset !== undefined);
    return buildFieldRulePresetCatalog(declared);
  }, [contributions]);
};

/**
 * O rótulo do preset é uma REFERÊNCIA de mensagem (`@core.data/preset.digits`) para os do núcleo, e
 * texto do autor para os que vêm de extensão. `resolve` é o `useLabel()` de quem renderiza: um
 * caminho só serve aos dois, e é o que impede a referência de vazar para a tela.
 */
const toOptions = (
  resolve: (value: string) => string,
  catalog: FieldRulePresetCatalog,
  accepts: (preset: FieldRulePreset) => boolean,
  fieldType?: string,
): FieldRulePresetOption[] =>
  [...catalog.values()]
    .filter(accepts)
    .filter(
      (preset) =>
        !fieldType || !preset.appliesTo || preset.appliesTo.some((type) => type === fieldType),
    )
    .map((preset) => ({ value: preset.key, label: resolve(preset.label) }));

export const maskPresetOptions = (
  resolve: (value: string) => string,
  catalog: FieldRulePresetCatalog,
  fieldType?: string,
): FieldRulePresetOption[] => toOptions(resolve, catalog, (preset) => !!preset.mask, fieldType);

export const formatPresetOptions = (
  resolve: (value: string) => string,
  catalog: FieldRulePresetCatalog,
  fieldType?: string,
): FieldRulePresetOption[] =>
  toOptions(resolve, catalog, (preset) => !!preset.format?.length, fieldType);

export const validatePresetOptions = (
  resolve: (value: string) => string,
  catalog: FieldRulePresetCatalog,
  fieldType?: string,
): FieldRulePresetOption[] => toOptions(resolve, catalog, (preset) => !!preset.validate, fieldType);
