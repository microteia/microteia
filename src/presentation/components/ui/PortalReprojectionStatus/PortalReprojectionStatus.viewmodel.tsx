import { useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../stores/useTenant';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import type { PortalReprojectionState } from '../../../../domain/schema/portalReprojection';
import { portalReprojectionNotice } from '../../../../domain/services/portalReprojectionNotice';
import { screenDataCollection } from '../../../../domain/services/screenDataCollection';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';

/** De quanto em quanto tempo a aba reconfere se uma passada parou — o job não avisa que parou. */
const CLOCK_TICK_MS = 60_000;

export interface PortalReprojectionStatusItem {
  collection: string;
  message: string;
  variant: 'info' | 'warning';
}

export interface PortalReprojectionStatusViewModel {
  items: PortalReprojectionStatusItem[];
}

interface Snapshot {
  tenantId: string;
  states: Map<string, PortalReprojectionState>;
}

/**
 * O andamento das passadas que atualizam o portal, do lado do ESCRITÓRIO. `collection` restringe a uma
 * coleção (a da tela aberta no Form Design); ausente, todas.
 */
export const usePortalReprojectionStatusViewModel = (collection?: string): PortalReprojectionStatusViewModel => {
  const { portalRepository } = useDI();
  const { currentTenant } = useTenant();
  const { definitions } = useScreenDefinitions();
  const t = useT('core.records');
  const label = useLabel();
  const { formatNumber } = useLocaleFormat();
  const tenantId = currentTenant?.id ?? null;

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId) return undefined;
    return portalRepository.subscribeReprojections(tenantId, (states) => setSnapshot({ tenantId, states }));
  }, [portalRepository, tenantId]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, CLOCK_TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  const items = useMemo(() => {
    if (!snapshot || snapshot.tenantId !== tenantId) return [];
    const screenName = (key: string): string => {
      const screen = definitions.find((one) => screenDataCollection(one) === key);
      return screen ? label(screen.titlePlural) : key;
    };
    return [...snapshot.states.entries()]
      .filter(([key]) => !collection || key === collection)
      .flatMap(([key, state]): PortalReprojectionStatusItem[] => {
        const notice = portalReprojectionNotice(state, now ?? 0);
        if (!notice) return [];
        const message = t(notice.messageKey, {
          screen: screenName(key),
          processed: formatNumber(notice.counts.processed),
          total: formatNumber(notice.counts.total),
          failed: formatNumber(notice.counts.failed),
        });
        return [{ collection: key, message, variant: notice.variant }];
      });
  }, [snapshot, tenantId, collection, definitions, label, t, formatNumber, now]);

  return { items };
};
