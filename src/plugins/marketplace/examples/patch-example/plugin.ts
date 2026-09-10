import type {
  MarketplacePlugin,
  ScreenModuleTemplate,
  ScreenPatchTemplate,
  TemplateField,
} from '../../../../domain/entities/MarketplacePlugin';
import type { PluginMigration } from '../../../../domain/schema/plugin/migration';
import FILL_CODE from './scripts/fill-code.migration.ts?raw';
import { patchMessagesContribution } from './patchMessages';
import { patchPtBrContribution } from './patchMessagesPtBr';

/**
 * **Extending and migrating, by example** — the two things an extension does to data that is not new.
 *
 * A `screenPatch` adds fields to a screen ANOTHER extension declared, without either package being
 * rewritten and without the two ever meeting. It is how the deadline extension puts a case reference on
 * the calendar's card: the calendar does not know deadlines exist, and does not need to.
 *
 * **`targetKind: 'sourceId'` rather than `'collection'`**, and the difference matters. A collection name
 * is the destination office's, and can gain a suffix when the name is already taken there; the
 * `sourceId` is universal and stamped by whoever declared the screen. Targeting by collection works
 * until the day it does not, and that day is in somebody else's office.
 *
 * A patch is CONVERGENT like everything else an update applies: fields that vanish from the package are
 * released, and what the office added by hand is preserved. Nothing here overwrites the other
 * extension's own fields — a patch may only add.
 *
 * ---
 *
 * The MIGRATION is the other half. It exists because this package is at 1.1.0: version 1.0.0 stored a
 * note without a code, and every record written back then still has none. A declaration cannot fix
 * that; only code that walks the data can.
 *
 * Four properties are worth carrying away, and each one was learned the hard way:
 *
 * - **The identity is the `id`, never a version range.** The office keeps the SET of applied ids and
 *   runs every declared migration not in it. A range would lose the migration added late to an old
 *   version, the one that failed halfway, and — in a catalog whose version sits still while the code
 *   moves — the whole queue.
 * - **A fresh install stamps the queue as applied and runs NOTHING.** A migration repairs data written
 *   by an earlier version of THIS extension, and in an office installing today that data does not
 *   exist. `runOnInstall: true` is the declared exception, for a package that adds fields to a
 *   collection that was already there.
 * - **It never writes a collection name by hand.** See the source in `scripts/`.
 * - **It returns `remaining`,** or it ends after one round and leaves a large collection half done.
 */

const message = (key: string): string => `@com.microteia.patch-example/${key}`;

const NOTE_FIELDS: TemplateField[] = [
  { key: 'title', label: message('field.title'), type: 'text', required: true, order: 0, placeholder: message('field.title.placeholder') },
  { key: 'code', label: message('field.code'), type: 'text', required: false, order: 1, filterable: true },
  { key: 'body', label: message('field.body'), type: 'textarea', required: false, order: 2 },
];

const NOTE_SCREEN: ScreenModuleTemplate = {
  key: 'patchNote',
  sourceId: 'microteia:patch-example:note',
  sourceRev: 1,
  titleSingular: message('screen.note'),
  titlePlural: message('screen.note.plural'),
  icon: 'fileText',
  fields: NOTE_FIELDS,
  titleFieldKey: 'title',
  eventPrefix: 'patchNote',
};

/**
 * The patch: a reference to THIS package's note, put on a screen the automation example owns. The
 * automation example is not modified, does not depend on this package, and does not know it exists.
 *
 * `refEntity` names the collection pointed at — this one is ours, declared above, so its template key
 * is rewritten on install like any other reference between screens of the same package.
 */
const REQUEST_PATCH: ScreenPatchTemplate = {
  target: 'microteia:automation-example:request',
  targetKind: 'sourceId',
  sourceRev: 1,
  fields: [
    {
      key: 'patchNoteId',
      label: message('patch.note'),
      type: 'reference',
      required: false,
      order: 50,
      refEntity: 'patchNote',
      filterable: true,
    },
  ],
};

/**
 * The queue. Ordered by semver, with the declared order breaking ties — and validation refuses an array
 * out of order, so what is read here is what happens in the office.
 *
 * `id` is not the version: one version may need two migrations, and two migrations need a deterministic
 * order.
 */
const MIGRATIONS: PluginMigration[] = [
  {
    id: 'fill-code',
    version: '1.1.0',
    name: message('migration.fill-code'),
    sourceTs: FILL_CODE,
    /**
     * `after`, because it reads the field that this version's declaration adds: the `before` phase runs
     * ahead of the artifacts converging, and the column would not be there yet. A migration that has to
     * read the OLD shape before it is replaced is the case for `before`.
     */
    phase: 'after',
    maxRounds: 50,
  },
];

export const patchExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.patch-example',
    version: '1.1.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    /**
     * Patching another extension's screen is a real dependency: without the target installed there is
     * nothing to patch, and the fields simply never appear. Declaring it turns a silent no-op into a
     * refusal at the gate.
     */
    dependencies: { 'com.microteia.automation-example': '^1.0.0' },
    contributes: [
      patchMessagesContribution(),
      patchPtBrContribution(),
    ],
  },
  summary: message('package.summary'),
  workflows: [],
  screens: [NOTE_SCREEN],
  screenPatches: [REQUEST_PATCH],
  migrations: MIGRATIONS,
};
