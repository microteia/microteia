import { DEFAULT_LOCALE, messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **The AI Agent Access catalog, in the source language.**
 *
 * Letting an AI agent work on the office data is not a legal, sales or accounting concept: any office
 * that keeps records has someone who would rather ask than click. That is what makes this extension
 * GENERIC — and a generic extension cannot ship with its text nailed to a single language.
 *
 * The namespace is the PLUGIN ID, never the translator's, so a third party can translate what it does
 * not own.
 */
export const AGENT_NAMESPACE = 'com.microteia.agent';

export const AGENT_MESSAGES: Record<string, string> = {
  'package.name': 'AI Agent Access',
  'package.category': 'Productivity',
  'package.description':
    'Lets an AI agent read and change this office data, with the permissions each person releases and nothing more.',
  'package.summary':
    'Turns on a connection an AI agent can use to work inside this office — search records, register them, change them, run a report or an automation — without any access to the database. Each person issues their own access, chooses which permissions it may use and for how long, and revokes it at any time. An access can never do more than the person who issued it.',

  'overview.body':
    '**AI Agent Access** lets an AI assistant work inside this office, on the office own data, '
    + 'without any access to the database.\n\n'
    + '- Each person gets **their own access**, and it is always **theirs**: it carries their name, '
    + 'their permissions and nobody else\'s.\n'
    + '- The access declares **which permissions it may use** and, if you want, **when it expires**.\n'
    + '- An access can **never do more than the person who holds it**: lose a role, and every access '
    + 'of yours narrows on the next call.\n'
    + '- Any access can be **revoked at any time**, and it stops working immediately.\n\n'
    + 'There are two ways to connect, and the office does not have to choose one — both work at the '
    + 'same time, and both end up in the same list.\n\n'
    + '**Signing in.** The assistant asks only for the connection address. The person signs in with '
    + 'their own account, picks which permissions to allow, and that is it — no token is ever copied '
    + 'or pasted. Clients that can sign in, Claude on the web among them, should use this: it is what '
    + 'keeps one person\'s assistant from acting as another person.\n\n'
    + '**A token.** For a client that cannot sign in, an access issued in Organization → AI agents '
    + 'produces a token to paste into it. The token is shown once and stored only as a fingerprint, '
    + 'so a lost one is replaced, never recovered.\n\n'
    + 'Once connected, the assistant discovers the screens this office has and can search records, '
    + 'register them, change them, delete them, run a report and start an automation — each of those '
    + 'only when the access releases it.',
  'overview.connection': 'Connection',
  'overview.connection.value': 'MCP over HTTP — nothing to install on the machine',
  'overview.sign-in': 'Signing in',
  'overview.sign-in.value': 'OAuth 2.1, each person with their own account — no token to copy',
  'overview.token': 'Or a token',
  'overview.token.value': 'An access token issued in the application, revocable, shown once',
  'overview.limit': 'Limit',
  'overview.limit.value': 'The permissions of the person who holds it, intersected with the ones the access declares',

  'settings.section.title': 'AI agent access',
  'settings.section.description': 'How accesses are issued in this office.',
  'settings.self-service': 'Every member can issue their own access',
  'settings.self-service.description':
    'On, anyone issues an access for themselves — which grants nothing new, since an access can never '
    + 'exceed the permissions the person already has. Off, issuing one requires the permission to '
    + 'manage AI agent access.',
};

export const agentMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: AGENT_NAMESPACE,
    messages: AGENT_MESSAGES,
  });
