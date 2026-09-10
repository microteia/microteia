import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Sign-in example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const AUTH_NAMESPACE = 'com.microteia.auth-example';

export const AUTH_MESSAGES: Record<string, string> = {
  'package.name': 'Signing in, by example',
  'package.category': 'Access',
  'package.description':
    'A corporate single sign-on and the house password form, both declared — plus a note in the footer of the sign-in screen.',
  'package.summary':
    'How an office adds its own way in. Single sign-on fits entirely in a declaration, because the project Firebase Auth already speaks OIDC and SAML — what was missing was a package saying WITH WHOM. The point accepts no implementation at all, and that is what makes it useful: accepting code would have made sign-in a first-party privilege, which is the opposite of what it needs to be.',

  'provider.sso': 'Sign in with Acme ID',
  'provider.password': 'Email and password',

  'slot.footer': 'Sign-in note',
  'slot.footer.description': 'A line under the sign-in form.',
  'footer.text': 'Trouble signing in? Talk to whoever administers this installation.',
};

export const authMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: AUTH_NAMESPACE,
    messages: AUTH_MESSAGES,
  });
