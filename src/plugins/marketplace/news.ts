import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { nav, page } from '../contributionBuilders';
import { newsMessagesContribution } from './newsMessages';
import { newsPtBrContribution } from './newsMessagesPtBr';
import NEWS_LIST_SOURCE from './views/news/NewsList.view.tsx?raw';
import NEWS_READ_SOURCE from './views/news/NewsRead.view.tsx?raw';
import STARTUP_SOURCE from './views/news/startup.tsx?raw';

/**
 * **News** — the office noticeboard declared as an extension: the announcement someone publishes, who
 * has read it, what each person saved for later, and the conversation that forms underneath.
 *
 * It was the seventh entity to leave the kernel and the first where the interesting data is not on the
 * RECORD but in the relation between the record and WHOEVER is looking. Hence the two capabilities
 * born with it: `user` in the expression scope — which is what makes the menu badge count what I have
 * not read — and `authorCanDelete`, which gives back, by declaration, the "everyone deletes what they
 * wrote" that only existed as a named rule for `newsComments` in `firestore.rules`.
 *
 * **Read/unread has no collection.** `readBy` and `savedBy` are arrays of ids on the document itself,
 * the same shape as the `likedBy` the item always had. No document per person, no counter to keep:
 * the badge is an expression over what the list already sees, and one person's reading resolves in one
 * write. The limit is the size of the office — it is one array per item, not a collection.
 *
 * A noticeboard belongs to every kind of business, not to one domain, so this extension is written in
 * the source language and carries its own Portuguese translation as one more `i18n.messages`
 * contribution. Nothing below is a phrase: every label is a reference into `newsMessages.ts`.
 */
const SOURCE_ID = 'microteia:news';
const COMMENT_SOURCE_ID = 'microteia:news-comment';

const READ_TAB_PREFIX = 'news-read:';

/**
 * A reference into this extension's own catalog. The namespace is written out, not composed:
 * `npm run verify-messages` reads these calls and fails on a key that does not exist, and it can
 * only do that if the namespace is there to be read.
 */
const message = (key: string): string => `@com.microteia.news/${key}`;

const CONTENT = message('section.content');

/**
 * The FORM fields — the five someone fills in when publishing. Deliberately left out: `likedBy`,
 * `readBy`, `savedBy` and `viewCount`. Those are reading state, written by a gesture (like, open,
 * save) and never typed. Declaring them would put them in the form and in the filters, where they
 * would only get in the way — the same reason the body of an e-mail is not a field in the Pushes
 * extension.
 */
const FIELDS: TemplateField[] = [
  { key: 'title', label: message('field.title'), type: 'text', required: true, order: 0, section: CONTENT, placeholder: message('field.title.placeholder') },
  { key: 'category', label: message('field.category'), type: 'select', required: false, order: 1, section: CONTENT, lookupCollection: 'newsCategories', optionsAllowUserAdd: true, filterable: true },
  { key: 'sourceURL', label: message('field.source-url'), type: 'text', required: false, order: 2, section: CONTENT, placeholder: message('field.source-url.placeholder') },
  { key: 'summary', label: message('field.summary'), type: 'textarea', required: true, order: 3, section: CONTENT, placeholder: message('field.summary.placeholder') },
  { key: 'content', label: message('field.content'), type: 'markdown', required: false, order: 4, section: CONTENT },
];

/**
 * A comment is a CHILD SCREEN, not an annotation. The native annotation has neither editing nor
 * likes, and those two are half of what a comment is. As a screen it gets for free what any record
 * has — stamped authorship, auditing, deletion by the author — and the extension only draws the
 * conversation.
 */
const COMMENT_FIELDS: TemplateField[] = [
  { key: 'newsId', label: message('field.news'), type: 'reference', required: true, order: 0, refEntity: 'news' },
  { key: 'content', label: message('field.comment'), type: 'markdown', required: true, order: 1 },
];

const options = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([key, label]) => ({ key, label }));

