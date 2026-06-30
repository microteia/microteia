import styled from 'styled-components';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,

  TitleRow: styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: ${({ theme }) => theme.colors.text};
  `,

  Title: styled.h1`
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  `,

  UnreadBadge: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.5rem;
    background: ${({ theme }) => theme.colors.danger};
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 0.75rem;
  `,

  FilterBar: styled.div`
    width: 100%;
  `,

  LoadingWrapper: styled.div`
    display: flex;
    justify-content: center;
    padding: 3rem;
  `,

  Empty: styled.div`
    text-align: center;
    padding: 3rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  List: styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
  `,

  Card: styled.div<{ $unread?: boolean }>`
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 1.5rem;
    transition: all 0.2s;
    ${({ $unread, theme }) => $unread && `
      border-left: 3px solid ${theme.colors.primary};
      background: ${theme.colors.backgroundSecondary};
    `}

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  `,

  CardHeader: styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  `,

  CardTitle: styled.div`
    flex: 1;
  `,

  Subject: styled.h3`
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  From: styled.div`
    font-size: 0.875rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Meta: styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  StatusBadge: styled.span<{ $status: 'pending' | 'reviewed' | 'archived' }>`
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    background: ${({ $status, theme }) => {
    switch ($status) {
      case 'pending': return `${theme.colors.warning}20`;
      case 'reviewed': return `${theme.colors.success}20`;
      case 'archived': return `${theme.colors.textSecondary}20`;
    }
  }};
    color: ${({ $status, theme }) => {
    switch ($status) {
      case 'pending': return theme.colors.warning;
      case 'reviewed': return theme.colors.success;
      case 'archived': return theme.colors.textSecondary;
    }
  }};
  `,

  ProcessInfo: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  InfoItem: styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  `,

  InfoLabel: styled.span`
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textSecondary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,

  InfoValue: styled.span`
    font-size: 0.875rem;
    color: ${({ theme }) => theme.colors.text};
    font-weight: 500;
  `,

  Actions: styled.div`
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  `,
};
