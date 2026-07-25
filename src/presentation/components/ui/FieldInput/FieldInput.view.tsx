import React from 'react';
import { InputGroup, Label, ErrorMessage } from '../Input';
import { FieldControl } from '../CustomFieldsSection/FieldControl';
import { useCustomFieldsSectionViewModel } from '../CustomFieldsSection/CustomFieldsSection.viewmodel';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';

export interface FieldInputProps {
  field: FieldDefinition;
  value: CustomFieldValue;
  onChange: (value: CustomFieldValue) => void;
  /** Tela dona das opções dinâmicas/lookup do campo. Necessário só para selects com opções do tenant. */
  screenKey?: string;
  disabled?: boolean;
  error?: string;
  showLabel?: boolean;
}

/**
 * O ÁTOMO de um único campo, dirigido pelo schema: dado um `FieldDefinition`, renderiza o input certo
 * para o tipo (texto, moeda, data, máscara, select com/sem cor, referência, markdown…) já com máscara,
 * opções e validação de formato. É o que permite a uma extensão RECRIAR a tela de edição com o layout
 * que quiser — decidindo onde cada campo fica e envolvendo o `onChange` com comportamento próprio (ex.:
 * disparar um workflow/script ao alterar) — sem reimplementar o input: o TIPO continua vindo do Form
 * Design. Para a lógica entre campos (ocultar/desabilitar/preencher em cascata), use `EntityForm`.
 */
export const FieldInput: React.FC<FieldInputProps> = ({
  field,
  value,
  onChange,
  screenKey = '',
  disabled,
  error,
  showLabel = true,
}) => {
  const vm = useCustomFieldsSectionViewModel({
    screenKey,
    fields: [field],
    values: { [field.key]: value },
    onChange: (_key, next) => onChange(next),
    disabled,
    errors: error ? { [field.key]: error } : undefined,
  });
  const shownError = vm.fieldError(field);
  return (
    <InputGroup $fullWidth={field.type === 'textarea' || field.type === 'markdown'}>
      {showLabel && <Label>{field.label}{field.required ? ' *' : ''}</Label>}
      <FieldControl field={field} vm={vm} />
      {shownError && <ErrorMessage>{shownError}</ErrorMessage>}
    </InputGroup>
  );
};