/**
 * The categories the kernel used to carry in `lookupDefaults`. The KEY stays in English because it is
 * what has been stored on every item since the first one — the list describes the database as it is.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'newsCategories',
    label: message('lookup.categories'),
    options: options([
      ['GENERAL', message('category.general')],
      ['ANNOUNCEMENT', message('category.announcement')],
      ['CIRCULAR', message('category.circular')],
      ['UPDATE', message('category.update')],
    ]),
  },
];

const TAG_LISTS: LookupModuleTemplate[] = [
  { collection: 'newsTags', label: message('tags.list') },
];

const NEWS_SCREEN: ScreenModuleTemplate = {
  key: 'news',
  sourceId: SOURCE_ID,
  titleSingular: message('screen.singular'),
  titlePlural: message('screen.plural'),
  icon: 'newspaper',
  dataCollection: 'news',
  fields: FIELDS,
  titleFieldKey: 'title',
  subtitleFieldKey: 'summary',
  hasNotes: false,
  hasDocuments: true,
  hasTags: true,
  tagCollection: 'newsTags',
  eventPrefix: 'news',
  // Opening an item from OUTSIDE — the audit log, a mention, ⌘K — lands on the READING view, not on
  // the form.
  recordTabPrefix: READ_TAB_PREFIX,
  listActions: ['copyLink', 'manageTags', 'delete'],
  // Editing the CONTENT follows the office's default permission. What is "per person" — marking as
  // read, liking, saving for later — is a write on a document someone else created, and so it goes
  // through another door: any member writes these four fields and nothing else. Without this, whoever
  // holds the `user` role (read only) could not even mark an item as read, and the menu badge stayed
  // stuck forever.
  memberWritableFields: ['readBy', 'savedBy', 'likedBy', 'viewCount'],
  // Whoever published deletes what they published, without depending on an admin.
  authorCanDelete: true,
  // The menu item is declared separately, so it can carry the badge.
  hideFromSidebar: true,
  sidebarOrder: 90,
};

const COMMENTS_SCREEN: ScreenModuleTemplate = {
  key: 'newsComments',
  sourceId: COMMENT_SOURCE_ID,
  titleSingular: message('comment.singular'),
  titlePlural: message('comment.plural'),
  icon: 'chat3',
  fields: COMMENT_FIELDS,
  titleFieldKey: 'content',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  parentEntity: 'news',
  parentFieldKey: 'newsId',
  parentRelation: 'owned',
  // The conversation is read UNDER the item, on the reading view. As a tab of the edit form it would
  // be the same thing twice — and in the place nobody looks for it.
  hideFromParentTabs: true,
  listActions: ['delete'],
  // On a noticeboard, commenting belongs to EVERYONE — including whoever only reads the rest of the
  // office. That is what the named rule for `newsComments` said (any authenticated user creates their
  // own comment), and here the declared list WIDENS the default permission instead of narrowing it.
  authorCanDelete: true,
  hideFromSidebar: true,
};

/**
 * The LIST. It does not use the default card surface: the card of a news item is a piece of reading —
 * author on the left, title, summary and the social line underneath (likes, views, comments) — and
 * not a summary of a record. What comes from the default is the frame (`EntityListView` in
 * `layout="list"`, because the card wants the full width), the filters derived from the fields, the
 * modals and the ACTIONS: what appears on the card is still governed by the Form Design.
 *
 * The "Reading status" filter is the only one the extension adds by hand, and it has to be: it does
 * not look at a field, it looks at the relation between the item and whoever is reading the screen.
 */

/**
 * The READING view. It is the screen declaration cannot reach: a news item is not read in a form — it
 * is read as an article, with the author beside it, the content in Markdown and the conversation
 * underneath. Editing is still the NATIVE form (`list.openRecord`), which the schema describes
 * entirely; only what is reading lives here.
 *
 * The comments are records of the child screen, assembled by hand because a conversation has a shape
 * of its own — likes, editing with an "(edited)" mark, collapsing and "more...". What writes, deletes
 * and stamps authorship is the same path as any record; the extension knows no repository.
 */

/**
 * The STARTUP: ⌘K search and the `@news` mention in annotations. Both point at the READING view —
 * which is where a news item is opened — and not at the form.
 */

export const newsPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.news',
    version: '1.2.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    publisher: { name: 'Microteia' },
    /**
     * The LICENCE TERMS, which the Extensions screen shows behind the licence icon and the
     * organization's Terms page reproduces while this extension is installed and active. Like every
     * other string here it is a reference, so the terms are translated by the same catalogue that
     * translates the labels — a legal document that only existed in one language would be the one
     * place in the package where the office could not read what it agreed to.
     */
    license: {
      type: 'stack',
      gap: 'md',
      children: [
        { type: 'markdown', content: message('license.body') },
        { type: 'banner', message: message('license.banner.warranty'), variant: 'warning' },
      ],
    },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      newsMessagesContribution(),
      newsPtBrContribution(),
      nav({
        key: 'news',
        label: message('nav.news'),
        icon: 'newspaper',
        order: 90,
        // The PERSONAL badge: the items THIS person has not read yet, minus the ones they published
        // themselves. It is an expression over the records the list already sees — there is no
        // per-person counter in any collection, and the number goes down on its own when they open
        // the item.
        badge: { collection: 'news', when: 'not contains(readBy, user.id) and createdBy != user.id' },
      }),
      page({ key: 'news', title: message('page.news'), icon: 'newspaper' }, 'news'),
      page({ key: '', keyPrefix: READ_TAB_PREFIX, title: message('page.news-read'), icon: 'newspaper' }, 'news-read'),
    ],
  },
  summary: message('package.summary'),
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      { type: 'markdown', content: message('overview.body') },
      {
        type: 'keyValue',
        items: [
          { label: message('overview.adds'), value: message('overview.adds.value') },
          { label: message('overview.record'), value: message('overview.record.value') },
          { label: message('overview.conversation'), value: message('overview.conversation.value') },
          { label: message('overview.opens-on'), value: message('overview.opens-on.value') },
        ],
      },
      { type: 'banner', message: message('overview.banner.per-user'), variant: 'info' },
      { type: 'banner', message: message('overview.banner.uninstall'), variant: 'info' },
    ],
  },
  workflows: [],
  screens: [NEWS_SCREEN, COMMENTS_SCREEN],
  lookups: LOOKUPS,
  tagLists: TAG_LISTS,
  startup: STARTUP_SOURCE,
  views: [
    { key: 'news', title: message('page.news'), icon: 'newspaper', source: NEWS_LIST_SOURCE },
    { key: 'news-read', title: message('page.news-read'), icon: 'newspaper', source: NEWS_READ_SOURCE },
  ],
};
