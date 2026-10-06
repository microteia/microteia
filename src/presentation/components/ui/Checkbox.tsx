import styled from 'styled-components';
import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /**
   * Parte do conjunto marcada — o estado de um grupo com alguns itens dentro.
   *
   * Desenhado por CSS e anunciado por `aria-checked="mixed"`, nunca pela propriedade `indeterminate`
   * do DOM: aquela só se escreve por `ref`, e ler ou escrever `ref.current` fora de um efeito é o
   * que o React Compiler recusa. O resultado visual é o mesmo e o componente continua sendo props.
   */
  indeterminate?: boolean;
}

const StyledCheckboxLabel = styled.label<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme, $disabled }) => ($disabled ? theme.colors.textMuted : theme.colors.text)};
  user-select: none;
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme, $disabled }) => ($disabled ? theme.colors.textMuted : theme.colors.primary)};
  }
`;

const StyledCheckboxInput = styled.input<{ $indeterminate?: boolean }>`
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.inputBackground};
  cursor: pointer;
  position: relative;
  transition: all ${({ theme }) => theme.transitions.fast};
  flex-shrink: 0;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:checked {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primary};
  }

  &:checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 12px;
    font-weight: bold;
    line-height: 1;
  }

  ${({ $indeterminate, theme }) => $indeterminate && `
    border-color: ${theme.colors.primary};
    background: ${theme.colors.primary};

    &::after {
      content: '–';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #fff;
      font-size: 12px;
      font-weight: bold;
      line-height: 1;
    }
  `}

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  indeterminate = false,
}) => {
  return (
    <StyledCheckboxLabel $disabled={disabled}>
      <StyledCheckboxInput
        type="checkbox"
        checked={checked}
        $indeterminate={!checked && indeterminate}
        aria-checked={!checked && indeterminate ? 'mixed' : checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </StyledCheckboxLabel>
  );
};
