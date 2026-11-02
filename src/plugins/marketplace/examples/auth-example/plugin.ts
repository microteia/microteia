import type { MarketplacePlugin } from '../../../../domain/entities/MarketplacePlugin';
import type { WidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import { LOGIN_SLOT_SURFACES } from '../../../../domain/schema/ui/uiExtensionPoints';
import { authProvider, surfaceSlotSpec } from '../../../contributionBuilders';
import { authMessagesContribution } from './authMessages';
import { authPtBrContribution } from './authMessagesPtBr';

/**
 * **Signing in, by example** — the point that accepts no implementation, and is useful because of it.
 *
 * A corporate single sign-on fits entirely in a declaration: the project's Firebase Auth already knows
 * how to speak OIDC and SAML, and what was missing was a package saying WITH WHOM. Accepting
 * `impl: code` here would have made signing in a first-party privilege — the exact opposite of what it
 * needs to be, since this is the integration every office adds without passing through us.
 *
 * **`password` is in the same list.** It is not an external provider; it is this house's own form,
 * declared — like `google` — by the kernel itself, so both are always offered. An extension cannot
 * withdraw them: `defaultEnabled: false` hides only a provider of the package that declares it. An
 * installation with mandatory single sign-on adds its provider BESIDE the form; hiding the form is not
 * possible yet.
 *
 * **Installing is not enough.** The screen that serves `/login` runs ABOVE any office: there is no
 * organization yet, so there is no installed-extensions document to read. A package that contributes
 * here has to be STAMPED on the installation — listed in `login.extensions` in `microteia.yaml`, which
 * `microteia deploy` writes out. It also loads UNTRUSTED there, so a code view of the same package
 * would not run; a declaration like this one is unaffected.
 *
 * Two consequences of running above the office, which from outside look like omissions:
 *
 * - **There is no configuring which ways in appear.** `/login` has no organization, so it has no
 *   configuration document. What was DECLARED is what there is, and `defaultEnabled: false` is the
 *   only switch available.
 * - **A login slot that required a permission is DISCARDED.** There is nobody to hold one, and the
 *   absence of context closes rather than opens.
 */

const message = (key: string): string => `@com.microteia.auth-example/${key}`;

const FOOTER: WidgetSpec = { type: 'text', text: message('footer.text'), muted: true };

export const authExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.auth-example',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    dependencies: { 'core.auth': '^1.0.0' },
    contributes: [
      authMessagesContribution(),
      authPtBrContribution(),

      /**
       * The corporate one. `providerId` is the id configured in the project's Firebase Auth console —
       * required for `oidc` and `saml`, ignored for the kinds whose id is fixed.
       *
       * `flow: 'redirect'` is not a preference. It is the only path that survives a blocked window —
       * a hardened corporate browser, an iframe, an embedded app — and it returns nothing rather than
       * a user, because the page is on its way out.
       *
       * The icon comes from the curated screen-icon set. For `oidc` and `saml` the brand belongs to
       * the office and we do not know it, so whoever declares picks from what there is.
       */
      authProvider({
        key: 'acme-sso',
        label: message('provider.sso'),
        kind: 'oidc',
        providerId: 'oidc.acme',
        flow: 'redirect',
        scopes: ['openid', 'email', 'profile'],
        icon: 'shieldCheck',
        order: 10,
      }),

      /**
       * The house form, declared like anything else. Leave this line out and it is gone — which is how
       * an installation makes single sign-on mandatory, without a setting anywhere.
       */
      authProvider({
        key: 'password',
        label: message('provider.password'),
        kind: 'password',
        order: 20,
      }),

      /**
       * `login.header` and `login.footer` are the two regions that exist before anyone has signed in.
       * No `requiredPermissions` here, and none is possible: a slot that asked for one would be
       * discarded, since there is no user to hold it.
       */
      surfaceSlotSpec(
        {
          surface: LOGIN_SLOT_SURFACES.footer,
          key: 'auth-example.note',
          title: message('slot.footer'),
          description: message('slot.footer.description'),
          order: 10,
        },
        FOOTER,
      ),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
};
