import type {
  MarketplacePlugin,
  ScriptModuleTemplate,
  WorkflowModuleTemplate,
} from '../../../../domain/entities/MarketplacePlugin';
import type { ExtensionPointDefinition } from '../../../../domain/schema/plugin/extensionPoint';
import {
  accessPermissionContribution,
  accessResourceContribution,
} from '../../../../domain/schema/access/extensionPoints';
import { transpileScriptSource } from '../../../../domain/services/scriptSource';
import NORMALIZE_CODE from './scripts/normalize-code.script.ts?raw';
import { libraryMessagesContribution } from './libraryMessages';
import { libraryPtBrContribution } from './libraryMessagesPtBr';

/**
 * **A library extension, by example** — the half of cooperation that PUBLISHES.
 *
 * It installs no screen and no page. Everything here exists so that ANOTHER extension can use it, and
 * reading it alone teaches half a subject: `consumer-example` is the other half, and the two are meant
 * to be read together.
 *
 * There is no event bus in this platform, and that is a decision rather than an omission. Cooperation
 * happens through four named mechanisms, and this package is on the publishing side of all four:
 *
 * 1. **An extension point of its own.** Anyone may declare one in `manifest.extensionPoints`, and from
 *    then on other extensions fill it. What the reader gets back is `{ pluginId, id, metadata }` — the
 *    `impl` NEVER crosses, so filling a point can never make one extension execute another's code.
 * 2. **`exports`.** Only what is listed there may be pointed at from outside. **Absent means an EMPTY
 *    surface** — without that rule, every `templateId` ever published would become a public contract by
 *    accident, and renaming an internal helper would break somebody the author never knew existed. The
 *    price is that exposing something means publishing a version; that is the price of having a private
 *    surface at all.
 * 3. **A permission others may widen.** `access.permission` refuses a duplicate id, so a second
 *    extension cannot re-declare this one to add to it — it uses `access.requirement` instead.
 * 4. **A capability.** `provides` says what this package can do for whoever `consumes` it.
 *
 * **What travels is the `sourceId`, never the local id.** An artifact of generated id — a flow, a
 * script, an action — is renamed on install when the name is already taken in the destination office,
 * so the id it has here is not the id it will have there. That is why a reference from outside is
 * written `com.microteia.library-example/normalize-code` and resolved BY NAME at execution time.
 */

const message = (key: string): string => `@com.microteia.library-example/${key}`;

/**
 * The point this library publishes. `ownerPluginId` is this package, and it has to be: the kernel
 * refuses a point whose owner is somebody else, which is what stops one extension from opening a hole
 * in another's surface.
 *
 * `allowedImplKinds` is empty, and that is the strongest choice available here. The metadata alone is
 * the contribution, so ANY package may fill this point — including a plain `.json` from an office that
 * ships no code and would otherwise need a trust gesture it cannot give.
 */
const FORMATTER_POINT: ExtensionPointDefinition = {
  /**
   * The id takes NO hyphen: the pattern is lowercase alphanumeric segments separated by dots
   * (`^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`), so `library-example.formatter` is refused. It also does
   * not have to repeat the plugin id — `ownerPluginId` below already says whose point this is, and the
   * kernel refuses a point declared with somebody else's owner.
   */
  id: 'codelibrary.formatter',
  apiVersion: '1.0.0',
  title: message('point.formatter.title'),
  description: message('point.formatter.description'),
  ownerPluginId: 'com.microteia.library-example',
  allowedImplKinds: [],
  implRequired: false,
  multiple: true,
};

/**
 * The sandbox never transpiles, deliberately — so `compiledJs` has to travel ready-made in the package.
 * `transpileScriptSource` is the platform's own transpiler, and using it is what keeps the compiled
 * half from being produced by a different tool than the one that runs it.
 *
 * It comes from `@microteia/sdk/node` and not from the main barrel, because it is a TOOL: it drags in
 * a transpiler, and the isomorphic surface deliberately drags in nothing.
 */
const compiled = (name: string, sourceTs: string): string => {
  const result = transpileScriptSource(sourceTs);
  if ('error' in result) throw new Error(`${name}: ${result.error}`);
  return result.compiledJs;
};

const SCRIPTS: ScriptModuleTemplate[] = [
  {
    templateId: 'normalize-code',
    sourceId: 'microteia:library-example:normalize-code',
    sourceRev: 1,
    name: message('script.normalize'),
    description: message('script.normalize.description'),
    sourceTs: NORMALIZE_CODE,
    compiledJs: compiled('normalize-code', NORMALIZE_CODE),
    inputParams: [
      { key: 'code', label: message('script.normalize.in.code'), type: 'String', required: true },
    ],
    outputParams: [
      { key: 'code', label: message('script.normalize.out.code'), type: 'String' },
      { key: 'changed', label: message('script.normalize.out.changed'), type: 'Boolean' },
    ],
  },
];

/**
 * A CALLED flow — no trigger of its own, so `parameters` are the `event.` it receives. Another
 * extension fires it with a `call-workflow` step pointed at
 * `com.microteia.library-example/wf-announce`.
 */
const WORKFLOWS: WorkflowModuleTemplate[] = [
  {
    templateId: 'wf-announce',
    sourceId: 'microteia:library-example:announce',
    sourceRev: 1,
    name: message('workflow.announce'),
    description: message('workflow.announce.description'),
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    parameters: [
      { key: 'code', label: message('parameter.code'), type: 'String', required: true },
      { key: 'reason', label: message('parameter.reason'), type: 'String' },
    ],
    steps: [
      {
        id: 'announce',
        stepDefinitionId: 'register-audit',
        type: 'Action',
        order: 0,
        enabled: true,
        configuration: {
          title: { kind: 'Literal', value: message('workflow.announce.audit.title') },
          message: { kind: 'Expression', expression: 'concat(event.code, " — ", coalesce(event.reason, "no reason given"))' },
          severity: { kind: 'Literal', value: 'LOW' },
        },
      },
    ],
  },
];

export const libraryExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.library-example',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },

    /** The point this package opens for others. Declaring one costs nothing and needs no permission. */
    extensionPoints: [FORMATTER_POINT],

    /**
     * The PUBLIC surface, by `sourceId`. Anything not listed here cannot be pointed at from outside,
     * however long it has existed — absence is an empty surface, not a wildcard.
     */
    exports: ['normalize-code', 'wf-announce'],

    /**
     * What this package can do for whoever asks. A consumer declares `consumes` with a range, and
     * `selectProvider` decides between several providers of the same capability: an explicit choice by
     * the office first, then `priority`, then the plugin id alphabetically.
     */
    provides: [
      { capability: 'example.code-formatting', version: '1.0.0', priority: 10, label: message('package.name') },
    ],

    contributes: [
      libraryMessagesContribution(),
      libraryPtBrContribution(),
      accessResourceContribution({ id: 'library-example', name: message('resource.library') }),
      /**
       * The permission another extension will WIDEN. It carries no `requires` of its own here — the
       * consumer adds one through `access.requirement`, which is additive and belongs to whoever
       * needs the widening, not to whoever declared the permission.
       */
      accessPermissionContribution({
        id: 'library-example.use',
        name: message('permission.use'),
        description: message('permission.use.description'),
      }),
    ],
  },
  summary: message('package.summary'),
  workflows: WORKFLOWS,
  scripts: SCRIPTS,
};
