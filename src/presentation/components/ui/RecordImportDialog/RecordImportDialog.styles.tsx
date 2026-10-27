import styled from 'styled-components';

export const S = {
  Body: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Row: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  HiddenInput: styled.input`
    display: none;
  `,

  Hint: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  Muted: styled.span`
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    overflow-wrap: anywhere;
  `,

  Table: styled.div`
    display: flex;
    flex-direction: column;
    max-height: 50vh;
    overflow-y: auto;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
  `,

  HeaderRow: styled.div<{ $report?: boolean }>`
    display: grid;
    grid-template-columns: ${({ $report }) => ($report ? '80px 1fr' : '1fr 1fr 1.4fr')};
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm};
    background: ${({ theme }) => theme.colors.inputBackground};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  HeaderCell: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    text-transform: uppercase;
  `,

  MappingRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1.4fr;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  ReportRow: styled.div`
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  Cell: styled.div`
    min-width: 0;
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    overflow-wrap: anywhere;
  `,

  SampleCell: styled.div`
    min-width: 0;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  Options: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  ProgressTrack: styled.div`
    height: ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.inputBackground};
    overflow: hidden;
  `,

  ProgressBar: styled.div<{ $percent: number }>`
    height: 100%;
    width: ${({ $percent }) => $percent}%;
    background: ${({ theme }) => theme.colors.primary};
    transition: width ${({ theme }) => theme.transitions.fast};
  `,

  Footer: styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    padding-top: ${({ theme }) => theme.spacing.sm};
  `,
};
