import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Settings example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const SETTINGS_NAMESPACE = 'com.microteia.settings-example';

export const SETTINGS_MESSAGES: Record<string, string> = {
  'package.name': 'Configuration, by example',
  'package.category': 'Configuration',
  'package.description':
    'A settings section with every kind of property the platform edits — and the licence terms this package asks the office to accept.',
  'package.summary':
    'How an extension is configured without bringing a screen for it. The Settings page is a generic host: it knows no setting in particular, and if nothing is contributed it is empty by definition. This package declares one section with each kind of property the editor knows how to draw, in both scopes, and carries the terms it asks the office to accept before installing.',

  'section.title': 'Settings example',
  'section.description': 'One of each kind of property, so the editor can be read rather than guessed.',

  'prop.enabled': 'Enabled',
  'prop.enabled.description': 'A switch. Both scopes, so a person may differ from the office default.',
  'prop.batch': 'Batch size',
  'prop.batch.description': 'A number with bounds. Office-wide only — it is about the installation, not about a person.',
  'prop.label': 'Report heading',
  'prop.label.description': 'Free text.',
  'prop.mode': 'Mode',
  'prop.mode.description': 'A closed list of choices.',
  'prop.mode.strict': 'Strict',
  'prop.mode.lenient': 'Lenient',
  'prop.stages': 'Stages to show',
  'prop.stages.description':
    'Several options from a list the office owns. The value stored is each option key — the same a record stores.',
  'prop.owner': 'Default contact',
  'prop.owner.description': 'One record of a screen. The value stored is the record ID — the same a reference field stores.',
  'lookup.stages': 'Example stages',
  'stage.open': 'Open',
  'stage.waiting': 'Waiting',
  'stage.done': 'Done',
  'screen.contact': 'Example contact',
  'screen.contact.plural': 'Example contacts',
  'field.name': 'Name',
  'field.email': 'E-mail',
  'prop.senders': 'Allowed senders',
  'prop.senders.description':
    'A list of texts, validated one item at a time. It exists so an extension that needs "several addresses" does not have to ask for a JSON blob.',
  'prop.senders.placeholder': 'someone@example.com',
  'prop.extra': 'Advanced',
  'prop.extra.description': 'Anything the vocabulary above cannot say — the escape hatch, and the last resort.',

  'licence.heading': 'Terms of the Settings example',
  'licence.body':
    'This example is provided as reading material, with no warranty of any kind. It stores no data of its own and sends nothing anywhere.\n\nTerms declared by an extension are ADDED to the ones Microteia already asks for — they never replace them.',
};

export const settingsMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: SETTINGS_NAMESPACE,
    messages: SETTINGS_MESSAGES,
  });
