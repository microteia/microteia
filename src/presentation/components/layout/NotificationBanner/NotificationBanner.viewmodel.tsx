import { useState, useCallback, useEffect, useRef } from 'react';
import { useNotification } from '../../../../stores/useNotification';
import type { AppNotification, NotificationVariant } from '../../../../stores/useNotification';

const MAX_VISIBLE = 3;
const EXIT_MS = 250;

const DURATIONS: Record<NotificationVariant, number> = {
  success: 4000,
  error: 10000,
  warning: 10000,
  info: 10000,
};

export interface NotificationBannerProps {
  /**
   * O erro fica até ser fechado. É o portal: quem lê é o convidado, quase sempre no celular, onde não
   * há o "passar o mouse" que segura o aviso — e o erro é o que ele precisa ler até o fim.
   */
  persistErrors?: boolean;
}

export interface NotificationBannerViewModel {
  visibleNotifications: AppNotification[];
  hiddenCount: number;
  exitingIds: Set<string>;
  handleDismiss: (id: string) => void;
  handleDismissAll: () => void;
  handleMouseEnter: (id: string) => void;
  handleMouseLeave: (id: string) => void;
}

export const useNotificationBannerViewModel = ({ persistErrors = false }: NotificationBannerProps = {}): NotificationBannerViewModel => {
  const { notifications, dismiss, dismissAll } = useNotification();
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const autoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const hoveredIds = useRef<Set<string>>(new Set());
  const variants = useRef<Map<string, NotificationVariant>>(new Map());

  const beginExit = useCallback(
    (id: string) => {
      if (autoTimers.current.has(id)) {
        clearTimeout(autoTimers.current.get(id)!);
        autoTimers.current.delete(id);
      }
      if (exitTimers.current.has(id)) return;
      setExitingIds(prev => new Set([...prev, id]));
      const t = setTimeout(() => {
        dismiss(id);
        setExitingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        exitTimers.current.delete(id);
      }, EXIT_MS);
      exitTimers.current.set(id, t);
    },
    [dismiss],
  );

  const scheduleAuto = useCallback(
    (id: string, variant: NotificationVariant) => {
      if (autoTimers.current.has(id) || exitTimers.current.has(id)) return;
      if (hoveredIds.current.has(id)) return;
      if (persistErrors && variant === 'error') return;
      const t = setTimeout(() => {
        autoTimers.current.delete(id);
        beginExit(id);
      }, DURATIONS[variant]);
      autoTimers.current.set(id, t);
    },
    [beginExit, persistErrors],
  );

  const handleDismiss = useCallback((id: string) => beginExit(id), [beginExit]);

  const handleMouseEnter = useCallback((id: string) => {
    hoveredIds.current.add(id);
    if (autoTimers.current.has(id)) {
      clearTimeout(autoTimers.current.get(id)!);
      autoTimers.current.delete(id);
    }
  }, []);

  const handleMouseLeave = useCallback(
    (id: string) => {
      hoveredIds.current.delete(id);
      const variant = variants.current.get(id);
      if (variant) scheduleAuto(id, variant);
    },
    [scheduleAuto],
  );

  const handleDismissAll = useCallback(() => {
    autoTimers.current.forEach(t => clearTimeout(t));
    exitTimers.current.forEach(t => clearTimeout(t));
    autoTimers.current.clear();
    exitTimers.current.clear();
    hoveredIds.current.clear();
    setExitingIds(new Set());
    dismissAll();
  }, [dismissAll]);

  useEffect(() => {
    notifications.forEach(n => {
      variants.current.set(n.id, n.variant);
      scheduleAuto(n.id, n.variant);
    });

    const activeIds = new Set(notifications.map(n => n.id));
    autoTimers.current.forEach((t, id) => {
      if (!activeIds.has(id)) {
        clearTimeout(t);
        autoTimers.current.delete(id);
      }
    });
    variants.current.forEach((_, id) => {
      if (!activeIds.has(id)) variants.current.delete(id);
    });
    hoveredIds.current.forEach(id => {
      if (!activeIds.has(id)) hoveredIds.current.delete(id);
    });
  }, [notifications, scheduleAuto]);

  useEffect(() => {
    const auto = autoTimers.current;
    const exit = exitTimers.current;
    return () => {
      auto.forEach(t => clearTimeout(t));
      exit.forEach(t => clearTimeout(t));
    };
  }, []);

  return {
    visibleNotifications: notifications.slice(0, MAX_VISIBLE),
    hiddenCount: Math.max(0, notifications.length - MAX_VISIBLE),
    exitingIds,
    handleDismiss,
    handleDismissAll,
    handleMouseEnter,
    handleMouseLeave,
  };
};
