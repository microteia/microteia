import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import { CardAtoms } from '../EntityListCard/atoms';
import type {
  CardAlign,
  CardFieldVariant,
  CardGap,
  CardJustify,
  CardTextSize,
  CardTone,
  CardWidth,
} from '../../../../domain/schema/ui/cardTemplate';

const toneColor = (theme: DefaultTheme, tone: CardTone): string => ({
  default: theme.colors.text,
  muted: theme.colors.textMuted,
  primary: theme.colors.primary,
  success: theme.colors.success,
  warning: theme.colors.warning,
  danger: theme.colors.danger,
})[tone];

const FLEX_ALIGN: Record<CardAlign, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };
const FLEX_JUSTIFY: Record<CardJustify, string> = { start: 'flex-start', between: 'space-between', end: 'flex-end' };

const variantTone: Record<CardFieldVariant, CardTone> = { text: 'default', muted: 'muted', strong: 'default', badge: 'default' };

export const S = {
  ...CardAtoms,

  Row: styled.div<{ $gap: CardGap; $align?: CardAlign; $justify?: CardJustify; $wrap: boolean }>`
    display: flex;
    flex-direction: row;
    gap: ${({ theme, $gap }) => theme.spacing[$gap]};
    align-items: ${({ $align }) => ($align ? FLEX_ALIGN[$align] : 'center')};
    justify-content: ${({ $justify }) => ($justify ? FLEX_JUSTIFY[$justify] : 'flex-start')};
    flex-wrap: ${({ $wrap }) => ($wrap ? 'wrap' : 'nowrap')};
    min-width: 0;
  `,

  Stack: styled.div<{ $gap: CardGap }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme, $gap }) => theme.spacing[$gap]};
    flex: 1;
    min-width: 0;
  `,

  Spacer: styled.div`
    flex: 1;
  `,

  Divider: styled.hr`
    width: 100%;
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin: 0;
  `,

  SizedAvatar: styled(CardAtoms.Avatar)<{ $size: CardWidth }>`
    width: ${({ theme, $size }) => theme.listCard.avatar[$size]};
    height: ${({ theme, $size }) => theme.listCard.avatar[$size]};
  `,

  SizedTitle: styled(CardAtoms.Title)<{ $size?: CardTextSize }>`
    font-size: ${({ theme, $size }) => theme.fontSizes[$size ?? 'md']};
  `,

  Field: styled.div<{ $variant: CardFieldVariant; $size?: CardTextSize }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
    font-size: ${({ theme, $size }) => theme.fontSizes[$size ?? 'sm']};
    font-weight: ${({ $variant }) => ($variant === 'strong' ? 600 : 400)};
    color: ${({ theme, $variant }) => toneColor(theme, variantTone[$variant])};
  `,

  FieldLabel: styled.span`
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  `,

  FieldValue: styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  BadgeWrap: styled.span`
    display: inline-flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Text: styled.span<{ $tone: CardTone; $size?: CardTextSize }>`
    font-size: ${({ theme, $size }) => theme.fontSizes[$size ?? 'sm']};
    color: ${({ theme, $tone }) => toneColor(theme, $tone)};
  `,

  Icon: styled.span<{ $tone: CardTone }>`
    display: inline-flex;
    color: ${({ theme, $tone }) => toneColor(theme, $tone)};
  `,

  InlineActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
  `,
};
