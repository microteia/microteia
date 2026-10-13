import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/**
 * **The Documents example catalog, in the source language.** Every label a person reads is a key here.
 *
 * The TEMPLATE TEXT is not: a document says what it says in the language it was written in, the way a
 * contract does. What travels through the catalog is the name of the template — the words of the
 * interface around the document, not the document.
 */
export const DOCUMENT_NAMESPACE = 'com.microteia.document-example';

export const DOCUMENT_MESSAGES: Record<string, string> = {
  'package.name': 'Documents, by example',
  'package.category': 'Documents',
  'package.description':
    'A document template over two small screens: an agreement and its installments, generated as PDF or Word and attached to the agreement.',
  'package.summary':
    'What a document template can say, with no business in the way. It installs an agreement screen with the Documents tab, a screen of installments linked to it, and one template that reads fields, formats dates and money, repeats the installments in a table and includes a line only when a condition holds. Generate it from the agreement, or from an automation with the "Generate Document" step.',

  'screen.agreement': 'Agreement',
  'screen.agreement.plural': 'Agreements',
  'screen.installment': 'Installment',
  'screen.installment.plural': 'Installments',
  'field.party': 'Party',
  'field.signedOn': 'Signed on',
  'field.total': 'Total',
  'field.agreement': 'Agreement',
  'field.amount': 'Amount',
  'field.dueDate': 'Due date',
  'field.paid': 'Paid',

  'template.payment-plan': 'Payment plan',
};

export const documentMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: DOCUMENT_NAMESPACE,
    messages: DOCUMENT_MESSAGES,
  });
