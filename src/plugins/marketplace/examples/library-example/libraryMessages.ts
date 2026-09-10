import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Library example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const LIBRARY_NAMESPACE = 'com.microteia.library-example';

export const LIBRARY_MESSAGES: Record<string, string> = {
  'package.name': 'A library extension, by example',
  'package.category': 'Cooperation',
  'package.description':
    'An extension with no interface at all: it publishes an extension point, exports a script and a flow for others to point at, and offers a capability.',
  'package.summary':
    'The half of cooperation that PUBLISHES. It installs no screen and no page — everything it brings exists for another extension to use: an extension point of its own that others fill, a sandbox script and a callable flow named in `exports`, a permission others may add to, and a capability it provides. Read it next to the consumer example, which is the other half.',

  'point.formatter.title': 'Code formatter',
  'point.formatter.description':
    'Register a way of formatting a code. Whoever fills this point is offered wherever the library formats one.',

  'script.normalize': 'Normalize a code',
  'script.normalize.description':
    'Trims, upper-cases and joins with dashes. Exported, so another extension may point a step at it.',
  'script.normalize.in.code': 'Code to normalize',
  'script.normalize.out.code': 'The normalized code',
  'script.normalize.out.changed': 'Whether it differed from what was given',

  'workflow.announce': 'Announce a code',
  'workflow.announce.description':
    'A callable flow: receives a code and a reason, and writes them to the audit trail. Exported, so another extension may call it.',
  'workflow.announce.audit.title': 'Code announced',
  'parameter.code': 'Code',
  'parameter.reason': 'Reason',

  'resource.library': 'Code library',
  'permission.use': 'Use the code library',
  'permission.use.description':
    'Call what this library exports. Another extension may widen this permission with its own requirements.',
};

export const libraryMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: LIBRARY_NAMESPACE,
    messages: LIBRARY_MESSAGES,
  });
