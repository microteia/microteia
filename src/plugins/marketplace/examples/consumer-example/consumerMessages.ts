import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Consumer example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const CONSUMER_NAMESPACE = 'com.microteia.consumer-example';

export const CONSUMER_MESSAGES: Record<string, string> = {
  'package.name': 'Using another extension, by example',
  'package.category': 'Cooperation',
  'package.description':
    'The other half of cooperation: it fills a point another extension opened, points a step at a script it does not own, widens a permission and asks for a capability.',
  'package.summary':
    'How one extension uses another without either of them importing anything. It fills the extension point the library example publishes, runs a flow whose step points at the library script by NAME rather than by id, adds its own requirement to a permission the library declared, and asks for the capability the library provides. Every one of the four is declared, and none of them makes this package execute the other one code.',

  'contribution.slug': 'Dashed slug',
  'contribution.slug.description': 'Formats a code as a lowercase dashed slug.',

  'workflow.tidy': 'Tidy a code',
  'workflow.tidy.description':
    'Runs the library script on a code, then calls the library flow to announce the result. Neither step names a local id.',
  'parameter.code': 'Code',

  'resource.consumer': 'Code tidying',
  'permission.tidy': 'Tidy codes',
  'permission.tidy.description': 'Run the tidy flow. Whoever uses the library needs this one too, because this package contributes into it.',
};

export const consumerMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: CONSUMER_NAMESPACE,
    messages: CONSUMER_MESSAGES,
  });
