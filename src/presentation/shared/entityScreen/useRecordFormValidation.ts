import { useCallback } from 'react';
import {
  collectRequiredErrors,
  formValuesToStoredValues,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { useLabel, useT } from '../i18n/useT';
import type { CustomFieldValue, FieldDefinition } from '../../../domain/entities';
import type { EntityValidationResult } from './useEntityDetail';

type Values = Record<string, CustomFieldValue>;

/**
 * A validação do formulário de um registro — a mesma para a tela dinâmica e para a tela de uma
 * extensão, e por isso UMA. As duas mantinham a rotina copiada, e a cópia é o que fez o erro de
 * regra chegar ao usuário como referência crua num lado sem ninguém notar no outro.
 *
 * O erro de uma regra nasce no domínio como REFERÊNCIA (`@core.records/field.invalid-value`), com os
 * parâmetros que a frase interpola ao lado. Aqui é onde ele encontra o catálogo: `label` resolve a
 * referência e deixa passar intacto o texto que o escritório escreveu na própria regra.
 */
export const useRecordFormValidation = (
  collection: string,
  sortedFields: FieldDefinition[],
): ((values: Values) => EntityValidationResult | null) => {
  const t = useT('core.records');
  const label = useLabel();

  return useCallback(
    (values) => {
      const fieldErrors = collectRequiredErrors(t, sortedFields, values);
      const issues = validateRecordRules(collection, formValuesToStoredValues(sortedFields, values));
      issues.forEach((issue) => {
        if (!fieldErrors[issue.path]) fieldErrors[issue.path] = label(issue.error, issue.errorParams);
      });
      if (Object.keys(fieldErrors).length === 0) return null;
      const summary = issues
        .map((issue) => `${label(issue.label)}: ${label(issue.error, issue.errorParams)}`)
        .join('; ');
      return { message: validateRequiredFields(t, sortedFields, values) ?? summary, fieldErrors };
    },
    [sortedFields, collection, t, label],
  );
};
