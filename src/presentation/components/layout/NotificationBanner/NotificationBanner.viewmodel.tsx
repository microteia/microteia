import { useState, useCallback, useEffect, useRef } from 'react';
import { useNotification } from '../../../../stores/useNotification';
import type { AppNotification } from '../../../../stores/useNotification';

const MAX_VISIBLE = 3;
const EXIT_MS = 250;
const SUCCESS_MS = 4000;

export interface NotificationBannerViewModel {
  visibleNotifications: AppNotification[];
  hiddenCount: number;
  exitingIds: Set<string>;
  handleDismiss: (id: string) => void;
  handleDismissAll: () => void;
}

export const useNotificationBannerViewModel = (): NotificationBannerViewModel => {
  const { notifications, dismiss, dismissAll } = useNotification();
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const autoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleDismiss = useCallback(
    (id: string) => {
      if (autoTimers.current.has(id)) {
        clearTimeout(autoTimers.current.get(id)!);
        autoTimers.current.delete(id);
      }
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

  const handleDismissAll = useCallback(() => {
    autoTimers.current.forEach(t => clearTimeout(t));
    exitTimers.current.forEach(t => clearTimeout(t));
    autoTimers.current.clear();
    exitTimers.current.clear();
    setExitingIds(new Set());
    dismissAll();
  }, [dismissAll]);

  useEffect(() => {
    notifications.forEach(n => {
      if (n.variant === 'success' && !autoTimers.current.has(n.id)) {
        const id = n.id;
        const t = setTimeout(() => {
          autoTimers.current.delete(id);
          setExitingIds(prev => new Set([...prev, id]));
          const exitT = setTimeout(() => {
            dismiss(id);
            setExitingIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            exitTimers.current.delete(id);
          }, EXIT_MS);
          exitTimers.current.set(id, exitT);
        }, SUCCESS_MS);
        autoTimers.current.set(id, t);
      }
    });

    const activeIds = new Set(notifications.map(n => n.id));
    autoTimers.current.forEach((t, id) => {
      if (!activeIds.has(id)) {
        clearTimeout(t);
        autoTimers.current.delete(id);
      }
    });
  }, [notifications, dismiss]);

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
  };
};
