import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { startOfDay, addDays, subDays, format, eachDayOfInterval } from 'date-fns';
import type { Deadline } from '../../../../domain/entities';

export type DateReferenceMode = 'dueDate' | 'completedAt';
export type PeriodDays = 7 | 15 | 30 | 60;

export interface TypeChartData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface DailyChartData {
  date: string;
  [key: string]: number | string; // cada tipo de prazo terá sua própria chave
}

export interface DeadlineChartsViewModel {
  showCharts: boolean;
  dateMode: DateReferenceMode;
  periodDays: PeriodDays;
  typeData: TypeChartData[];
  dailyData: DailyChartData[];
  allTypes: string[];
  visibleTypes: string[];
  totalInPeriod: number;
  typeColorMap: Record<string, string>;
  toggleCharts: () => void;
  setDateMode: (mode: DateReferenceMode) => void;
  setPeriodDays: (days: PeriodDays) => void;
  toggleTypeVisibility: (type: string) => void;
}

const STORAGE_KEY_SHOW = 'microteia:dashboard:showCharts';
const STORAGE_KEY_PERIOD = 'microteia:dashboard:chartsPeriod';

const loadShowCharts = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SHOW);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

const saveShowCharts = (value: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY_SHOW, String(value));
  } catch {
    // ignore
  }
};

const loadPeriodDays = (): PeriodDays => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PERIOD);
    if (stored && ['7', '15', '30', '60'].includes(stored)) {
      return Number(stored) as PeriodDays;
    }
    return 30;
  } catch {
    return 30;
  }
};

const savePeriodDays = (value: PeriodDays): void => {
  try {
    localStorage.setItem(STORAGE_KEY_PERIOD, String(value));
  } catch {
    // ignore
  }
};

export const useDeadlineChartsViewModel = (
  deadlines: Deadline[],
): DeadlineChartsViewModel => {
  const theme = useTheme();
  const [showCharts, setShowCharts] = useState(() => loadShowCharts());
  const [dateMode, setDateMode] = useState<DateReferenceMode>('dueDate');
  const [periodDays, setPeriodDaysState] = useState<PeriodDays>(() => loadPeriodDays());
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(() => new Set());

  const typeColorMap = useMemo<Record<string, string>>(() => {
    const colors = [
      theme.colors.primary,
      theme.colors.secondary,
      theme.colors.success,
      theme.colors.warning,
      theme.colors.danger,
      theme.colors.info,
      theme.colors.kpiCases,
      theme.colors.kpiPersons,
    ];
    const types = Array.from(new Set(deadlines.map((d) => d.type))).sort();
    return Object.fromEntries(types.map((t, i) => [t, colors[i % colors.length]]));
  }, [deadlines, theme]);

  const allTypes = useMemo(() => Object.keys(typeColorMap).sort(), [typeColorMap]);

  const visibleTypes = useMemo(
    () => allTypes.filter((t) => !hiddenTypes.has(t)),
    [allTypes, hiddenTypes],
  );

  const toggleCharts = useCallback(() => {
    setShowCharts((prev) => {
      const next = !prev;
      saveShowCharts(next);
      return next;
    });
  }, []);

  const setPeriodDays = useCallback((days: PeriodDays) => {
    setPeriodDaysState(days);
    savePeriodDays(days);
  }, []);

  const toggleTypeVisibility = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Filtra prazos baseado no modo de data e período
  const filteredDeadlines = useMemo(() => {
    const today = startOfDay(new Date());
    let startDate: Date;
    let endDate: Date;

    if (dateMode === 'completedAt') {
      // Conclusão: período para TRÁS (últimos X dias)
      startDate = subDays(today, periodDays);
      endDate = today;
      return deadlines.filter((d) => {
        if (!d.completedAt) return false;
        const refDate = startOfDay(d.completedAt);
        return refDate >= startDate && refDate <= endDate;
      });
    } else {
      // Vencimento: período para FRENTE (próximos X dias)
      startDate = today;
      endDate = addDays(today, periodDays);
      return deadlines.filter((d) => {
        const refDate = startOfDay(d.dueDate);
        return refDate >= startDate && refDate <= endDate;
      });
    }
  }, [deadlines, dateMode, periodDays]);

  // Dados do gráfico de pizza/donut
  const typeData = useMemo<TypeChartData[]>(() => {
    const counts = filteredDeadlines.reduce<Record<string, number>>((acc, d) => {
      acc[d.type] = (acc[d.type] ?? 0) + 1;
      return acc;
    }, {});

    const total = Object.values(counts).reduce((sum, v) => sum + v, 0);

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
        color: typeColorMap[name] ?? theme.colors.textSecondary,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDeadlines, typeColorMap, theme]);

  const totalInPeriod = useMemo(
    () => filteredDeadlines.length,
    [filteredDeadlines],
  );

  // Dados do gráfico de linhas diário
  const dailyData = useMemo<DailyChartData[]>(() => {
    const today = startOfDay(new Date());
    let startDate: Date;
    let endDate: Date;

    if (dateMode === 'completedAt') {
      startDate = subDays(today, periodDays);
      endDate = today;
    } else {
      startDate = today;
      endDate = addDays(today, periodDays);
    }

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map((day) => {
      const dayKey = format(day, 'dd/MM');
      const dayStart = startOfDay(day);
      const dayEnd = addDays(dayStart, 1);

      const row: DailyChartData = { date: dayKey };

      allTypes.forEach((type) => {
        const count = filteredDeadlines.filter((d) => {
          const refDate =
            dateMode === 'completedAt' && d.completedAt
              ? startOfDay(d.completedAt)
              : startOfDay(d.dueDate);
          return d.type === type && refDate >= dayStart && refDate < dayEnd;
        }).length;
        row[type] = count;
      });

      return row;
    });
  }, [filteredDeadlines, dateMode, periodDays, allTypes]);

  return {
    showCharts,
    dateMode,
    periodDays,
    typeData,
    dailyData,
    allTypes,
    visibleTypes,
    totalInPeriod,
    typeColorMap,
    toggleCharts,
    setDateMode,
    setPeriodDays,
    toggleTypeVisibility,
  };
};
