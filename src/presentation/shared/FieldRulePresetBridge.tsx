import React, { useEffect } from 'react';
import { setRecordRulesFieldRulePresets } from '../../data/utils/recordRulesGate';
import {
  DATA_FIELD_RULE_PRESET_POINT,
  fieldRulePresetOf,
} from '../../domain/schema/dataExtensionPoints';
import type { FieldRulePreset } from '../../domain/schema/fieldRulePresets';
import { useContributions } from '../../stores/useKernel';

/**
 * Os repositórios não alcançam um Store React, então as máscaras e validações declaradas pelas
 * extensões do tenant precisam ser empurradas para o gate de gravação — mesmo mecanismo que o
 * `ScreenDefinitionStore` já usa para as telas. Sem isso, um campo com preset de extensão passaria
 * pela tela formatado e chegaria ao Firestore cru.
 */
export const FieldRulePresetBridge: React.FC = () => {
  const contributions = useContributions(DATA_FIELD_RULE_PRESET_POINT);

  useEffect(() => {
    setRecordRulesFieldRulePresets(
      contributions
        .map(fieldRulePresetOf)
        .filter((preset): preset is FieldRulePreset => preset !== undefined),
    );
  }, [contributions]);

  return null;
};
