import styled from 'styled-components';

export const S = {
  // Embutida numa aba de detalhe, quem rola é o contêiner da aba — um segundo scroll aninhado
  // deixaria a lista presa numa faixa curta. O padding horizontal também já vem da aba.
  Page: styled.div<{ $embedded?: boolean }>`
    display: flex;
    flex-direction: column;
    ${({ $embedded }) => ($embedded ? '' : `
      height: 100%;
      overflow: hidden;
    `)}
  `,

  Header: styled.div<{ $embedded?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: ${({ $embedded }) => ($embedded ? 'flex-end' : 'space-between')};
    padding: ${({ theme, $embedded }) => ($embedded
    ? `0 0 ${theme.spacing.md} 0`
    : `${theme.spacing.lg} ${theme.spacing.xl}`)};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    flex-shrink: 0;
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  TitleRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    color: ${({ theme }) => theme.colors.primary};
    min-width: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Toolbar: styled.div<{ $embedded?: boolean }>`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme, $embedded }) => ($embedded
    ? `${theme.spacing.md} 0`
    : `${theme.spacing.md} ${theme.spacing.xl}`)};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
  `,

  Content: styled.div<{ $embedded?: boolean }>`
    ${({ $embedded }) => ($embedded ? '' : `
      flex: 1;
      overflow-y: auto;
    `)}
    padding: ${({ theme, $embedded }) => ($embedded
    ? `${theme.spacing.lg} 0 0 0`
    : `${theme.spacing.lg} ${theme.spacing.xl}`)};
  `,

  Grid: styled.div<{ $layout?: 'grid' | 'list'; $minWidth?: 'sm' | 'md' | 'lg' }>`
    display: grid;
    grid-template-columns: ${({ $layout, $minWidth, theme }) => ($layout === 'list'
    ? '1fr'
    : `repeat(auto-fill, minmax(${theme.listCard.minWidth[$minWidth ?? 'md']}, 1fr))`)};
    gap: ${({ theme }) => theme.spacing.md};
  `,

  SpinnerWrap: styled.div`
    display: flex;
    justify-content: center;
    padding-top: 48px;
  `,

  EmptyState: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing['2xl']};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  EmptyIcon: styled.div`
    font-size: 48px;
    opacity: 0.3;
  `,

  EmptyTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,
};
