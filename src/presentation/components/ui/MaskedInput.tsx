import React from 'react';
import { Input } from './Input';
import { formatCEP, formatCNPJ, formatCPF, formatPhone } from '../../../utils/formatters';
import type { CustomFieldMask } from '../../../domain/entities';

const MASK_FORMATTERS: Record<CustomFieldMask, (value: string) => string> = {
  cpf: formatCPF,
  cnpj: formatCNPJ,
  phone: formatPhone,
  cep: formatCEP,
};

const MASK_PLACEHOLDERS: Record<CustomFieldMask, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  phone: '(00) 00000-0000',
  cep: '00000-000',
};

export interface MaskedInputProps {
  mask: CustomFieldMask;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export const MaskedInput: React.FC<MaskedInputProps> = ({
  mask,
  value,
  onChange,
  placeholder,
  disabled,
  id,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(MASK_FORMATTERS[mask](e.target.value));
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      placeholder={placeholder || MASK_PLACEHOLDERS[mask]}
      disabled={disabled}
    />
  );
};
