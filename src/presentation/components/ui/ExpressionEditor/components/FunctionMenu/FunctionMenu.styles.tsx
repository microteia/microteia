import styled from 'styled-components';

export const S = {
  Container: styled.div<{ $top: number; $left: number }>`
    position: fixed;
    top: ${({ $top }) => $top}px;
    left: ${({ $left }) => $left}px;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    z-index: 9999;
    min-width: 240px;

    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: 3px;
    }
  `,

  Item: styled.div<{ $highlighted: boolean }>`
    padding: 8px 12px;
    cursor: pointer;
    background: ${({ theme, $highlighted }) =>
      $highlighted ? theme.colors.primaryLight : 'transparent'};
    border-left: 2px solid ${({ theme, $highlighted }) =>
      $highlighted ? theme.colors.primary : 'transparent'};
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.primaryLight};
      border-left-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  FunctionName: styled.div`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.8125rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: 2px;
  `,

  Description: styled.div`
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.6875rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
};
