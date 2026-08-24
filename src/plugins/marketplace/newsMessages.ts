import { DEFAULT_LOCALE, messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **The News catalog, in the source language.**
 *
 * A noticeboard is not a domain: every office has announcements to publish and people who have not
 * read them yet. That is why this extension ships in the source language with its own translation
 * alongside, instead of nailing one language into the manifest.
 *
 * Four keys that look like text and are NOT here, on purpose: the category names an office typed
 * itself. What is seeded on install (`General`, `Announcement`…) is a reference; what the office
 * renames afterwards is its own data and passes through `resolveLabel` untouched.
 *
 * `core.ui/action.save`, `action.cancel`, `action.delete` and `action.edit` are used as ABSOLUTE
 * keys from the views. Re-translating "Save" in every extension is how a product ends up with four
 * spellings of the same button.
 */
export const NEWS_NAMESPACE = 'com.microteia.news';

export const NEWS_MESSAGES: Record<string, string> = {
  'package.name': 'News',
  'package.description': 'The office noticeboard as an extension — with per-person unread marks, comments and tags.',
  'package.summary':
    'The office noticeboard: the announcement someone publishes, a badge in the menu with what YOU have not read yet, likes, save for later, tags, attached documents and the conversation in comments under each item.',

  'nav.news': 'News',
  'page.news': 'News',
  'page.news-read': 'News item',

  'screen.singular': 'News item',
  'screen.plural': 'News',
  'comment.singular': 'Comment',
  'comment.plural': 'Comments',

  'section.content': 'Content',

  'field.title': 'Title',
  'field.title.placeholder': 'Title of the news item...',
  'field.category': 'Category',
  'field.source-url': 'Source link',
  'field.source-url.placeholder': 'https://...',
  'field.summary': 'Summary',
  'field.summary.placeholder': 'Short summary shown in the list...',
  'field.content': 'Full content',
  'field.news': 'News item',
  'field.comment': 'Comment',

  'lookup.categories': 'News: Category',
  'category.general': 'General',
  'category.announcement': 'Announcement',
  'category.circular': 'Circular',
  'category.update': 'Update',
  'tags.list': 'News: Tags',

  'overview.body':
    'The **News** extension brings the office noticeboard: anyone publishes an announcement, with a summary, Markdown content, a category and a link to the source.\n\nThe menu item shows **how many items you have not read** — the number is yours, not the office\'s, and it goes down as soon as you open each one. The list opens on exactly those, and you can **save for later** whatever you want to read again.\n\nEvery item has **comments**, with likes, editing and an "(edited)" mark in plain sight. Whoever comments returns the item to everyone\'s inbox, so nobody misses the conversation.\n\nWhoever published can **edit and delete** what they published, without depending on an administrator — and the same goes for each comment.',
  'overview.adds': 'Adds',
  'overview.adds.value': 'A "News" item in the menu, with your own unread count',
  'overview.record': 'Record',
  'overview.record.value': '5 fields, plus tags and documents',
  'overview.conversation': 'Conversation',
  'overview.conversation.value': 'Comments with likes and editing',
  'overview.opens-on': 'Opens on',
  'overview.opens-on.value': 'Unread items',
  'overview.banner.per-user': 'What is read, liked and saved is stored on the item itself, per person. Everyone sees their own.',
  'overview.banner.uninstall':
    'Removing the extension removes the screens, never the items: the records stay in the office and show up again if it is installed anew.',

  'license.body':
    'This extension is published by Microteia as an **authoring example**, and is distributed together with the platform. You may install it, study its source, copy it and change it inside your own organization, with no charge and no time limit.\n\nThe **content published through it** — the items, the comments and everything anyone writes in them — belongs to the organization that wrote it. It stays in the organization\'s own database, and uninstalling the extension does not delete it.\n\nWhoever changes this extension and republishes it under another name answers for the version they published, and that version is no longer covered by these terms.',
  'license.banner.warranty':
    'Provided as is, with no warranty of any kind. Neither the author nor Microteia is liable for damage arising from using it.',

  'view.screen-missing': 'The "News" screen was not found. Install the extension to enable it.',
  'view.write-denied': 'Could not save. Check whether you have permission in this office.',
  'view.author': 'Author',

  'list.new': 'New item',
  'list.filter.placeholder': 'Filter news...',
  'list.empty': 'No news found.',
  'list.filter.read-status': 'Reading status',
  'list.filter.unread': 'Unread',
  'list.filter.read': 'Read',
  'list.filter.saved': 'Saved for later',
  'list.badge.unread': 'Unread',
  'list.edited-by': 'edited by {name} · {when}',
  'list.action.like': 'Like',
  'list.action.views': 'Views',
  'list.action.comments': 'Comments',
  'list.action.save': 'Save for later',
  'list.action.unsave': 'Remove from saved',
  'list.action.mark-unread': 'Mark as unread',
  'list.action.more': 'Actions',

  'read.not-found': 'News item not found.',
  'read.mark-failed': 'Could not record your reading of this item.',
  'read.tab.news': 'News item',
  'read.tab.documents': 'Documents',
  'read.edit': 'Edit news item',
  'read.source': 'View original source',
  'read.edited-meta': 'edited by {name} · published on {when}',
  'read.likes.one': '{count} like',
  'read.likes.other': '{count} likes',
  'read.views.one': '{count} view',
  'read.views.other': '{count} views',
  'read.action.like': 'Like',
  'read.action.unlike': 'Unlike',
  'read.action.views': 'Views',
  'read.action.mark-unread': 'Mark as unread',
  'read.action.save': 'Save for later',
  'read.action.unsave': 'Remove from saved',
  'read.action.saved': 'Saved',

  'comments.title': 'Comments',
  'comments.collapse': 'Collapse',
  'comments.expand': 'Expand',
  'comments.empty': 'No comments yet. Be the first to comment.',
  'comments.placeholder': 'Write a comment in Markdown...',
  'comments.trigger': 'Add a comment...',
  'comments.submit': 'Comment',
  'comment.delete.confirm': 'Delete this comment?',
  'comment.edit.placeholder': 'Edit comment...',
  'comment.edited': '(edited)',
  'comment.edited.title': 'Edited by {name} on {when}',
  'comment.action.edit': 'Edit comment',
  'comment.action.delete': 'Delete comment',
  'comment.action.like': 'Like',
  'comment.action.unlike': 'Remove like',
  'comment.read-more': 'more... ▼',
  'comment.read-less': 'less ▲',

  'command.group': 'News',
  'command.new': 'New news item',
  'command.open': 'Open News',
  'mention.label': 'News item',
  'mention.description': 'Insert a link to a news item',
};

export const newsMessagesContribution = (): Contribution => messageBundleContribution({
  locale: DEFAULT_LOCALE,
  namespace: NEWS_NAMESPACE,
  messages: NEWS_MESSAGES,
});
