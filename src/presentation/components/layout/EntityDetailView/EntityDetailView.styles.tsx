import styled from 'styled-components';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  HeaderLeft: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Avatar: styled.div`
    width: 48px;
    height: 48px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    flex-shrink: 0;
  `,

  HeaderInfo: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  SubTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  SaveBtn: styled.button`
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.success};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.success};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,

  DeleteBtn: styled.button`
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.danger};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.danger};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,

  Tags: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,

  TagPill: styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    background: ${({ $color }) => `${$color}22`};
    color: ${({ $color }) => $color};
    border: 1px solid ${({ $color }) => `${$color}44`};
  `,

  TagDot: styled.span<{ $color: string }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  TabBar: styled.div`
    display: flex;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    padding: 0 ${({ theme }) => theme.spacing.xl};
  `,

  TabBtn: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
    border-bottom: 2px solid ${({ $active, theme }) => $active ? theme.colors.primary : 'transparent'};
    transition: all ${({ theme }) => theme.transitions.fast};
    white-space: nowrap;

    &:hover { color: ${({ theme }) => theme.colors.text}; }
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.xl};
  `,
};
