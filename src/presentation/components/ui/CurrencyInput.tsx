import React from 'react';
import { Input } from './Input';
import { formatCurrencyBRL, parseCurrencyDigits } from '../../../utils/formatters';

export interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = 'R$ 0,00',
  disabled,
  id,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseCurrencyDigits(e.target.value));
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      value={value !== null ? formatCurrencyBRL(value) : ''}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
};
