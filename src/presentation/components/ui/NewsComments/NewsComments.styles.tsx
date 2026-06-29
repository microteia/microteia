import styled from 'styled-components';

export const S = {
  Card: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    margin-top: ${({ theme }) => theme.spacing.lg};
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,

  Title: styled.h3`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  TitleIcon: styled.span`
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
  `,

  Count: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
  `,

  CollapseBtn: styled.button`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Empty: styled.div`
    text-align: center;
    padding: ${({ theme }) => theme.spacing.lg};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  List: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  CommentWrapper: styled.div`
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  `,

  ConfirmBox: styled.div`
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ConfirmText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  ConfirmBtns: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    justify-content: flex-end;
  `,

  CommentRow: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.background};
    }
  `,

  Body: styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,

  CommentHead: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  AuthorName: styled.span`
    font-weight: 600;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  Timestamp: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  EditedBadge: styled.span`
    position: relative;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: help;

    &:hover > span {
      opacity: 1;
      pointer-events: auto;
    }
  `,

  EditedTooltip: styled.span`
    position: absolute;
    bottom: calc(100% + 4px);
    left: 0;
    background: ${({ theme }) => theme.colors.text};
    color: ${({ theme }) => theme.colors.background};
    padding: 4px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity ${({ theme }) => theme.transitions.fast};
    z-index: 10;
  `,

  EditBlock: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  EditActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    justify-content: flex-end;
  `,

  ContentArea: styled.div<{ $clamped?: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.6;
    overflow: hidden;
    ${({ $clamped }) => $clamped && `
      display: -webkit-box;
      -webkit-line-clamp: 6;
      -webkit-box-orient: vertical;
    `}
  `,

  ReadMoreBtn: styled.button`
    background: none;
    border: none;
    padding: 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    margin-top: 4px;

    &:hover {
      text-decoration: underline;
    }
  `,

  CommentActions: styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  `,

  ActionBtn: styled.button`
    background: none;
    border: none;
    padding: 4px;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    display: flex;
    align-items: center;
    transition: color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  DeleteActionBtn: styled.button`
    background: none;
    border: none;
    padding: 4px;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    display: flex;
    align-items: center;
    transition: color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
      background: ${({ theme }) => theme.colors.dangerLight};
    }
  `,

  LikeBtn: styled.button<{ $liked?: boolean }>`
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    padding: 4px 6px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ $liked, theme }) => $liked ? theme.colors.primary : theme.colors.textMuted};
    cursor: pointer;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    transition: color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,

  EditorRow: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    padding-top: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  Avatar: styled.div`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  EditorBody: styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  EditorActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    justify-content: flex-end;
  `,

  EditorTriggerRow: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    padding-top: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  EditorTrigger: styled.button`
    flex: 1;
    padding: 10px 14px;
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    text-align: left;
    cursor: pointer;
    transition: border-color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,
};
