import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Appearance example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const THEME_NAMESPACE = 'com.microteia.theme-example';

export const THEME_MESSAGES: Record<string, string> = {
  'package.name': 'Appearance, by example',
  'package.category': 'Appearance',
  'package.description':
    'A palette that extends a base, and the colour tokens of a vocabulary this package owns — the two halves of appearance, and why they are two.',
  'package.summary':
    'How an extension answers for how things look. It brings a small palette that declares only what differs from the base it extends, and — the half nobody demonstrates — the colour tokens for its OWN vocabulary. A token has one owner, and the owner answers for it in every theme; a palette that carried somebody else vocabulary would be opining on a word that is not its own, and would need to win an install-order race to do it.',

  'screen.item': 'Item',
  'screen.item.plural': 'Items',
  'field.title': 'Title',
  'field.stage': 'Stage',
  'field.stage.draft': 'Draft',
  'field.stage.review': 'In review',
  'field.stage.settled': 'Settled',

  'theme.name': 'Parchment',
};

export const themeMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: THEME_NAMESPACE,
    messages: THEME_MESSAGES,
  });
