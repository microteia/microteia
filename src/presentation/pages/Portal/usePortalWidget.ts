import { useCallback } from 'react';
import { useLocaleFormat, useT } from '../../shared/i18n/useT';
import { usePortal } from '../../../stores/usePortal';
import { portalSubjectKey } from '../../../domain/schema/portal';
import { PORTAL_RECORDS_WINDOW } from '../../../domain/entities/Portal';
import { DEFAULT_PORTAL_CARD_BODY } from '../../../domain/schema/ui/portalTemplate';
import {
  portalWidgetCollections,
  type PortalCountNode,
  type PortalRecordsNode,
  type PortalWidgetSpec,
} from '../../../domain/schema/ui/portalWidget';
import { usePortalRecordFormat } from './usePortalRecordFormat';
import { NO_RECORD_ANSWERS, resolvePortalNodes, type PortalWidgetRecords, type ResolvedPortalNode } from './resolvePortalTemplate';
import { countPortalWidgetRecords, selectPortalWidgetRecords } from './resolvePortalWidget';

/** Um widget declarado, respondido sobre o que o convidado tem agora. */
export interface PortalWidgetView {
  nodes: ResolvedPortalNode[];
  /** Alguma tela que ele lê ainda não chegou — o número de agora seria um zero falso. */
  loading: boolean;
}

/**
 * Responde o widget declarado da home (`portalWidgetSpec`) sobre as projeções que o portal já assina —
 * as de todas as telas, juntas (`recordsByCollection`): nenhuma consulta a mais. O cartão de cada
 * registro é o da tela no portal (as MESMAS respostas da lista), ou o que o widget desenha.
 */
export const usePortalWidget = (): ((spec: PortalWidgetSpec) => PortalWidgetView) => {
  const { context, recordsByCollection, isCollectionLoading } = usePortal();
  const t = useT('core.tenant');
  const { formatNumber } = useLocaleFormat();
  const { cardOf, answersOf } = usePortalRecordFormat();
  const timeZone = context?.timeZone;
  const screens = context?.screens;

  return useCallback((spec: PortalWidgetSpec): PortalWidgetView => {
    const countText = (node: PortalCountNode, parentKey: string | null): string => {
      const records = recordsByCollection[node.collection] ?? [];
      const total = formatNumber(countPortalWidgetRecords(records, node, parentKey, timeZone));
      // A janela cheia deixa de fora os mais antigos: o número é um piso, e diz isso.
      return records.length >= PORTAL_RECORDS_WINDOW ? t('portal.widget.count.capped', { count: total }) : total;
    };

    const recordsOf = (node: PortalRecordsNode): PortalWidgetRecords | null => {
      const screen = screens?.find((candidate) => candidate.collection === node.collection);
      if (!screen) return null;
      const body = node.card ?? screen.template?.card?.body ?? DEFAULT_PORTAL_CARD_BODY;
      const cards = selectPortalWidgetRecords(recordsByCollection[node.collection] ?? [], node, timeZone).map((record) => ({
        ...cardOf(screen, record),
        nodes: resolvePortalNodes(body, {
          ...answersOf(screen, record, 'card'),
          count: (inner) => countText(inner, inner.scope === 'record' ? portalSubjectKey(screen.collection, record.recordId) : null),
        }),
      }));
      return { cards, arrangement: { layout: node.layout ?? 'list', minWidth: node.minWidth ?? 'md' }, empty: node.empty ?? '' };
    };

    return {
      loading: portalWidgetCollections(spec.body).some(isCollectionLoading),
      nodes: resolvePortalNodes(spec.body, { ...NO_RECORD_ANSWERS, count: (node) => countText(node, null), records: recordsOf }),
    };
  }, [recordsByCollection, isCollectionLoading, screens, timeZone, formatNumber, t, cardOf, answersOf]);
};
