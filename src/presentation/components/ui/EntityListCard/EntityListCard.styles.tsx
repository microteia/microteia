import styled from 'styled-components';

const Actions = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing.sm};
  right: ${({ theme }) => theme.spacing.sm};
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: ${({ theme }) => theme.transitions.fast};

  @media (hover: none) {
    opacity: 1;
  }
`;

const Card = styled.div`
  position: relative;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 4px 16px ${({ theme }) => `${theme.colors.primary}15`};
    transform: translateY(-1px);
  }

  &:hover ${Actions} {
    opacity: 1;
  }
`;

export const S = {
  Card,
  Actions,

  ActionButton: styled.button<{ $danger?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.textSecondary)};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.text)};
    }
  `,

  Header: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Avatar: styled.div`
    width: 44px;
    height: 44px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.white};
    font-weight: 700;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    flex-shrink: 0;
    overflow: hidden;
  `,

  HeaderInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  Title: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: ${({ theme }) => theme.spacing.md};
  `,

  Subtitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  `,

  Meta: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding-top: ${({ theme }) => theme.spacing.xs};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  MetaRow: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  Tags: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    padding-top: ${({ theme }) => theme.spacing.xs};
  `,

  TagPill: styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: 10px;
    font-weight: 500;
    background: ${({ $color }) => `${$color}20`};
    color: ${({ $color }) => $color};
    border: 1px solid ${({ $color }) => `${$color}40`};
  `,

  TagDot: styled.span<{ $color: string }>`
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,
};
