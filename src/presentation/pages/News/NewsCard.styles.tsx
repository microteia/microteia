import styled from 'styled-components';

export const S = {
  Card: styled.article<{ $isRead?: boolean }>`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-left-width: 3px;
    border-left-color: ${({ $isRead, theme }) => $isRead ? theme.colors.border : theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    opacity: ${({ $isRead }) => ($isRead ? 0.75 : 1)};
    transition: opacity ${({ theme }) => theme.transitions.fast},
                box-shadow ${({ theme }) => theme.transitions.fast},
                border-left-color ${({ theme }) => theme.transitions.fast};
    cursor: pointer;

    &:hover {
      box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow};
      opacity: 1;
    }
  `,

  CardBody: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  AvatarColumn: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 44px;
    flex-shrink: 0;
  `,

  ContentColumn: styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  TitleLine: styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Title: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
    line-height: 1.4;
    flex: 1;
    min-width: 0;
    word-break: break-word;
  `,

  MetaRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  MetaSpacer: styled.span`
    flex: 1;
  `,

  CategoryBadge: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 2px 8px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  `,

  SystemBadge: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    background: ${({ theme }) => theme.colors.warning};
    color: #000;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 2px 8px;
    letter-spacing: 0.03em;
  `,

  UnreadBadge: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 2px 8px;
    border: 1px solid ${({ theme }) => theme.colors.primary}44;
  `,


  DateText: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    flex-shrink: 0;
  `,

  AuthorName: styled.span`
    font-size: 10px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
    text-align: center;
    line-height: 1.3;
    width: 44px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  `,

  EditedText: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
    line-height: 1.3;
  `,

  Summary: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,

  TagsRow: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  TagPill: styled.span<{ $color: string }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    background: ${({ $color }) => $color}33;
    color: ${({ $color }) => $color};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 2px 8px;
    font-weight: 500;
  `,

  FooterRow: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: ${({ theme }) => theme.spacing.xs};
    padding-top: ${({ theme }) => theme.spacing.xs};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  Stats: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  StatItem: styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme, $active }) => $active ? theme.colors.primary : theme.colors.textMuted};
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  StatDisplay: styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    padding: 2px 4px;
  `,

  Actions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  IconBtn: styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border: none;
    background: none;
    cursor: pointer;
    color: ${({ theme, $active }) => $active ? theme.colors.primary : theme.colors.textMuted};
    transition: color ${({ theme }) => theme.transitions.fast},
                background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,
};
