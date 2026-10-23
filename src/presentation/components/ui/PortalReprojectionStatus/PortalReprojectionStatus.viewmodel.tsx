import { useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../stores/useTenant';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import type { PortalReprojectionState } from '../../../../domain/schema/portalReprojection';
import { portalReprojectionSummary } from '../../../../domain/services/portalReprojectionNotice';
import { screenDataCollection } from '../../../../domain/services/screenDataCollection';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';

/** De quanto em quanto tempo a aba reconfere se uma passada parou — o job não avisa que parou. */
const CLOCK_TICK_MS = 60_000;

export interface PortalReprojectionStatusProgress {
  message: string;
  /** De 0 a 1; `null` sem o total — a tarja fica sem barra. */
  ratio: number | null;
}

export interface PortalReprojectionStatusWarning {
  collection: string;
  message: string;
}

export interface PortalReprojectionStatusViewModel {
  progress: PortalReprojectionStatusProgress | null;
  warnings: PortalReprojectionStatusWarning[];
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

  return useMemo(() => {
    if (!snapshot || snapshot.tenantId !== tenantId) return { progress: null, warnings: [] };
    const screenName = (key: string): string => {
      const screen = definitions.find((one) => screenDataCollection(one) === key);
      return screen ? label(screen.titlePlural) : key;
    };
    const states = new Map([...snapshot.states].filter(([key]) => !collection || key === collection));
    const summary = portalReprojectionSummary(states, now ?? 0);
    return {
      progress: summary.progress && {
        message: t(summary.progress.messageKey, {
          processed: formatNumber(summary.progress.processed),
          total: formatNumber(summary.progress.total ?? 0),
        }),
        ratio: summary.progress.ratio,
      },
      warnings: summary.warnings.map((warning) => ({
        collection: warning.collection,
        message: t(warning.messageKey, {
          screen: screenName(warning.collection),
          processed: formatNumber(warning.counts.processed),
          failed: formatNumber(warning.counts.failed),
        }),
      })),
    };
  }, [snapshot, tenantId, collection, definitions, label, t, formatNumber, now]);
};
