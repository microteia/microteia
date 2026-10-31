import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type {
  CardAlign,
  CardFieldVariant,
  CardGap,
  CardJustify,
  CardTextSize,
  CardTone,
} from '../../../../../domain/schema/ui/cardTemplate';

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

/** Os átomos do desenho declarado — as mesmas medidas do cartão e do registro aberto padrão do portal. */
export const S = {
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
    min-width: 0;
  `,

  Section: styled.section<{ $gap: CardGap }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme, $gap }) => theme.spacing[$gap]};
    min-width: 0;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
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

  Title: styled.span<{ $size?: CardTextSize }>`
    font-size: ${({ theme, $size }) => theme.fontSizes[$size ?? 'md']};
    font-weight: ${({ $size }) => ($size === 'xl' || $size === 'lg' ? 700 : 600)};
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
  `,

  Field: styled.span<{ $variant: CardFieldVariant; $size?: CardTextSize }>`
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
    font-size: ${({ theme, $size }) => theme.fontSizes[$size ?? 'sm']};
    font-weight: ${({ $variant }) => ($variant === 'strong' ? 700 : 400)};
    color: ${({ theme, $variant }) => toneColor(theme, variantTone[$variant])};
  `,

  FieldLabel: styled.span`
    color: ${({ theme }) => theme.colors.textMuted};
    font-weight: 400;
  `,

  FieldValue: styled.span`
    overflow-wrap: anywhere;
  `,

  OptionDot: styled.span<{ $color: string }>`
    width: ${({ theme }) => theme.spacing.sm};
    height: ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  Link: styled.a`
    color: ${({ theme }) => theme.colors.primary};
  `,

  Fields: styled.dl`
    display: grid;
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (min-width: 640px) {
      grid-template-columns: 1fr 1fr;
    }
  `,

  FieldsItem: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  FieldsLabel: styled.dt`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,

  FieldsValue: styled.dd`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  `,

  Summary: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Updated: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Text: styled.span<{ $tone: CardTone; $size?: CardTextSize }>`
    font-size: ${({ theme, $size }) => theme.fontSizes[$size ?? 'sm']};
    color: ${({ theme, $tone }) => toneColor(theme, $tone)};
    white-space: pre-wrap;
  `,

  Icon: styled.span<{ $tone: CardTone }>`
    display: inline-flex;
    color: ${({ theme, $tone }) => toneColor(theme, $tone)};
  `,

  /** O número de um `count` — em destaque quando o widget não pede outro tamanho. */
  Count: styled.span<{ $tone: CardTone; $size?: CardTextSize }>`
    font-size: ${({ theme, $size }) => theme.fontSizes[$size ?? '2xl']};
    font-weight: 700;
    line-height: 1.2;
    color: ${({ theme, $tone }) => toneColor(theme, $tone)};
  `,

  Empty: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
