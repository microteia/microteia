import React from 'react';
import { S } from './ColorSwatchPicker.styles';

export interface ColorSwatchOption {
  label: string;
  value: string;
}

interface ColorSwatchPickerProps {
  colors: ColorSwatchOption[];
  value: string;
  onChange: (color: string) => void;
}

export const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({ colors, value, onChange }) => (
  <S.Palette>
    {colors.map((c) => (
      <S.Swatch
        key={c.value}
        type="button"
        $color={c.value}
        $selected={value === c.value}
        title={c.label}
        onClick={() => onChange(c.value)}
      />
    ))}
  </S.Palette>
);
