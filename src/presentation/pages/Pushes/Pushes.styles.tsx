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
      background: ${theme.colors.surface};
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

  StatusBadge: styled.span<{ $status: 'pending' | 'reviewed' | 'archived' | 'fault' }>`
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
      case 'fault': return `${theme.colors.danger}20`;
    }
  }};
    color: ${({ $status, theme }) => {
    switch ($status) {
      case 'pending': return theme.colors.warning;
      case 'reviewed': return theme.colors.success;
      case 'archived': return theme.colors.textSecondary;
      case 'fault': return theme.colors.danger;
    }
  }};
  `,

  ExtractionTag: styled.span`
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.6;
  `,

  ErrorBadge: styled.span`
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    background: ${({ theme }) => theme.colors.danger};
    color: white;
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

  EmailBodyToggle: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  EmailBodyToggleLeft: styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
  `,

  ActionsButton: styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: 0.875rem;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    background: transparent;
    transition: background 0.2s;

    &:hover {
      background: ${({ theme }) => theme.colors.surface};
    }
  `,

  TrustedBadge: styled.span`
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 12px;
    font-size: 0.625rem;
    font-weight: 500;
    background: ${({ theme }) => theme.colors.success}20;
    color: ${({ theme }) => theme.colors.success};
  `,

  EmailBodyContainer: styled.div`
    margin-top: 1rem;
    padding: 1rem;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    max-height: 500px;
    overflow-y: auto;
  `,

  EmailBodyHtml: styled.div`
    font-size: 0.875rem;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.text};
    word-wrap: break-word;
    
    * {
      max-width: 100%;
    }
    
    img {
      max-width: 100%;
      height: auto;
    }
    
    a {
      color: ${({ theme }) => theme.colors.primary};
      text-decoration: underline;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.5rem 0;
    }
    
    th, td {
      border: 1px solid ${({ theme }) => theme.colors.border};
      padding: 0.5rem;
      text-align: left;
    }
  `,

  EmailBodyText: styled.pre`
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.875rem;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.text};
    white-space: pre-wrap;
    word-wrap: break-word;
    margin: 0;
  `,

  LinkedDeadlinesSection: styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  LinkedDeadlineLabel: styled.span`
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textSecondary};
    letter-spacing: 0.5px;
    font-weight: 500;
  `,

  LinkedDeadlineLink: styled.button`
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: 0.75rem;
    font-weight: 500;
    background: ${({ theme }) => theme.colors.primary}15;
    color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: ${({ theme }) => theme.colors.primary}25;
      transform: translateY(-1px);
    }

    svg {
      flex-shrink: 0;
    }
  `,
};
