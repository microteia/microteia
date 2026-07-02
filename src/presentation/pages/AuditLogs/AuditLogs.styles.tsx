import styled from 'styled-components';

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
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  TitleRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Title: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  FilterBar: styled.div`
    display: flex;
    align-items: center;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    background: ${({ theme }) => theme.colors.surface};
  `,

  TableHeader: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: ${({ theme }) => theme.spacing.xs} calc(${({ theme }) => theme.spacing.lg} + ${({ theme }) => theme.spacing.sm});
    background: ${({ theme }) => theme.colors.surface};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    letter-spacing: 0.03em;
  `,

  TableHeaderChevronSpacer: styled.span`
    width: 16px;
    flex-shrink: 0;
  `,

  TableHeaderSeveritySpacer: styled.span`
    width: 15px;
    flex-shrink: 0;
  `,

  TableHeaderTime: styled.span`
    width: 178px;
    flex-shrink: 0;
  `,

  List: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 0 ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
  `,

  Empty: styled.div`
    text-align: center;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    padding: ${({ theme }) => theme.spacing['2xl']};
  `,

  LoadingWrapper: styled.div`
    display: flex;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing['2xl']};
  `,

  LoadMoreWrapper: styled.div`
    display: flex;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.lg} 0;
  `,

  Restricted: styled.div`
    padding: ${({ theme }) => theme.spacing.lg};
  `,

  RetentionBar: styled.div`
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    flex-shrink: 0;
  `,
};
