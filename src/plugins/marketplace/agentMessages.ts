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
