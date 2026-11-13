import { DEFAULT_LOCALE, messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **The AI Assistant catalog, in the source language.** The namespace is the PLUGIN ID, so a third
 * party can translate what it does not own.
 */
export const ASSISTANT_NAMESPACE = 'com.microteia.assistant';

export const ASSISTANT_MESSAGES: Record<string, string> = {
  'package.name': 'AI Assistant',
  'package.category': 'Productivity',
  'package.description':
    'A chat pinned to the side of the workspace that answers questions and works on this office data, with the permissions of whoever is asking.',
  'package.summary':
    'Adds an AI assistant to the side of the workspace. Ask in plain language and it searches records, runs reports and, if the office allows, registers and changes data — always with the permissions of the person asking, never more. It uses the AI connection the office already configured.',

  'overview.body':
    '**AI Assistant** puts a conversation with the office AI connection one shortcut away, beside whatever '
    + 'you are working on.\n\n'
    + '- It **uses the AI connection the office already has** — OpenAI, Anthropic, Google, Mistral or Cohere. '
    + 'Nothing else to configure.\n'
    + '- It acts with the **permissions of the person asking**: it sees what they see and changes only what '
    + 'they could change.\n'
    + '- **Changes wait for your approval** by default. The office can let them run directly, or turn the '
    + 'assistant into a read-only one.\n'
    + '- Answers arrive **as they are written**, and long conversations are **summarized automatically** to '
    + 'keep the cost under control.\n'
    + '- Each person has their **own conversations**; nobody else can read them.',
  'overview.connection': 'AI connection',
  'overview.connection.value': 'The default AI connection of the office',
  'overview.limit': 'Limit',
  'overview.limit.value': 'The permissions of the person asking',
  'overview.changes': 'Changes to data',
  'overview.changes.value': 'Approved one by one, run directly, or not allowed — the office decides',

  'permission.use': 'Use the AI assistant',
  'permission.use.description': 'Open the assistant and talk to it. What it can do is still limited by the other permissions of the person.',

  'settings.section.title': 'AI assistant',
  'settings.section.description': 'How the assistant behaves in this office.',
  'settings.write-mode': 'Changes to data',
  'settings.write-mode.description':
    'What happens when the assistant wants to create, change or delete something, or run an automation.',
  'settings.write-mode.confirm': 'Ask for approval each time',
  'settings.write-mode.auto': 'Run directly',
  'settings.write-mode.off': 'Not allowed — read only',
  'settings.context-tokens': 'Conversation size before summarizing',
  'settings.context-tokens.description':
    'In tokens. When a conversation gets close to this size, its earlier part is summarized before the next question. Larger keeps more detail and costs more per question.',
};

export const assistantMessagesContribution = (): Contribution =>
  messageBundleContribution({ locale: DEFAULT_LOCALE, namespace: ASSISTANT_NAMESPACE, messages: ASSISTANT_MESSAGES });
