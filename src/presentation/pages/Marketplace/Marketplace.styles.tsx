import styled, { type DefaultTheme } from 'styled-components';

type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'primary';

const toneColor = (theme: DefaultTheme, tone: Tone): string => {
  const map: Record<Tone, string> = {
    neutral: theme.colors.textMuted,
    success: theme.colors.success,
    warning: theme.colors.warning,
    info: theme.colors.info,
    danger: theme.colors.danger,
    primary: theme.colors.primary,
  };
  return map[tone];
};

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: ${({ theme }) => theme.transitions.fast};

  @media (hover: none) {
    opacity: 1;
    pointer-events: auto;
  }
`;

const Row = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: ${({ theme }) => theme.transitions.fast};

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  &:hover ${RowActions} {
    opacity: 1;
    pointer-events: auto;
  }
`;

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,

  Header: styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  HeaderText: styled.div``,

  HeaderActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-shrink: 0;
  `,

  ImportLabel: styled.label<{ $disabled?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
    opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
    pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  HiddenFile: styled.input`
    display: none;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Subtitle: styled.p`
    margin-top: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    max-width: 68ch;
  `,

  Scroll: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
  `,

  Body: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Filters: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex-wrap: wrap;
    position: sticky;
    top: -${({ theme }) => theme.spacing.md};
    z-index: 2;
    padding: ${({ theme }) => theme.spacing.xs} 0;
    background: ${({ theme }) => theme.colors.background};
  `,

  Filter: styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Sort: styled.div`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-left: auto;
  `,

  SortLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: nowrap;
  `,

  SortSelect: styled.div`
    min-width: 190px;
  `,

  FilterCount: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    opacity: 0.8;
  `,

  List: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.surface};
    overflow: hidden;
  `,

  Row,
  RowActions,

  RowIcon: styled.div<{ $tone: Tone }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme, $tone }) => toneColor(theme, $tone)};
    flex-shrink: 0;
  `,

  RowImage: styled.img`
    width: 38px;
    height: 38px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    object-fit: contain;
    flex-shrink: 0;
  `,

  Verified: styled.span`
    display: inline-flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,

  Stat: styled.span`
    display: inline-flex;
    align-items: center;
    gap: 4px;
  `,

  Stars: styled.span`
    display: inline-flex;
    align-items: center;
    gap: 1px;
    color: ${({ theme }) => theme.colors.warning};
  `,

  DetailsHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  `,

  DetailsImage: styled.img`
    width: 64px;
    height: 64px;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    object-fit: contain;
    flex-shrink: 0;
  `,

  DetailsGlyph: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,

  DetailsHeaderText: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  DetailsHeaderLine: styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  RateBox: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-top: ${({ theme }) => theme.spacing.lg};
    padding-top: ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  RateTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  RateLine: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  RateStars: styled.div`
    display: inline-flex;
    align-items: center;
    gap: 2px;
  `,

  RateStar: styled.button<{ $filled: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    background: none;
    color: ${({ theme, $filled }) => ($filled ? theme.colors.warning : theme.colors.textMuted)};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.warning};
    }
  `,

  RateHint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  RowMain: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  `,

  TitleLine: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
  `,

  Name: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  /** O título é o gatilho dos detalhes da extensão — mesma aparência do `Name`, com afordância. */
  NameButton: styled.button`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Badges: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex-shrink: 0;
  `,

  Badge: styled.span<{ $tone: Tone }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme, $tone }) => toneColor(theme, $tone)};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    white-space: nowrap;
  `,

  BadgeDot: styled.span<{ $tone: Tone }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ theme, $tone }) => toneColor(theme, $tone)};
    flex-shrink: 0;
  `,

  Summary: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  Problems: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,

  Problem: styled.div<{ $error: boolean }>`
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.warning)};

    svg { flex-shrink: 0; margin-top: 2px; }
  `,

  ProblemAction: styled.button`
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: underline;
    cursor: pointer;
  `,

  Meta: styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  MetaAuthor: styled.span`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  MetaSep: styled.span`
    color: ${({ theme }) => theme.colors.border};
  `,

  AuthorPhoto: styled.img`
    width: 16px;
    height: 16px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    object-fit: cover;
    flex-shrink: 0;
  `,

  AuthorInitial: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  `,

  ActionButton: styled.button<{ $danger?: boolean; $primary?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: transparent;
    color: ${({ theme, $primary }) => ($primary ? theme.colors.primary : theme.colors.textSecondary)};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.surface)};
      color: ${({ theme, $danger }) => ($danger ? theme.colors.white : theme.colors.text)};
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,

  DetailsIntro: styled.p`
    margin: 0 0 ${({ theme }) => theme.spacing.lg};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.5;
  `,

  DetailsMeta: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-top: ${({ theme }) => theme.spacing.lg};
    padding-top: ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  TrustHero: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  `,

  TrustShield: styled.div<{ $verified: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    margin-bottom: ${({ theme }) => theme.spacing.xs};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $verified }) => ($verified ? theme.colors.primaryLight : theme.colors.warningLight)};
    color: ${({ theme, $verified }) => ($verified ? theme.colors.primary : theme.colors.warning)};
  `,

  TrustQuestion: styled.h3`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  TrustLead: styled.p`
    margin: 0;
    max-width: 460px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  TrustCard: styled.div`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    overflow: hidden;
  `,

  TrustCardHead: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
  `,

  TrustCardText: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  TrustName: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  TrustMeta: styled.span`
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  TrustPublisher: styled.div<{ $verified: boolean }>`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme, $verified }) => ($verified ? theme.colors.primaryLight : theme.colors.warningLight)};
  `,

  TrustAvatar: styled.span<{ $verified: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme, $verified }) => ($verified ? theme.colors.primary : theme.colors.warning)};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 700;
    flex-shrink: 0;
  `,

  TrustAvatarPhoto: styled.img`
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    object-fit: cover;
    flex-shrink: 0;
  `,

  TrustPublisherText: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  TrustPublisherName: styled.span`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};

    svg {
      color: ${({ theme }) => theme.colors.primary};
      flex-shrink: 0;
    }
  `,

  TrustPublisherStatus: styled.span<{ $verified: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme, $verified }) => ($verified ? theme.colors.primary : theme.colors.warning)};
  `,

  TrustPublisherHint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  TrustEffectsTitle: styled.p`
    margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  TrustEffects: styled.ul`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: 0;
    padding: 0;
    list-style: none;
  `,

  TrustEffect: styled.li`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};

    svg {
      color: ${({ theme }) => theme.colors.textMuted};
      flex-shrink: 0;
    }
  `,

  TrustNote: styled.p`
    margin: ${({ theme }) => theme.spacing.lg} 0 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  TrustActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-top: ${({ theme }) => theme.spacing.lg};
    padding-top: ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  ImportHint: styled.p`
    margin: ${({ theme }) => theme.spacing.md} 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  ImportInstall: styled.div`
    margin: ${({ theme }) => theme.spacing.md} 0;
  `,

  ReviewActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-top: ${({ theme }) => theme.spacing.md};
  `,

  HistoryList: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  `,

  HistoryItem: styled.div<{ $current?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme, $current }) => ($current ? theme.colors.surfaceHover : 'transparent')};

    & + & {
      border-top: 1px solid ${({ theme }) => theme.colors.border};
    }
  `,

  HistoryMain: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
    flex: 1;
  `,

  HistoryVersion: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  HistoryMeta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  HistoryFooter: styled.p`
    margin: ${({ theme }) => theme.spacing.md} 0 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Empty: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
