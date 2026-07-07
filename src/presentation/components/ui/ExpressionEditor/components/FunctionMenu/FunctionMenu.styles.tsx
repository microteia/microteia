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
    max-height: 300px;
    overflow-y: auto;
    z-index: 9999;
    min-width: 280px;
    max-width: 400px;

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

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  `,

  FunctionName: styled.div`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.8125rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  Category: styled.div`
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.625rem;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
    background: ${({ theme }) => theme.colors.backgroundSecondary};
    padding: 2px 6px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,

  Detail: styled.div`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.6875rem;
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: 2px;
    font-style: italic;
  `,

  Description: styled.div`
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.6875rem;
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.4;
  `,
};
