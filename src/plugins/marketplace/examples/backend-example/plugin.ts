import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import { backendMessagesContribution } from './backendMessages';
import { backendPtBrContribution } from './backendMessagesPtBr';

/**
 * **Cloud Functions, by example** — what an extension needs when declaring is not enough.
 *
 * Three functions, one of each shape, and each born with the guard that shape requires. The guards are
 * the subject: a Cloud Function belongs to the PROJECT, while installing an extension is the act of one
 * ORGANIZATION, and nothing about the function knows the difference unless it is written down.
 *
 * | Shape | Guard | Why that one |
 * |---|---|---|
 * | `onCall` | `requireInstalledExtension` | the endpoint stays public after your screen goes away |
 * | Firestore trigger | `forInstalledExtension` | the path carries `{tenantId}`; ask about that office |
 * | `onSchedule` / Pub/Sub / HTTP | `forEachInstalledOffice` | there is no office in the event at all |
 *
 * The sources are in `functions/`, one file per function plus a barrel. **What is exported from
 * `functions/index.ts` is what gets deployed** — and `manifest.backend.functions` below is what makes
 * it go up only where this extension is installed, when the office runs `microteia provision`.
 *
 * The two lists have to agree, and that is deliberate: exporting without declaring deploys a function
 * to everyone, and declaring without exporting names something that cannot be deployed at all. The
 * Console refuses the second.
 *
 * **The extension stays PENDING until the project is provisioned.** The tie is by CONTENT, not by
 * version: change what this extension asks of the project and it goes pending again, which is what
 * stops a function from being called before it exists.
 *
 * A note on where the source lives, because it is the one thing that surprises people: the `functions/`
 * of an extension belongs to the extension, next to its `plugin.ts`. Only a function that SEVERAL
 * extensions need moves up to the installation's own `functions/`, and that one takes
 * `forAnyInstalledExtension` plus `microteia.serves` in its `package.json` — and must NOT be named in
 * any `manifest.backend.functions`.
 */

const message = (key: string): string => `@com.microteia.backend-example/${key}`;

const TICKET_FIELDS: TemplateField[] = [
  { key: 'subject', label: message('field.subject'), type: 'text', required: true, order: 0, placeholder: message('field.subject.placeholder') },
  { key: 'amount', label: message('field.amount'), type: 'currency', required: false, order: 1 },
  {
    key: 'status',
    label: message('field.status'),
    type: 'select',
    required: true,
    order: 2,
    filterable: true,
    optionsColored: true,
    options: [
      { key: 'open', label: message('field.status.open'), color: 'warning' },
      { key: 'closed', label: message('field.status.closed'), color: 'success' },
    ],
  },
  { key: 'openedAt', label: message('field.openedAt'), type: 'date', required: false, order: 3, filterable: true },
];

/**
 * The collection the trigger watches, and the one the index below is for. The trigger's path is
 * `tenants/{tenantId}/backendTicket/{id}` — the same key, because a screen's key IS its collection.
 */
const TICKET_SCREEN: ScreenModuleTemplate = {
  key: 'backendTicket',
  sourceId: 'microteia:backend-example:ticket',
  sourceRev: 1,
  titleSingular: message('screen.ticket'),
  titlePlural: message('screen.ticket.plural'),
  icon: 'fileList',
  fields: TICKET_FIELDS,
  titleFieldKey: 'subject',
  subtitleFieldKey: 'status',
  eventPrefix: 'backendTicket',
};

export const backendExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.backend-example',
    version: '1.1.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    contributes: [
      backendMessagesContribution(),
      backendPtBrContribution(),
    ],
    /**
     * EVERYTHING this extension needs of the Firebase project, in one place. The office sees this list
     * before installing, and `microteia provision` is what satisfies it.
     */
    backend: {
      /**
       * The names exported from `functions/index.ts`. They are deployed only to the projects of
       * offices that installed this extension — that is the whole reason the list exists.
       */
      functions: [
        'backendExampleQuote',
        'backendExampleOnTicketWritten',
        'backendExampleNightlySweep',
      ],

      /**
       * An index the extension's own queries need. It travels WITH the extension instead of with the
       * platform, so an office that never installed this one never gets it — and the packaging gate
       * refuses a mismatch between what is claimed here and what is declared for the platform.
       */
      indexes: [
        {
          collectionGroup: 'backendTicket',
          queryScope: 'COLLECTION',
          fields: [
            { fieldPath: 'status', order: 'ASCENDING' },
            { fieldPath: 'openedAt', order: 'DESCENDING' },
          ],
        },
      ],

      /**
       * A setting, by NAME. The value is written per installation and never travels in the package —
       * that is what keeps one office's credential out of another's project. In the function it is
       * read as `defineString('BACKEND_EXAMPLE_RATE')`, and the two names must match.
       */
      parameters: ['BACKEND_EXAMPLE_RATE'],

      /**
       * The step no command can take for the office. A prerequisite is shown before installing and
       * stays visible until it is done; it exists so a function does not simply fail at three in the
       * morning with nothing saying why.
       *
       * It names the SETTING, never the file the setting lives in: where configuration is stored is
       * the Console's business, and an extension that spelled out a path was wrong the day the path
       * moved.
       */
      prerequisites: [
        {
          id: 'backend-example-scheduler',
          title: message('prerequisite.scheduler.title'),
          detail: message('prerequisite.scheduler.detail'),
        },
      ],
    },
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [TICKET_SCREEN],
};
