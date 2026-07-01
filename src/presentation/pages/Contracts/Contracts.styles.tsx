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
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Toolbar: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  `,

  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  ContractCard: styled.div`
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
  `,

  CardHeader: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  CardAvatar: styled.div<{ $color?: string }>`
    width: 44px;
    height: 44px;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ $color }) => $color ? `${$color}20` : 'transparent'};
    border: 1px solid ${({ $color, theme }) => $color ? `${$color}44` : theme.colors.border};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ $color, theme }) => $color ?? theme.colors.primary};
    font-size: 20px;
    flex-shrink: 0;
  `,

  CardHeaderInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  CardTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  CardNumber: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-family: ${({ theme }) => theme.fonts.mono};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  Badges: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    align-items: center;
  `,

  PartesRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,

  PoleColumn: styled.div<{ $side: 'left' | 'right' }>`
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-right: ${({ $side, theme }) => $side === 'left' ? `1px solid ${theme.colors.border}` : 'none'};
    min-width: 0;
  `,

  PoleLabel: styled.div`
    font-size: 10px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    letter-spacing: 0.05em;
    margin-bottom: 1px;
  `,

  PoleName: styled.div`
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,

  PoleEmpty: styled.div`
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
    font-size: ${({ theme }) => theme.fontSizes.xs};
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
    min-width: 0;
    overflow: hidden;
  `,

  MetaText: styled.span`
    min-width: 0;
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
