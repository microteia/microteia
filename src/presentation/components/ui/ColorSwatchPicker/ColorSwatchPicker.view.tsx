import React from 'react';
import { S } from './ColorSwatchPicker.styles';
import { useLabel } from '../../../shared/i18n/useT';

export interface ColorSwatchOption {
  label: string;
  value: string;
}

interface ColorSwatchPickerProps {
  colors: ColorSwatchOption[];
  value: string;
  onChange: (color: string) => void;
}

export const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({ colors, value, onChange }) => {
  const label = useLabel();

  return (
  <S.Palette>
    {colors.map((c) => (
      <S.Swatch
        key={c.value}
        type="button"
        $color={c.value}
        $selected={value === c.value}
        title={label(c.label)}
        onClick={() => onChange(c.value)}
      />
    ))}
  </S.Palette>
  );
};
