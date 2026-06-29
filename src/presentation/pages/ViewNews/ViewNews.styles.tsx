import styled from 'styled-components';

export const S = {
  Root: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    max-width: 860px;
    margin: 0 auto;
  `,

  NotFound: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  Card: styled.article`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
  `,

  CardBody: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  AvatarColumn: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 56px;
    flex-shrink: 0;
  `,

  AuthorName: styled.span`
    font-size: 11px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
    text-align: center;
    width: 56px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  `,

  ContentColumn: styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  TitleRow: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ActionBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border: none;
    background: none;
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textMuted};
    transition: color ${({ theme }) => theme.transitions.fast},
                background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
    line-height: 1.3;
    flex: 1;
    min-width: 0;
  `,

  MetaChips: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  CategoryBadge: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 3px 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,

  DateText: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  EditedMeta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
  `,

  SystemBadge: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    background: ${({ theme }) => theme.colors.warning};
    color: #000;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 2px 8px;
    font-weight: 600;
    letter-spacing: 0.03em;
  `,

  TagsRow: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,

  TagPill: styled.span<{ $color: string }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    background: ${({ $color }) => $color}33;
    color: ${({ $color }) => $color};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 2px 8px;
    font-weight: 500;
  `,

  Divider: styled.hr`
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin: 0;
  `,

  Summary: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.7;
    margin: 0;
    font-style: italic;
  `,

  ContentWrapper: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.8;
  `,

  SourceLink: styled.a`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    &:hover { text-decoration: underline; }
  `,

  StatsRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.lg};
    padding-top: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    flex-wrap: wrap;
  `,

  StatItem: styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $active }) => $active ? theme.colors.primary : theme.colors.textMuted};
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover { color: ${({ theme }) => theme.colors.primary}; }
    &:disabled { cursor: default; }
  `,

  SaveBtn: styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $active }) => $active ? theme.colors.secondary : theme.colors.textMuted};
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    margin-left: auto;
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover { color: ${({ theme }) => theme.colors.secondary}; }
  `,
};
