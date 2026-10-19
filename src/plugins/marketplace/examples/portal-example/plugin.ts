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
 * | the only fields that leave the organization | `portal.fields` — `internal` below never does |
 * | a page of your own in the portal | `portalView({ collection, surface: 'detail' }, viewKey)` |
 * | what that page can read | `@microteia/portal` — never `@microteia/data` |
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
 */
const ORDER_FIELDS: TemplateField[] = [
  { key: 'item', label: message('field.item'), type: 'text', required: true, order: 0 },
  { key: 'quantity', label: message('field.quantity'), type: 'number', required: false, order: 1 },
  { key: 'notes', label: message('field.notes'), type: 'textarea', required: false, order: 2 },
  { key: 'client', label: message('field.client'), type: 'reference', required: true, order: 3, refEntity: 'portalExampleClient' },
  { key: 'internal', label: message('field.internal'), type: 'textarea', required: false, order: 4 },
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
    create: { fields: ['item', 'quantity', 'notes'] },
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
    version: '1.0.0',
    kernel: '^2.53.0',
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
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [CLIENT_SCREEN, ORDER_SCREEN],
  views: [
    { key: 'clientPortal', title: message('screen.client'), icon: 'team', source: CLIENT_PORTAL_SOURCE },
  ],
};
