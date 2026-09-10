import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Gestures example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const COMMAND_NAMESPACE = 'com.microteia.command-example';

export const COMMAND_MESSAGES: Record<string, string> = {
  'package.name': 'Gestures, by example',
  'package.category': 'Interface',
  'package.description':
    'A line in the user menu, declared — and a command palette entry and an @ mention, registered at load time because neither can be written as data.',
  'package.summary':
    'The two ways an extension adds a gesture, and why there are two. A menu item is a fixed line and fits in a declaration. A command palette entry and an @ mention have to SEARCH as the person types, so no declaration can express them: they are registered by `startup`, the function that runs when the extension loads and returns its own teardown.',

  'screen.note': 'Note',
  'screen.note.plural': 'Notes',
  'field.title': 'Title',
  'field.title.placeholder': 'What this note is about',
  'field.note': 'Note',

  'menu.guide': 'About gestures',
  'page.guide': 'About gestures',

  'command.group': 'Gestures example',
  'command.guide': 'Open the gestures guide',

  'mention.label': 'Note',
  'mention.description': 'Link a note into the text.',

  'guide.heading': 'Gestures, by example',
  'guide.body':
    'Type **⌘K** and search for "gestures" — this page is one of the results, and every note you create is another. Type **@note** in any rich text field and the same records are offered there.\n\nNeither of those is declared anywhere. They cannot be: both have to answer a query that does not exist until somebody types it, and a manifest is data. They are registered by `startup`, which runs when this extension loads.\n\nThe line in the user menu, by contrast, is a fixed row — so it IS declared, and no code is involved.',
  'guide.declared': 'Declared',
  'guide.declared.value': 'The user menu line',
  'guide.registered': 'Registered at load time',
  'guide.registered.value': 'The palette entry and the @ mention',
};

export const commandMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: COMMAND_NAMESPACE,
    messages: COMMAND_MESSAGES,
  });
