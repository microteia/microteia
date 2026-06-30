import { useMemo } from 'react';
import { usePush } from '../../../stores/usePush';
import { usePushInteraction } from '../../../stores/usePushInteraction';
import type { Push } from '../../../domain/entities';

export interface DashboardMetrics {
  total: number;
  unread: number;
  pending: number;
  reviewed: number;
  archived: number;
  parsedByRegex: number;
  parsedByAI: number;
  withErrors: number;
  byCourtMap: Map<string, number>;
  last7Days: { date: string; count: number }[];
  last30Days: { date: string; count: number }[];
}

export interface CourtStat {
  court: string;
  count: number;
  percent: number;
}

export interface DashboardPushesViewModel {
  metrics: DashboardMetrics;
  courtStats: CourtStat[];
  statusData: { label: string; count: number; percent: number; color: string }[];
  parsingData: { label: string; count: number; percent: number }[];
  timelineData: { label: string; count: number; height: number }[];
  loading: boolean;
}

const getLast7Days = (): Date[] => {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
};

const formatDate = (date: Date): string => {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
};

const calculateMetrics = (pushes: Push[], readPushIds: Set<string>): DashboardMetrics => {
  const unread = pushes.filter(p => !readPushIds.has(p.id)).length;
  const pending = pushes.filter(p => p.status === 'pending').length;
  const reviewed = pushes.filter(p => p.status === 'reviewed').length;
  const archived = pushes.filter(p => p.status === 'archived').length;
  const parsedByRegex = pushes.filter(p => !p.parsedByAI).length;
  const parsedByAI = pushes.filter(p => p.parsedByAI).length;
  const withErrors = pushes.filter(p => p.parsingError).length;

  const byCourtMap = new Map<string, number>();
  pushes.forEach(p => {
    const court = p.court || 'Não identificado';
    byCourtMap.set(court, (byCourtMap.get(court) || 0) + 1);
  });

  const last7DaysDates = getLast7Days();
  const last7Days = last7DaysDates.map(d => {
    const dateStr = d.toISOString().split('T')[0];
    const count = pushes.filter(p => {
      const pushDate = new Date(p.receivedAt);
      pushDate.setHours(0, 0, 0, 0);
      return pushDate.toISOString().split('T')[0] === dateStr;
    }).length;
    return { date: formatDate(d), count };
  });

  return {
    total: pushes.length,
    unread,
    pending,
    reviewed,
    archived,
    parsedByRegex,
    parsedByAI,
    withErrors,
    byCourtMap,
    last7Days,
    last30Days: [], // TODO: implement if needed
  };
};

export const useDashboardPushesViewModel = (): DashboardPushesViewModel => {
  const { pushes, loading } = usePush();
  const { interactions } = usePushInteraction();

  const readPushIds = useMemo(() => {
    return new Set(interactions.filter(i => i.isRead).map(i => i.pushId));
  }, [interactions]);

  const metrics = useMemo(() => {
    return calculateMetrics(pushes, readPushIds);
  }, [pushes, readPushIds]);

  const courtStats = useMemo((): CourtStat[] => {
    const stats: CourtStat[] = [];
    metrics.byCourtMap.forEach((count, court) => {
      stats.push({
        court,
        count,
        percent: metrics.total > 0 ? (count / metrics.total) * 100 : 0,
      });
    });
    return stats.sort((a, b) => b.count - a.count);
  }, [metrics]);

  const statusData = useMemo(() => {
    return [
      { label: 'Pendente', count: metrics.pending, percent: metrics.total > 0 ? (metrics.pending / metrics.total) * 100 : 0, color: '#F59E0B' },
      { label: 'Revisado', count: metrics.reviewed, percent: metrics.total > 0 ? (metrics.reviewed / metrics.total) * 100 : 0, color: '#10B981' },
      { label: 'Arquivado', count: metrics.archived, percent: metrics.total > 0 ? (metrics.archived / metrics.total) * 100 : 0, color: '#6B7280' },
    ];
  }, [metrics]);

  const parsingData = useMemo(() => {
    return [
      { label: 'Regex (Padrão)', count: metrics.parsedByRegex, percent: metrics.total > 0 ? (metrics.parsedByRegex / metrics.total) * 100 : 0 },
      { label: 'IA (Fallback)', count: metrics.parsedByAI, percent: metrics.total > 0 ? (metrics.parsedByAI / metrics.total) * 100 : 0 },
    ];
  }, [metrics]);

  const timelineData = useMemo(() => {
    const maxCount = Math.max(...metrics.last7Days.map(d => d.count), 1);
    return metrics.last7Days.map(d => ({
      label: d.date,
      count: d.count,
      height: (d.count / maxCount) * 100,
    }));
  }, [metrics]);

  return {
    metrics,
    courtStats,
    statusData,
    parsingData,
    timelineData,
    loading,
  };
};
