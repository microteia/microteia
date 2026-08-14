import React from 'react';
import styled from 'styled-components';
import { RiCloseLine } from 'react-icons/ri';

import { useT } from '../../shared/i18n/useT';

const Wrapper = styled.div`
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input<{ $hasValue: boolean }>`
  width: 100%;
  padding: 10px 14px;
  padding-right: ${({ $hasValue }) => $hasValue ? '4px' : '12px'};
  background: ${({ theme }) => theme.colors.inputBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-family: inherit;
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &::-webkit-calendar-picker-indicator {
    margin-left: 8px;
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ClearButton = styled.button`
  position: absolute;
  top: 50%;
  right: 22px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
  border-radius: 50%;
  transition: color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.danger};
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

export interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, disabled, id }) => {
  const t = useT('core.ui');
  return (
    <Wrapper>
      <StyledInput
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        $hasValue={!!value}
      />
      {value && !disabled && (
        <ClearButton type="button" onClick={() => onChange('')} title={t('date.clear')}>
          <RiCloseLine size={14} />
        </ClearButton>
      )}
    </Wrapper>
  );
};
