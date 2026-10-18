import styled from 'styled-components';

const Group = styled.div<{ $hasError?: boolean; $disabled?: boolean }>`
  display: flex;
  align-items: stretch;
  width: 100%;
  background: ${({ theme }) => theme.colors.inputBackground};
  border: 1px solid ${({ theme, $hasError }) => ($hasError ? theme.colors.danger : theme.colors.border)};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  opacity: ${({ $disabled }) => ($disabled ? 0.55 : 1)};
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus-within {
    border-color: ${({ theme, $hasError }) => ($hasError ? theme.colors.danger : theme.colors.primary)};
  }
`;

const Field = styled.input`
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.sm};

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

export const S = { Group, Field };
