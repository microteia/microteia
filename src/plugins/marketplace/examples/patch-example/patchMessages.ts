import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Patch example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const PATCH_NAMESPACE = 'com.microteia.patch-example';

export const PATCH_MESSAGES: Record<string, string> = {
  'package.name': 'Extending and migrating, by example',
  'package.category': 'Cooperation',
  'package.description':
    'Adds a field to a screen another extension owns, and carries the migration that fills in the records that were already there.',
  'package.summary':
    'The two things an extension does to data that is not new. It adds a field to a screen ANOTHER extension declared, without either of them being rewritten, and it carries a migration that runs once per office to fill a field that older records never had. The migration runs in the same sandbox a script does, and it never writes a collection name by hand.',

  'screen.note': 'Note',
  'screen.note.plural': 'Notes',
  'field.title': 'Title',
  'field.title.placeholder': 'What this note is about',
  'field.code': 'Code',
  'field.body': 'Body',

  'patch.note': 'Related note',

  'migration.fill-code': 'Fill in the code of older notes',
};

export const patchMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: PATCH_NAMESPACE,
    messages: PATCH_MESSAGES,
  });
