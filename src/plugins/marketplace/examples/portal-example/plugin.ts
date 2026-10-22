import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import { portalView } from '../../../contributionBuilders';
import { mergeViewSources } from '../../../../sdk/mergeSources';
import CLIENT_PORTAL_VIEW from './views/ClientPortal.view.tsx?raw';
import CLIENT_PORTAL_VIEWMODEL from './views/ClientPortal.viewmodel.tsx?raw';
import CLIENT_PORTAL_STYLES from './views/ClientPortal.styles.tsx?raw';
import OPEN_ORDERS_WIDGET from './views/OpenOrdersWidget.view.tsx?raw';
import { portalExampleMessagesContribution } from './portalMessages';
import { portalExamplePtBrContribution } from './portalMessagesPtBr';

/**
 * **The portal, by example** — opening part of the organization to people from OUTSIDE it.
 *
 * | What | How |
 * |---|---|
 * | the screen whose records receive guests | `portal: { subject: 'self', fields }` |
 * | records that belong to one of those | `portal: { subject: { field: '<reference>' }, fields }` |
 * | the guest creates records there | `portal.create: { fields }` — the link is stamped by the server |
 * | the guest changes records there | `portal.edit: { fields, when?, onlyOwn? }` — only fields they see |
 * | the only fields that leave the organization | `portal.fields` — `internal` below never does |
 * | the only RECORDS that leave the organization | `portal.visibleWhen` — an office-only order never does |
 * | a page of your own in the portal | `portalView({ collection, surface: 'detail' }, viewKey)` |
 * | a card on the portal home | `portalView({ surface: 'widget', key, title }, viewKey)` |
 * | what those can read | `@microteia/portal` — never `@microteia/data` |
 *
 * Guests are invited by the organization, in Settings > Portal, to a Client. Each one then sees that
 * client and its orders — nothing else in the organization, not even that other clients exist.
 *
 * Orders point at the client, so in the portal they show INSIDE the client: that is how the standard
 * portal draws a link, and the page below draws it its own way.
 */

const message = (key: string): string => `@com.microteia.portal-example/${key}`;

const CLIENT_FIELDS: TemplateField[] = [
  { key: 'name', label: message('field.name'), type: 'text', required: true, order: 0 },
  { key: 'city', label: message('field.city'), type: 'text', required: false, order: 1 },
];

const CLIENT_SCREEN: ScreenModuleTemplate = {
  key: 'portalExampleClient',
  sourceId: 'microteia:portal-example:client',
  sourceRev: 1,
  titleSingular: message('screen.client'),
  titlePlural: message('screen.client.plural'),
  icon: 'team',
  fields: CLIENT_FIELDS,
  titleFieldKey: 'name',
  eventPrefix: 'portalExampleClient',
  portal: { subject: 'self', fields: ['name', 'city'] },
};

/**
 * `internal` is a field of the record that the guest never sees: it is not in `portal.fields`, so it
 * is not in the projection the guest reads. That is the whole exposure model — what is not declared
 * does not leave.
 *
 * `officeOnly` does the same for a whole RECORD: an order the organization logs against the client for
 * itself (a supplier's cost, say) has it checked, and `portal.visibleWhen` keeps it inside. The
 * condition reads the whole record, even fields the guest never sees.
 */
const ORDER_FIELDS: TemplateField[] = [
  { key: 'item', label: message('field.item'), type: 'text', required: true, order: 0 },
  { key: 'quantity', label: message('field.quantity'), type: 'number', required: false, order: 1 },
  { key: 'notes', label: message('field.notes'), type: 'textarea', required: false, order: 2 },
  { key: 'client', label: message('field.client'), type: 'reference', required: true, order: 3, refEntity: 'portalExampleClient' },
  { key: 'internal', label: message('field.internal'), type: 'textarea', required: false, order: 4 },
  { key: 'officeOnly', label: message('field.officeOnly'), type: 'checkbox', required: false, order: 5 },
];

const ORDER_SCREEN: ScreenModuleTemplate = {
  key: 'portalExampleOrder',
  sourceId: 'microteia:portal-example:order',
  sourceRev: 1,
  titleSingular: message('screen.order'),
  titlePlural: message('screen.order.plural'),
  icon: 'shoppingBag',
  fields: ORDER_FIELDS,
  titleFieldKey: 'item',
  eventPrefix: 'portalExampleOrder',
  portal: {
    subject: { field: 'client' },
    fields: ['item', 'quantity', 'notes'],
    // Checked in the office, the order never reaches the portal; a guest's own order leaves it empty.
    visibleWhen: 'officeOnly != true',
    create: { fields: ['item', 'quantity', 'notes'] },
    // A guest fixes the quantity or the notes of an order THEY placed — never the client it belongs to.
    edit: { fields: ['quantity', 'notes'], onlyOwn: true },
  },
};

const CLIENT_PORTAL_SOURCE = mergeViewSources({
  'ClientPortal.view.tsx': CLIENT_PORTAL_VIEW,
  'ClientPortal.viewmodel.tsx': CLIENT_PORTAL_VIEWMODEL,
  'ClientPortal.styles.tsx': CLIENT_PORTAL_STYLES,
});

export const portalExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.portal-example',
    version: '1.3.0',
    kernel: '^2.61.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0', 'core.tenant': '^1.0.0' },
    contributes: [
      portalExampleMessagesContribution(),
      portalExamplePtBrContribution(),

      /**
       * The Client record in the portal is THIS page. It runs in the guest's browser only when the
       * organization trusts this package's code — the server checks the same trust the Extensions
       * screen shows, and sends nothing otherwise; the standard page is drawn instead.
       */
      portalView({ collection: 'portalExampleClient', surface: 'detail' }, 'clientPortal'),

      /**
       * A card on the portal HOME. The organization decides whether it shows and where (Settings >
       * Portal); `order` is only a suggestion. A card is narrow on a phone and half the width on a
       * computer — draw it for the phone first.
       */
      portalView({ surface: 'widget', key: 'open-orders', title: message('portal.widget.orders'), order: 10 }, 'openOrdersWidget'),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [CLIENT_SCREEN, ORDER_SCREEN],
  views: [
    { key: 'clientPortal', title: message('screen.client'), icon: 'team', source: CLIENT_PORTAL_SOURCE },
    { key: 'openOrdersWidget', title: message('portal.widget.orders'), icon: 'shoppingBag', source: OPEN_ORDERS_WIDGET },
  ],
};
