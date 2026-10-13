import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import { documentTemplateContribution } from '../../../../domain/schema/document';
import { documentMessagesContribution } from './documentMessages';
import { documentPtBrContribution } from './documentMessagesPtBr';

/**
 * **Documents, by example** — one template over two small screens.
 *
 * A document template is DATA: a `document.template` contribution, with no code and no trust gesture.
 * The organization generates it from the record (the "Generate document" gesture) or from an automation
 * (the `render-document` step), and the file lands in the record's Documents tab. If the organization
 * writes its own template under the same `key`, theirs wins — and deleting theirs brings this one back.
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
  { key: 'amount', label: message('field.amount'), type: 'currency', required: true, order: 2 },
  { key: 'paid', label: message('field.paid'), type: 'checkbox', required: false, order: 3 },
];

const INSTALLMENT_SCREEN: ScreenModuleTemplate = {
  key: 'docInstallment',
  sourceId: INSTALLMENT_SOURCE_ID,
  sourceRev: 1,
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
{{#each installments}}| {{index}} | {{formatDate(dueDate, "DD/MM/YYYY")}} | {{formatMoney(amount)}} | {{#if paid}}paid{{/if}} |
{{/each}}

**Total:** {{formatMoney(total)}}

<!-- pagebreak -->

Generated on {{formatDate(today(), "DD/MM/YYYY")}}.
`;

export const documentExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.document-example',
    version: '1.0.0',
    kernel: '^2.36.0',
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
          orderBy: 'dueDate',
        }],
      }),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [AGREEMENT_SCREEN, INSTALLMENT_SCREEN],
};
