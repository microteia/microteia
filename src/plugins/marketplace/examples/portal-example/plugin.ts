import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
  WorkflowModuleTemplate,
} from '../../../../domain/entities/MarketplacePlugin';
import { portalPageSpec, portalView, portalWidgetSpec } from '../../../contributionBuilders';
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
 * | a card on the portal home with NO code | `portalWidgetSpec({ key, title }, spec)` — `records` and `count` |
 * | a page of text in the portal menu with NO code | `portalPageSpec({ key, title, icon }, spec)` — a `markdown` node |
 * | what those can read | `@microteia/portal` — never `@microteia/data` |
 * | a screen over a collection named apart from its key | `dataCollection` — links point at the COLLECTION |
 * | telling the guests something happened | a `notify` step with `portalGuests` — never members in the same step |
 * | the documents the guest sees | `portal.documents` — and only the SHARED ones, shared by hand or by `share-documents` |
 * | the invitation follows a record | `portal.invites: { automation: true }` + the `portal-invite` / `portal-revoke` steps |
 * | the guest must PROVE who they are | `requiredClaim*` on `portal-invite` — see the note on `contactAccess` below |
 *
 * Guests are invited to a Client — by the organization, in Settings > Portal, or by a workflow when a
 * Contact of that client gets portal access. Each one then sees that client and its orders — nothing
 * else in the organization, not even that other clients exist.
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
  portal: {
    subject: 'self',
    fields: ['name', 'city'],
    // Automations may invite guests to a client — see `wf-contact-access`. Only the 'self' screen takes it.
    invites: { automation: true },
  },
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
  { key: 'confirmed', label: message('field.confirmed'), type: 'checkbox', required: false, order: 7 },
];

