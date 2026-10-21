import styled, { css } from 'styled-components';

const NARROW = '720px';

/**
 * Uma caixa de entrada, não uma tabela: o dia como seção, cada aviso como cartão, e o que importa
 * — não lido — dito por peso de fonte e um traço de cor na borda, nunca por um fundo gritante.
 */
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
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
    flex-shrink: 0;
    flex-wrap: wrap;

    @media (max-width: ${NARROW}) {
      padding: ${({ theme }) => theme.spacing.md};
    }
  `,

  HeaderIcon: styled.div`
    width: 44px;
    height: 44px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  HeaderText: styled.div`
    flex: 1;
    min-width: 200px;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    letter-spacing: -0.01em;
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 2px;
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  UnreadPill: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    white-space: nowrap;
  `,

  GhostButton: styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: nowrap;
    transition: background ${({ theme }) => theme.transitions.fast}, color ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  `,

  Tabs: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.lg};
    padding: 0 ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;

    @media (max-width: ${NARROW}) {
      padding: 0 ${({ theme }) => theme.spacing.md};
    }
  `,

  Tab: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => theme.spacing.sm} 0;
    margin-bottom: -1px;
    border-bottom: 2px solid ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    flex-shrink: 0;
    flex-wrap: wrap;

    @media (max-width: ${NARROW}) {
      padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    }
  `,

  Segmented: styled.div`
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surfaceHover};
  `,

  Segment: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
    background: ${({ theme, $active }) => ($active ? theme.colors.surface : 'transparent')};
    box-shadow: ${({ theme, $active }) => ($active ? `0 1px 2px ${theme.colors.shadow}` : 'none')};
    transition: background ${({ theme }) => theme.transitions.fast}, color ${({ theme }) => theme.transitions.fast};
  `,

  Chips: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
    flex-wrap: wrap;
  `,

  Chip: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};

    @media (max-width: ${NARROW}) {
      padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    }
  `,

  Feed: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    max-width: 880px;
  `,

  Day: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  DayLabel: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Cards: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Card: styled.div<{ $unread: boolean }>`
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    background: ${({ theme }) => theme.colors.surface};
    transition: background ${({ theme }) => theme.transitions.fast}, border-color ${({ theme }) => theme.transitions.fast};

    ${({ $unread, theme }) => $unread && css`
      border-color: ${theme.colors.border};
      box-shadow: inset 3px 0 0 ${theme.colors.primary};
    `}

    &:hover {
      background: ${({ theme }) => theme.colors.cardHover};
    }

    &:hover > div:last-child,
    &:focus-within > div:last-child {
      opacity: 1;
    }
  `,

  CardIcon: styled.div<{ $unread: boolean }>`
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: ${({ theme, $unread }) => ($unread ? theme.colors.primaryLight : theme.colors.surfaceHover)};
    color: ${({ theme, $unread }) => ($unread ? theme.colors.primary : theme.colors.textMuted)};
  `,

  CardBody: styled.button<{ $clickable: boolean }>`
    flex: 1;
    min-width: 0;
    text-align: left;
    cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  `,

  CardTitle: styled.div<{ $unread: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: ${({ $unread }) => ($unread ? 700 : 500)};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.4;
  `,

  CardMessage: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-top: 2px;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,

  CardMeta: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-top: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  TypeBadge: styled.span`
    padding: 1px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-weight: 600;
  `,

  CardActions: styled.div`
    display: flex;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity ${({ theme }) => theme.transitions.fast};

    @media (hover: none), (max-width: ${NARROW}) {
      opacity: 1;
    }
  `,

  IconButton: styled.button`
    width: 32px;
    height: 32px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textMuted};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  LoadMore: styled.button`
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};

    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Empty: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing['2xl']} ${({ theme }) => theme.spacing.md};
    text-align: center;
  `,

  EmptyIcon: styled.div`
    width: 56px;
    height: 56px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  EmptyTitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Preferences: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    max-width: 880px;
    padding-top: ${({ theme }) => theme.spacing.md};
  `,

  SectionHeader: styled.div`
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  SectionText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 2px;
    line-height: 1.5;
  `,

  PrefRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    background: ${({ theme }) => theme.colors.surface};

    @media (max-width: ${NARROW}) {
      flex-wrap: wrap;
    }
  `,

  PrefText: styled.div`
    flex: 1;
    min-width: 180px;
  `,

  PrefChannels: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
    flex-wrap: wrap;
  `,

  ChannelToggle: styled.button<{ $on: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.border)};
    background: ${({ theme, $on }) => ($on ? theme.colors.primaryLight : 'transparent')};
    color: ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.textMuted)};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    transition: all ${({ theme }) => theme.transitions.fast};

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,

  ToggleDot: styled.span<{ $on: boolean }>`
    width: 8px;
    height: 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.border)};
  `,

  DeviceCard: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    margin-top: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
  `,
};
