import { useMemo } from 'react';
import { useT } from '@microteia/i18n';
import { usePortalNavigation, usePortalRecord, usePortalRecords, usePortalScreen } from '@microteia/portal';

/** The Orders collection — the installed key of this package's screen. */
const ORDER_COLLECTION = 'portalExampleOrder';

/**
 * Everything the page decides, so the view only draws. A portal view receives the open record as
 * props (`collection`, `recordId`) and asks @microteia/portal for the rest: it never reaches
 * @microteia/data — the guest has none of the organization's stores.
 */
export const useClientPortalViewModel = ({ collection, recordId }: { collection: string; recordId?: string }) => {
  const t = useT('com.microteia.portal-example');
  const client = usePortalRecord(collection, recordId ?? '');
  const orderScreen = usePortalScreen(ORDER_COLLECTION);
  const navigation = usePortalNavigation();

  // `parent` filters to the orders of THIS client — the same link the server stamped on each order.
  const orders = usePortalRecords(ORDER_COLLECTION, { parent: { collection, recordId: recordId ?? '' } });

  const items = useMemo(() => orders.records.map((order) => ({
    id: order.recordId,
    text: t('portal.orders.quantity', {
      count: String(order.data.quantity ?? 1),
      item: String(order.data.item ?? order.title),
    }),
    // `canEdit` only decides whether to SHOW the gesture; the server checks again on every change.
    canEdit: order.canEdit,
  })), [orders.records, t]);

  return {
    t,
    title: client?.title ?? '',
    city: typeof client?.data.city === 'string' ? client.data.city : '',
    loading: orders.loading,
    items,
    // Only offered when the Orders screen lets guests create — the declaration decides, not the view.
    canOrder: !!orderScreen?.create && !!recordId,
    order: () => navigation.create(ORDER_COLLECTION, recordId),
    open: (orderId: string) => navigation.openRecord(ORDER_COLLECTION, orderId),
    edit: (orderId: string) => navigation.edit(ORDER_COLLECTION, orderId),
  };
};