const ORDER_SCREEN: ScreenModuleTemplate = {
  key: 'portalExampleOrder',
  sourceId: 'microteia:portal-example:order',
  sourceRev: 2,
  titleSingular: message('screen.order'),
  titlePlural: message('screen.order.plural'),
  icon: 'shoppingBag',
  fields: ORDER_FIELDS,
  titleFieldKey: 'item',
  eventPrefix: 'portalExampleOrder',
  hasDocuments: true,
  portal: {
    subject: { field: 'client' },
    fields: ['item', 'quantity', 'urgency', 'notes'],
    // The guest sees the order's documents — only the ones the organization SHARED. See `wf-order-confirmed`.
    documents: true,
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

/**
 * The people of a client. A Contact is an office record — it is not in the portal — and checking
 * `portalAccess` is what lets that person in: the invitation follows the record the organization keeps,
 * instead of somebody typing the e-mail again in Settings > Portal.
 */
const CONTACT_FIELDS: TemplateField[] = [
  { key: 'name', label: message('field.name'), type: 'text', required: true, order: 0 },
  { key: 'email', label: message('field.email'), type: 'text', required: true, order: 1 },
  { key: 'client', label: message('field.client'), type: 'reference', required: true, order: 2, refEntity: 'portalExampleClient' },
  { key: 'portalAccess', label: message('field.portalAccess'), type: 'checkbox', required: false, order: 3 },
];

const CONTACT_SCREEN: ScreenModuleTemplate = {
  key: 'portalExampleContact',
  sourceId: 'microteia:portal-example:contact',
  sourceRev: 1,
  titleSingular: message('screen.contact'),
  titlePlural: message('screen.contact.plural'),
  icon: 'contacts',
  fields: CONTACT_FIELDS,
  titleFieldKey: 'name',
  parentEntity: 'portalExampleClient',
  parentFieldKey: 'client',
  parentRelation: 'owned',
  eventPrefix: 'portalExampleContact',
};

/**
 * Telling the client. A `notify` step with `portalGuests` reaches the people OUTSIDE the organization
 * who can see the record — here, the new Visit, which reaches them through its Site and Client. Nobody
 * is named: the guests are whoever is invited to that client WHEN the step runs, so a revoked invite
 * stops receiving at once, and an office-only record (hidden by `visibleWhen`) tells nobody.
 *
 * The same step never notifies members too: the text is written for someone outside. It goes by e-mail
 * and to the portal bell, in the language of the invite, and the link opens the visit IN THE PORTAL.
 * `toAudit` is off because every delivery to guests already leaves its own entry in the Audit trail.
 * To announce a different record than the one that fired — the Site of a visit —, add
 * `portalRecord: { kind: 'Event', path: 'site' }`.
 */
const VISIT_SCHEDULED: WorkflowModuleTemplate = {
  templateId: 'wf-visit-scheduled',
  name: message('workflow.visit-scheduled'),
  description: message('workflow.visit-scheduled.description'),
  eventName: 'portalExampleVisit.saved',
  version: 1,
  condition: {
    kind: 'FieldComparison',
    fieldPath: 'event.payload.changeType',
    operator: '==',
    value: 'created',
    valueType: 'literal',
  },
  steps: [{
    id: 'tellClient',
    stepDefinitionId: 'notify',
    type: 'Action',
    order: 0,
    enabled: true,
    configuration: {
      title: { kind: 'Literal', value: message('notify.visit.title') },
      message: { kind: 'Literal', value: message('notify.visit.message') },
      portalGuests: { kind: 'Literal', value: true },
      toEmail: { kind: 'Literal', value: true },
      toInApp: { kind: 'Literal', value: true },
      toAudit: { kind: 'Literal', value: false },
    },
  }],
};

/**
 * Releasing the documents at the right moment. What the organization attaches to an order stays
 * inside while it works on it; checking `confirmed` (an office-only field) shares every document of
 * the order with the client's guests at once. `share-documents` writes the same mark as the Documents
 * tab, so who sees it is still the portal's rule — the guests of that client, and only while the
 * order is not office-only. It is idempotent: saving the confirmed order again changes nothing, and
 * every change is in the Audit trail with who made it.
 *
 * To share a document the flow GENERATES, set `portalShared: true` on `render-document` instead.
 */
const ORDER_CONFIRMED: WorkflowModuleTemplate = {
  templateId: 'wf-order-confirmed',
  name: message('workflow.order-confirmed'),
  description: message('workflow.order-confirmed.description'),
  eventName: 'portalExampleOrder.saved',
  version: 1,
  condition: {
    kind: 'FieldComparison',
    fieldPath: 'event.payload.confirmed',
    operator: '==',
    value: true,
    valueType: 'literal',
  },
  steps: [{
    id: 'releaseDocuments',
    stepDefinitionId: 'share-documents',
    type: 'Action',
    order: 0,
    enabled: true,
    configuration: {
      collection: { kind: 'Literal', value: 'portalExampleOrder' },
      recordId: { kind: 'Event', path: 'id' },
      shared: { kind: 'Literal', value: true },
    },
  }],
};

const contactAccess = (id: string, stepDefinitionId: 'portal-invite' | 'portal-revoke') => ({
  id,
  stepDefinitionId,
  type: 'Action' as const,
  order: 0,
  enabled: true,
  configuration: {
    subjectCollection: { kind: 'Literal' as const, value: 'portalExampleClient' },
    subjectRecordId: { kind: 'Event' as const, path: 'client' },
    email: { kind: 'Event' as const, path: 'email' },
    ...(stepDefinitionId === 'portal-invite' ? { displayName: { kind: 'Event' as const, path: 'name' } } : {}),
  },
});

/**
 * The invitation follows the Contact. `portal-invite` makes the same invitation as Settings > Portal,
 * and only because the Client screen declares `invites: { automation: true }`. Running it on every save
 * is safe: the same e-mail and client twice is one invitation, and the welcome e-mail goes out once.
 *
 * Unchecking `portalAccess` — or deleting the Contact — takes the access back at once. A real
 * registration would also check the e-mail and cap the contacts per client in the record itself, so
 * that only a validated record ever reaches the step.
 *
 * Signing in by e-mail link only proves the guest reads that mailbox. When what the guest does has to
 * be attributable to a PERSON — an acknowledgement, an acceptance —, the organization adds an identity
 * provider in Settings > Portal > Sign-in and the invitation requires an attribute that provider
 * verifies. Here that would be three more inputs, fed by a field of the Contact:
 *
 *   requiredClaimName: { kind: 'Literal', value: 'nationalId' },
 *   requiredClaimValue: { kind: 'Event', path: 'documentNumber' },
 *   requiredClaimNormalize: { kind: 'Literal', value: 'digits' },
 *
 * The example does not do it because it would stop working out of the box: every invitation would
 * fail until the organization configured a provider that verifies `nationalId`. With them, no account
 * is opened for the e-mail; only a sign-in proving the same value gets in, and every record the guest
 * saves carries `portalVerified` (provider, claim, assurance level). It requires `kernel: "^2.74.0"`.
 */
const CONTACT_ACCESS_GRANTED: WorkflowModuleTemplate = {
  templateId: 'wf-contact-access',
  name: message('workflow.contact-access'),
  description: message('workflow.contact-access.description'),
  eventName: 'portalExampleContact.saved',
  version: 1,
  condition: {
    kind: 'FieldComparison',
    fieldPath: 'event.payload.portalAccess',
    operator: '==',
    value: true,
    valueType: 'literal',
  },
  steps: [contactAccess('inviteContact', 'portal-invite')],
};

const CONTACT_ACCESS_REMOVED: WorkflowModuleTemplate = {
  templateId: 'wf-contact-access-removed',
  name: message('workflow.contact-access-removed'),
  description: message('workflow.contact-access-removed.description'),
  eventName: 'portalExampleContact.saved',
  version: 1,
  condition: {
    kind: 'FieldComparison',
    fieldPath: 'event.payload.portalAccess',
    operator: '!=',
    value: true,
    valueType: 'literal',
  },
  steps: [contactAccess('revokeContact', 'portal-revoke')],
};

const CONTACT_DELETED: WorkflowModuleTemplate = {
  templateId: 'wf-contact-deleted',
  name: message('workflow.contact-deleted'),
  description: message('workflow.contact-deleted.description'),
  eventName: 'portalExampleContact.deleted',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [contactAccess('revokeDeletedContact', 'portal-revoke')],
};

const WORKFLOWS: WorkflowModuleTemplate[] = [
  VISIT_SCHEDULED, ORDER_CONFIRMED, CONTACT_ACCESS_GRANTED, CONTACT_ACCESS_REMOVED, CONTACT_DELETED,
];

const CLIENT_PORTAL_SOURCE = mergeViewSources({
  'ClientPortal.view.tsx': CLIENT_PORTAL_VIEW,
  'ClientPortal.viewmodel.tsx': CLIENT_PORTAL_VIEWMODEL,
  'ClientPortal.styles.tsx': CLIENT_PORTAL_STYLES,
});

export const portalExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.portal-example',
    version: '1.11.0',
    kernel: '^2.92.0',
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

      /**
       * A card on the portal home with NO code: it reaches every guest even where the organization does
       * not trust this package's code. `records` lists what passes `when`; `count` counts it. Both read
       * only what the guest already has — the EXPOSED fields of a screen in the portal —, and `when` is
       * evaluated in the guest's browser, in the organization's time zone (`today()` works).
       *
       * Inside the card of a `records` node the nodes answer about THAT record, as in `portal.template`,
       * and a `count` with `scope: 'record'` counts its children only — here, the orders of each client a
       * guest of two clients sees. Without `empty`, a list with nothing to show disappears, and so does
       * the card when nothing is left.
       */
      portalWidgetSpec({ key: 'attention', title: message('portal.widget.attention'), order: 20 }, {
        body: [
          {
            type: 'row',
            gap: 'sm',
            children: [
              { type: 'count', collection: 'portalExampleOrder', when: 'urgency == "urgent"', tone: 'danger' },
              { type: 'text', text: message('portal.widget.attention.caption'), tone: 'muted' },
            ],
          },
          {
            type: 'records',
            collection: 'portalExampleOrder',
            when: 'urgency == "urgent" or urgency == "soon"',
            orderBy: { field: 'quantity', direction: 'desc' },
            limit: 3,
            empty: message('portal.widget.attention.empty'),
            card: [{
              type: 'row',
              justify: 'between',
              children: [{ type: 'title' }, { type: 'field', field: 'urgency', variant: 'badge' }],
            }],
          },
          {
            type: 'section',
            title: message('portal.widget.attention.clients'),
            children: [{
              type: 'records',
              collection: 'portalExampleClient',
              card: [{
                type: 'row',
                justify: 'between',
                children: [{ type: 'title' }, { type: 'count', collection: 'portalExampleOrder', scope: 'record', size: 'md' }],
              }],
            }],
          },
        ],
      }),

      /**
       * A page in the portal MENU with NO code — the help a client reads before calling the organization.
       * `markdown` takes a message REFERENCE, never the text itself: the text travels in this package's
       * bundles (one per language), so it translates like any other message.
       *
       * The reference may be of ANOTHER namespace: a page declared here can show a text that a separate,
       * text-only package brings — the terms of one organization, the law of one city. When no installed
       * package has the key in the guest's language (or in English), the page stays out of the menu
       * instead of showing the raw reference.
       *
       * The organization can replace the text in Settings > Portal texts (`portal.content`), per language;
       * its text wins over this one until it brings the package text back. The portal draws titles, lists,
       * tables and links — no HTML and no images.
       */
      portalPageSpec({ key: 'help', title: message('portal.page.help'), icon: 'question', order: 30 }, {
        body: [{ type: 'markdown', content: message('portal.help') }],
      }),
    ],
  },
  summary: message('package.summary'),
  workflows: WORKFLOWS,
  screens: [CLIENT_SCREEN, ORDER_SCREEN, SITE_SCREEN, VISIT_SCREEN, CONTACT_SCREEN],
  lookups: [URGENCIES],
  views: [
    { key: 'clientPortal', title: message('screen.client'), icon: 'team', source: CLIENT_PORTAL_SOURCE },
    { key: 'openOrdersWidget', title: message('portal.widget.orders'), icon: 'shoppingBag', source: OPEN_ORDERS_WIDGET },
  ],
};
