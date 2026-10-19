import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Portal example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const PORTAL_EXAMPLE_NAMESPACE = 'com.microteia.portal-example';

export const PORTAL_EXAMPLE_MESSAGES: Record<string, string> = {
  'package.name': 'Portal, by example',
  'package.category': 'Interface',
  'package.description':
    'Clients see their own orders in the portal, and place new ones — on a page of the extension, not the standard one.',
  'package.summary':
    'How an extension opens part of the organization to people from OUTSIDE it. Each Client receives guests; Orders point at the client, so each guest sees only the orders of their own client, and places new ones there. The Client record in the portal is a view of this package, written against @microteia/portal — the only API a portal view reaches.',

  'screen.client': 'Client',
  'screen.client.plural': 'Clients',
  'screen.order': 'Order',
  'screen.order.plural': 'Orders',

  'field.name': 'Name',
  'field.city': 'City',
  'field.client': 'Client',
  'field.item': 'Item',
  'field.quantity': 'Quantity',
  'field.notes': 'Notes',
  'field.internal': 'Internal note',

  'portal.orders': 'Your orders',
  'portal.orders.empty': 'No orders yet.',
  'portal.orders.new': 'Place an order',
  'portal.orders.quantity': '{count} × {item}',
};

export const portalExampleMessagesContribution = (): Contribution =>
  messageBundleContribution({ locale: DEFAULT_LOCALE, namespace: PORTAL_EXAMPLE_NAMESPACE, messages: PORTAL_EXAMPLE_MESSAGES });
