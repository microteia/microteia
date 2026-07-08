import styled from 'styled-components';
import React from 'react';

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  direction?: 'vertical' | 'horizontal';
}

const StyledRadioGroup = styled.div<{ $direction: 'vertical' | 'horizontal' }>`
  display: flex;
  flex-direction: ${({ $direction }) => $direction === 'vertical' ? 'column' : 'row'};
  gap: ${({ theme }) => theme.spacing.sm};
`;

const StyledRadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};
  user-select: none;
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const StyledRadioInput = styled.input`
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: 50%;
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
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fff;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  value,
  onChange,
  options,
  direction = 'vertical',
}) => {
  return (
    <StyledRadioGroup $direction={direction}>
      {options.map((option) => (
        <StyledRadioLabel key={option.value}>
          <StyledRadioInput
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </StyledRadioLabel>
      ))}
    </StyledRadioGroup>
  );
};
