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

  Avatar: styled.div<{ $color?: string }>`
    width: 48px;
    height: 48px;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ $color, theme }) => $color ? `${$color}20` : `${theme.colors.primary}20`};
    border: 1px solid ${({ $color, theme }) => $color ? `${$color}44` : `${theme.colors.primary}44`};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ $color, theme }) => $color ?? theme.colors.primary};
    font-size: 22px;
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
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  `,

  FormGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    max-width: 800px;
    @media (max-width: 600px) { grid-template-columns: 1fr; }
  `,

  FormGroup: styled.div<{ $fullWidth?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    grid-column: ${({ $fullWidth }) => $fullWidth ? '1 / -1' : 'auto'};
  `,

  SectionTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    grid-column: 1 / -1;
    padding-top: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,


  StatusChip: styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    background: ${({ $color }) => `${$color}20`};
    color: ${({ $color }) => $color};
    border: 1px solid ${({ $color }) => `${$color}40`};
  `,
};
