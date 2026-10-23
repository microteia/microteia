import type {
  LookupModuleTemplate,
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
 * | a choice fed by the organization's own list | `lookupCollection` — the guest gets its options, labels and colours |
 * | the only fields that leave the organization | `portal.fields` — `internal` below never does |
 * | the only RECORDS that leave the organization | `portal.visibleWhen` — an office-only order never does |
 * | a page of your own in the portal | `portalView({ collection, surface: 'detail' }, viewKey)` |
 * | a card on the portal home | `portalView({ surface: 'widget', key, title }, viewKey)` |
 * | what those can read | `@microteia/portal` — never `@microteia/data` |
 * | a screen over a collection named apart from its key | `dataCollection` — links point at the COLLECTION |
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
 * A list of options this package brings. The KEYS are stable; from install time on the list belongs to
 * the organization — it renames, recolours and adds options, and the portal shows the guest the list as
 * it is THEN, read by the server. A guest never reads a list, and only the lists of fields the portal
 * exposes leave the organization.
 */
const URGENCIES: LookupModuleTemplate = {
  collection: 'portalExampleUrgencies',
  label: message('lookup.urgencies'),
  options: [
    { key: 'routine', label: message('urgency.routine'), color: 'success' },
    { key: 'soon', label: message('urgency.soon'), color: 'warning' },
    { key: 'urgent', label: message('urgency.urgent'), color: 'danger' },
  ],
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
  {
    key: 'urgency',
    label: message('field.urgency'),
    type: 'select',
    required: false,
    order: 2,
    lookupCollection: URGENCIES.collection,
    optionsColored: true,
  },
  { key: 'notes', label: message('field.notes'), type: 'textarea', required: false, order: 3 },
  { key: 'client', label: message('field.client'), type: 'reference', required: true, order: 4, refEntity: 'portalExampleClient' },
  { key: 'internal', label: message('field.internal'), type: 'textarea', required: false, order: 5 },
  { key: 'officeOnly', label: message('field.officeOnly'), type: 'checkbox', required: false, order: 6 },
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
    fields: ['item', 'quantity', 'urgency', 'notes'],
    // Checked in the office, the order never reaches the portal; a guest's own order leaves it empty.
    visibleWhen: 'officeOnly != true',
    create: { fields: ['item', 'quantity', 'urgency', 'notes'] },
    // A guest fixes the quantity, the urgency or the notes of an order THEY placed — never the client
    // it belongs to.
    edit: { fields: ['quantity', 'urgency', 'notes'], onlyOwn: true },
  },
};

/**
 * A Site keeps its records in a collection named apart from the screen (`dataCollection`) — the way a
 * package takes over a collection that already exists. Installing it also writes a bare screen under
 * the collection's own name, so the organization ends up with TWO screens over `portalExampleSites`;
 * only this one is in the portal.
 */
const SITE_COLLECTION = 'portalExampleSites';

const SITE_FIELDS: TemplateField[] = [
  { key: 'name', label: message('field.name'), type: 'text', required: true, order: 0 },
  { key: 'client', label: message('field.client'), type: 'reference', required: true, order: 1, refEntity: 'portalExampleClient' },
];

const SITE_SCREEN: ScreenModuleTemplate = {
  key: 'portalExampleSite',
  sourceId: 'microteia:portal-example:site',
  sourceRev: 1,
  titleSingular: message('screen.site'),
  titlePlural: message('screen.site.plural'),
  icon: 'mapPin',
  dataCollection: SITE_COLLECTION,
  fields: SITE_FIELDS,
  titleFieldKey: 'name',
  eventPrefix: 'portalExampleSite',
  portal: { subject: { field: 'client' }, fields: ['name'] },
};

/**
 * A Visit hangs from a Site by the COLLECTION name, as every child does (`parentEntity`), and reaches
 * the guest through it: Visit → Site → Client. The portal follows the link to the screen that is in the
 * portal for that collection, never to the bare one.
 */
const VISIT_FIELDS: TemplateField[] = [
  { key: 'date', label: message('field.date'), type: 'date', required: true, order: 0 },
  { key: 'summary', label: message('field.summary'), type: 'textarea', required: false, order: 1 },
  { key: 'site', label: message('field.site'), type: 'reference', required: true, order: 2, refEntity: SITE_COLLECTION },
];

const VISIT_SCREEN: ScreenModuleTemplate = {
  key: 'portalExampleVisit',
  sourceId: 'microteia:portal-example:visit',
  sourceRev: 1,
  titleSingular: message('screen.visit'),
  titlePlural: message('screen.visit.plural'),
  icon: 'calendar',
  fields: VISIT_FIELDS,
  titleFieldKey: 'date',
  parentEntity: SITE_COLLECTION,
  parentFieldKey: 'site',
  parentRelation: 'owned',
  eventPrefix: 'portalExampleVisit',
  portal: { subject: 'parent', fields: ['date', 'summary'] },
};

const CLIENT_PORTAL_SOURCE = mergeViewSources({
  'ClientPortal.view.tsx': CLIENT_PORTAL_VIEW,
  'ClientPortal.viewmodel.tsx': CLIENT_PORTAL_VIEWMODEL,
  'ClientPortal.styles.tsx': CLIENT_PORTAL_STYLES,
});

export const portalExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.portal-example',
    version: '1.5.0',
    kernel: '^2.62.0',
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
  screens: [CLIENT_SCREEN, ORDER_SCREEN, SITE_SCREEN, VISIT_SCREEN],
  lookups: [URGENCIES],
  views: [
    { key: 'clientPortal', title: message('screen.client'), icon: 'team', source: CLIENT_PORTAL_SOURCE },
    { key: 'openOrdersWidget', title: message('portal.widget.orders'), icon: 'shoppingBag', source: OPEN_ORDERS_WIDGET },
  ],
};
