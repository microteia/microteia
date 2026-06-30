import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,

  Label: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  InputContainer: styled.div<{ $focused?: boolean }>`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 8px 10px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme, $focused }) => 
      $focused ? theme.colors.primary : theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    transition: border-color ${({ theme }) => theme.transitions.fast};
    min-height: 40px;
    cursor: text;

    &:hover {
      border-color: ${({ theme, $focused }) => 
        $focused ? theme.colors.primary : theme.colors.borderHover};
    }
  `,

  Tag: styled.div`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: ${({ theme }) => theme.colors.primary}15;
    border: 1px solid ${({ theme }) => theme.colors.primary}30;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.primary};
    user-select: none;
  `,

  TagText: styled.span`
    line-height: 1;
  `,

  RemoveButton: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    line-height: 1;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    transition: opacity ${({ theme }) => theme.transitions.fast};

    &:hover {
      opacity: 0.7;
    }
  `,

  Input: styled.input`
    flex: 1;
    min-width: 120px;
    padding: 4px 0;
    background: transparent;
    border: none;
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    outline: none;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  `,

  Hint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
