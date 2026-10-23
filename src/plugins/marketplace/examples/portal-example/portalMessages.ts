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
  'screen.site': 'Site',
  'screen.site.plural': 'Sites',
  'screen.visit': 'Visit',
  'screen.visit.plural': 'Visits',

  'field.name': 'Name',
  'field.city': 'City',
  'field.client': 'Client',
  'field.item': 'Item',
  'field.quantity': 'Quantity',
  'field.notes': 'Notes',
  'field.internal': 'Internal note',
  'field.site': 'Site',
  'field.date': 'Date',
  'field.summary': 'Summary',
  'field.officeOnly': 'Office only — never shown in the portal',
  'field.urgency': 'Urgency',

  'lookup.urgencies': 'Order urgencies',
  'urgency.routine': 'Routine',
  'urgency.soon': 'Soon',
  'urgency.urgent': 'Urgent',

  'portal.orders': 'Your orders',
  'portal.orders.empty': 'No orders yet.',
  'portal.orders.new': 'Place an order',
  'portal.orders.edit': 'Edit',
  'portal.orders.quantity': '{count} × {item}',
  'portal.widget.orders': 'Your orders',
  'portal.widget.orders.caption': 'orders placed in the portal',

  'workflow.visit-scheduled': 'Tell the client about a new visit',
  'workflow.visit-scheduled.description': 'When a visit is scheduled, notifies the client\'s portal guests by e-mail and on the portal bell.',
  'notify.visit.title': 'A visit was scheduled',
  'notify.visit.message': 'Open it in the portal to see the date and the summary.',
};

export const portalExampleMessagesContribution = (): Contribution =>
  messageBundleContribution({ locale: DEFAULT_LOCALE, namespace: PORTAL_EXAMPLE_NAMESPACE, messages: PORTAL_EXAMPLE_MESSAGES });
