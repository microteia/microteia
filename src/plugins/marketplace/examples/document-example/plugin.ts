import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
  WorkflowModuleTemplate,
} from '../../../../domain/entities/MarketplacePlugin';
import { documentTemplateContribution } from '../../../../domain/schema/document';
import { documentMessagesContribution } from './documentMessages';
import { documentPtBrContribution } from './documentMessagesPtBr';

/**
 * **Documents, by example** — two templates over two small screens.
 *
 * A document template is DATA: a `document.template` contribution, with no code and no trust gesture.
 * The organization generates it from the record (the "Generate document" gesture) or from an automation
 * (the `render-document` step), and the file lands in the record's Documents tab. If the organization
 * writes its own template under the same `key`, theirs wins — and deleting theirs brings this one back.
 *
 * The second template reads DATA instead of a record (`source: 'payload'`), and the automation below
 * generates it and attaches it to the agreement the data points to (`belongsTo`).
 *
 * The screens are deliberately anonymous — an "agreement" with installments — because a document
 * example that also taught a business would teach the business instead.
 */

const message = (key: string): string => `@com.microteia.document-example/${key}`;

const AGREEMENT_SOURCE_ID = 'microteia:document-example:agreement';
const INSTALLMENT_SOURCE_ID = 'microteia:document-example:installment';

const AGREEMENT_FIELDS: TemplateField[] = [
  { key: 'party', label: message('field.party'), type: 'text', required: true, order: 0 },
  { key: 'signedOn', label: message('field.signedOn'), type: 'date', required: false, order: 1 },
  { key: 'total', label: message('field.total'), type: 'currency', required: false, order: 2 },
];

/** `hasDocuments` is what makes the screen a place a document can be attached to. Without it there is no tab. */
const AGREEMENT_SCREEN: ScreenModuleTemplate = {
  key: 'docAgreement',
  sourceId: AGREEMENT_SOURCE_ID,
  sourceRev: 1,
  titleSingular: message('screen.agreement'),
  titlePlural: message('screen.agreement.plural'),
  icon: 'fileText',
  fields: AGREEMENT_FIELDS,
  titleFieldKey: 'party',
  hasDocuments: true,
  eventPrefix: 'docAgreement',
};

/** `agreement` is the link the template's list follows: `via` names it. */
const INSTALLMENT_FIELDS: TemplateField[] = [
  { key: 'agreement', label: message('field.agreement'), type: 'reference', required: true, order: 0, refEntity: 'docAgreement' },
  { key: 'dueDate', label: message('field.dueDate'), type: 'date', required: true, order: 1 },
  { key: 'dueTime', label: message('field.dueTime'), type: 'time', required: false, order: 2 },
  { key: 'amount', label: message('field.amount'), type: 'currency', required: true, order: 3 },
  { key: 'paid', label: message('field.paid'), type: 'checkbox', required: false, order: 4 },
];

const INSTALLMENT_SCREEN: ScreenModuleTemplate = {
  key: 'docInstallment',
  sourceId: INSTALLMENT_SOURCE_ID,
  sourceRev: 2,
  titleSingular: message('screen.installment'),
  titlePlural: message('screen.installment.plural'),
  icon: 'bank',
  fields: INSTALLMENT_FIELDS,
  titleFieldKey: 'dueDate',
  parentEntity: 'docAgreement',
  parentFieldKey: 'agreement',
  parentRelation: 'owned',
  eventPrefix: 'docInstallment',
};

/**
 * The template text. What sits between `{{ }}` is a FIELD EXPRESSION — the same paths and functions as a
 * computed field — and the grammar adds only the two blocks an expression cannot say: repeat
 * (`{{#each}}`) and include when (`{{#if}}`). Inside the loop the installment's fields are at the root,
 * the agreement's are still readable, and `index` counts from 1.
 *
 * A value merged into Markdown is escaped: a party called "A*B" stays "A*B", it does not open bold.
 */
const PAYMENT_PLAN = `# Payment plan

**Party:** {{party}}
**Signed on:** {{formatDate(signedOn, "DD/MM/YYYY")}}

| # | Due date | Amount | |
|---|---|--:|---|
{{#each installments}}| {{index}} | {{formatDate(dueDate, "DD/MM/YYYY")}}{{#if dueTime}} {{dueTime}}{{/if}} | {{formatMoney(amount)}} | {{#if paid}}paid{{/if}} |
{{/each}}

**Total:** {{formatMoney(total)}}

<!-- pagebreak -->

Generated on {{formatDate(today(), "DD/MM/YYYY")}}.
`;

