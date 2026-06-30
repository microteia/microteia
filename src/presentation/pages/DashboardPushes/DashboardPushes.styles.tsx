import styled from 'styled-components';

export const S = {
  Page: styled.div`
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  `,

  Header: styled.header`
    margin-bottom: 2rem;
  `,

  TitleRow: styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: ${({ theme }) => theme.colors.text};
    
    svg {
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Title: styled.h1`
    font-size: 1.75rem;
    font-weight: 600;
    margin: 0;
  `,

  Subtitle: styled.p`
    margin-top: 0.5rem;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 0.95rem;
  `,

  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  `,

  MetricCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: 1.5rem;
    transition: all 0.2s;

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary}40;
      box-shadow: 0 4px 12px ${({ theme }) => theme.colors.shadow};
    }
  `,

  MetricLabel: styled.div`
    font-size: 0.875rem;
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: 0.5rem;
    font-weight: 500;
  `,

  MetricValue: styled.div`
    font-size: 2rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  MetricSubtext: styled.div`
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  ChartsRow: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  `,

  ChartCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: 1.5rem;
  `,

  ChartTitle: styled.h3`
    font-size: 1rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: 0 0 1.5rem 0;
  `,

  BarChart: styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
  `,

  BarRow: styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
  `,

  BarLabel: styled.div`
    min-width: 120px;
    font-size: 0.875rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  BarTrack: styled.div`
    flex: 1;
    height: 32px;
    background: ${({ theme }) => theme.colors.background};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    position: relative;
  `,

  BarFill: styled.div<{ $percent: number; $color?: string }>`
    height: 100%;
    width: ${({ $percent }) => $percent}%;
    background: ${({ $color, theme }) => $color || theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    transition: width 0.4s ease;
  `,

  PieChart: styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  `,

  PieVisual: styled.div`
    width: 200px;
    height: 200px;
    border-radius: 50%;
    margin: 0 auto;
    position: relative;
    background: conic-gradient(
      ${({ theme }) => theme.colors.success} 0deg,
      ${({ theme }) => theme.colors.success} var(--pending-deg, 0deg),
      ${({ theme }) => theme.colors.info} var(--pending-deg, 0deg),
      ${({ theme }) => theme.colors.info} var(--reviewed-deg, 0deg),
      ${({ theme }) => theme.colors.textSecondary}40 var(--reviewed-deg, 0deg),
      ${({ theme }) => theme.colors.textSecondary}40 360deg
    );
    box-shadow: 0 4px 12px ${({ theme }) => theme.colors.shadow};
  `,

  PieLegend: styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  `,

  LegendItem: styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
  `,

  LegendColor: styled.div<{ $color: string }>`
    width: 16px;
    height: 16px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ $color }) => $color};
  `,

  LegendLabel: styled.div`
    flex: 1;
    font-size: 0.875rem;
    color: ${({ theme }) => theme.colors.text};
  `,

  LegendValue: styled.div`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  TimelineCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: 1.5rem;
    grid-column: 1 / -1;
  `,

  Timeline: styled.div`
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    height: 200px;
    padding: 1rem 0;
  `,

  TimelineBar: styled.div<{ $height: number }>`
    flex: 1;
    height: ${({ $height }) => $height}%;
    min-height: 4px;
    background: ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.sm} ${({ theme }) => theme.borderRadius.sm} 0 0;
    position: relative;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: ${({ theme }) => theme.colors.primaryHover};
      transform: scaleY(1.05);
    }
  `,

  TimelineLabel: styled.div`
    display: flex;
    justify-content: space-between;
    margin-top: 1rem;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  EmptyState: styled.div`
    text-align: center;
    padding: 4rem 2rem;
    color: ${({ theme }) => theme.colors.textSecondary};
    
    svg {
      font-size: 4rem;
      margin-bottom: 1rem;
      opacity: 0.3;
    }
    
    p {
      font-size: 1.125rem;
      margin: 0;
    }
  `,
};
