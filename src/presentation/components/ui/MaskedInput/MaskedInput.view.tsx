import React from 'react';
import { Input } from '../Input';
import { useMaskedInputViewModel } from './MaskedInput.viewmodel';

export interface MaskedInputProps {
  mask: string;
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
  const vm = useMaskedInputViewModel(mask, value, onChange, placeholder);

  return (
    <Input
      id={id}
      type="text"
      inputMode={vm.inputMode}
      value={vm.display}
      onChange={(event) => vm.handleChange(event.target.value)}
      placeholder={vm.placeholder}
      disabled={disabled}
    />
  );
};
