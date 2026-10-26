import styled from 'styled-components';

const BREAKPOINT = '768px';

/** O conteúdo da página do portal — o mesmo em qualquer layout. */
export const S = {
  /** A home: boas-vindas, o menu em blocos e os cartões das extensões. */
  Welcome: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: pre-wrap;
  `,

  Widgets: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: ${({ theme }) => theme.spacing.md};

    @media (min-width: ${BREAKPOINT}) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,

  WidgetCard: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.surface};
  `,

  WidgetTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Centered: styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
    text-align: center;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Muted: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  List: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Card: styled.button`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    width: 100%;
    padding: ${({ theme }) => theme.spacing.md};
    text-align: left;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.cardHover};
    }
  `,

  CardTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
  `,

  CardMeta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Tabs: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.lg};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    overflow-x: auto;
  `,

  Tab: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => theme.spacing.sm} 0;
    margin-bottom: -1px;
    border-bottom: 2px solid ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
    white-space: nowrap;

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Detail: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
  `,

  DetailHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  DetailTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
  `,

  Fields: styled.dl`
    display: grid;
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (min-width: 640px) {
      grid-template-columns: 1fr 1fr;
    }
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  FieldLabel: styled.dt`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,

  FieldValue: styled.dd`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  `,

  OptionValue: styled.span`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
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


  DocumentRow: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  DocumentInfo: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  DocumentHash: styled.span`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  DocumentName: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,



  Toolbar: styled.div`
    display: flex;
    justify-content: flex-end;
  `,

  Success: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.success};
  `,

  ErrorText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.danger};
  `,
};