/**
 * A template of DATA: no screen, the paths start at the object whoever generates it sends. `agreement`
 * is a single-record reference, hydrated like a reference field — `{{agreement.party}}` reads the
 * agreement. That same reference is what lets the file have a home: the step names it in `belongsTo`.
 */
const INSTALLMENT_RECEIPT = `# Receipt

Received from **{{agreement.party}}** the amount of **{{formatMoney(amount)}}** on {{formatDate(paidOn, "DD/MM/YYYY")}}, for the agreement signed on {{formatDate(agreement.signedOn, "DD/MM/YYYY")}}.
{{#if note}}

{{note}}
{{/if}}
`;

const WORKFLOWS: WorkflowModuleTemplate[] = [
  /**
   * A CALLED flow: its `parameters` are what the caller sends, and the step hands them to the template
   * one by one (`param.<key>`), as "Call Workflow" does.
   *
   * `belongsTo: 'agreement'` names the template parameter whose record OWNS the document. With
   * `destination: 'record'` the file is attached to that agreement's Documents tab; with Downloads, the
   * agreement would be remembered as the file's origin and suggested when someone attaches it later.
   * The template itself has no screen: where the file goes is decided by whoever generates it.
   */
  {
    templateId: 'wf-installment-receipt',
    name: message('workflow.receipt'),
    description: message('workflow.receipt.description'),
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    parameters: [
      { key: 'agreementId', label: message('field.agreement'), type: 'EntityReference', entityType: 'docAgreement', required: true },
      { key: 'amount', label: message('field.amount'), type: 'Number', required: true },
      { key: 'paidOn', label: message('field.paidOn'), type: 'Date', required: true },
      { key: 'note', label: message('field.note'), type: 'String' },
    ],
    steps: [
      {
        id: 'renderReceipt',
        stepDefinitionId: 'render-document',
        type: 'Action',
        order: 0,
        enabled: true,
        configuration: {
          templateKey: { kind: 'Literal', value: 'installment-receipt' },
          'param.agreement': { kind: 'Event', path: 'agreementId' },
          'param.amount': { kind: 'Event', path: 'amount' },
          'param.paidOn': { kind: 'Event', path: 'paidOn' },
          'param.note': { kind: 'Event', path: 'note' },
          belongsTo: { kind: 'Literal', value: 'agreement' },
          destination: { kind: 'Literal', value: 'record' },
          output: { kind: 'Literal', value: 'pdf' },
        },
      },
    ],
  },
];

export const documentExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.document-example',
    version: '1.2.0',
    kernel: '^2.58.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    contributes: [
      documentMessagesContribution(),
      documentPtBrContribution(),
      /**
       * The screens are addressed by `sourceId`, never by key: the installed key can gain a suffix when
       * the name is taken in the organization (`docAgreement_2`), the `sourceId` never changes.
       */
      documentTemplateContribution({
        key: 'payment-plan',
        title: message('template.payment-plan'),
        collection: 'docAgreement',
        screenSourceId: AGREEMENT_SOURCE_ID,
        format: 'markdown',
        body: PAYMENT_PLAN,
        fileName: 'Payment plan - {{party}}',
        datasets: [{
          name: 'installments',
          from: 'docInstallment',
          fromSourceId: INSTALLMENT_SOURCE_ID,
          via: 'agreement',
          /**
           * Day and time live in two fields, so the order is a LIST of keys: the first decides, the
           * next breaks ties. Ordering by `dueDate` alone would leave two installments due the same
           * day in whatever order the database returned them — and with `limit`, that order decides
           * which ones make it in. A list of keys needs kernel 2.58.0, hence the `kernel` above.
           */
          orderBy: [{ path: 'dueDate', dir: 'asc' }, { path: 'dueTime', dir: 'asc' }],
        }],
      }),
      documentTemplateContribution({
        key: 'installment-receipt',
        title: message('template.installment-receipt'),
        source: 'payload',
        collection: '',
        format: 'markdown',
        body: INSTALLMENT_RECEIPT,
        fileName: 'Receipt - {{agreement.party}}',
        parameters: [
          { key: 'agreement', label: message('field.agreement'), type: 'EntityReference', entityType: 'docAgreement', required: true },
          { key: 'amount', label: message('field.amount'), type: 'Number', required: true },
          { key: 'paidOn', label: message('field.paidOn'), type: 'Date', required: true },
          { key: 'note', label: message('field.note'), type: 'String' },
        ],
        sample: { agreement: '', amount: 150, paidOn: '2026-10-18', note: '' },
      }),
    ],
  },
  summary: message('package.summary'),
  workflows: WORKFLOWS,
  screens: [AGREEMENT_SCREEN, INSTALLMENT_SCREEN],
};
