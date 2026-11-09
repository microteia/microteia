import { useCallback } from 'react';
import {
  collectRequiredErrors,
  formValuesToStoredValues,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { computeFieldValues } from '../../../domain/schema/recordRules';
import { buildHydratedFieldScope } from '../../../domain/schema/referenceScope';
import { findOptionsFilterViolations } from '../../../domain/schema/optionsFilter';
import { useRecordResolver } from '../useRecordResolver';
import { useOptionsFilterCandidate } from '../useOptionsFilterCandidate';
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
  const resolveRecord = useRecordResolver();
  const candidateOf = useOptionsFilterCandidate();

  return useCallback(
    (values) => {
      const fieldErrors = collectRequiredErrors(t, sortedFields, values);
      const issues = validateRecordRules(collection, formValuesToStoredValues(sortedFields, values));
      issues.forEach((issue) => {
        if (!fieldErrors[issue.path]) fieldErrors[issue.path] = label(issue.error, issue.errorParams);
      });
      // O filtro de opções é regra do FORMULÁRIO: por isso é cobrado aqui, e não em `validateRecordRules`,
      // que também julga o que chega por automação e importação.
      const scope = buildHydratedFieldScope(
        sortedFields,
        { ...values, ...computeFieldValues(sortedFields, values) },
        resolveRecord,
      );
      const notOffered = findOptionsFilterViolations(sortedFields, values, scope, candidateOf);
      notOffered.forEach((field) => {
        if (!fieldErrors[field.key]) fieldErrors[field.key] = t('field.option-not-offered');
      });
      if (Object.keys(fieldErrors).length === 0) return null;
      const summary = [
        ...issues.map((issue) => `${label(issue.label)}: ${label(issue.error, issue.errorParams)}`),
        ...notOffered.map((field) => `${label(field.label)}: ${t('field.option-not-offered')}`),
      ].join('; ');
      return { message: validateRequiredFields(t, sortedFields, values) ?? summary, fieldErrors };
    },
    [sortedFields, collection, t, label, resolveRecord, candidateOf],
  );
};
