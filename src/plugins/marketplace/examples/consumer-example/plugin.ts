import type {
  MarketplacePlugin,
  WorkflowModuleTemplate,
} from '../../../../domain/entities/MarketplacePlugin';
import { artifactRef } from '../../../../domain/schema/plugin/artifactRef';
import {
  accessPermissionContribution,
  accessRequirementContribution,
  accessResourceContribution,
} from '../../../../domain/schema/access/extensionPoints';
import { pointContribution } from '../../../contributionBuilders';
import { consumerMessagesContribution } from './consumerMessages';
import { consumerPtBrContribution } from './consumerMessagesPtBr';

/**
 * **Using another extension, by example** — the half of cooperation that CONSUMES.
 *
 * Read it with `library-example`, which publishes everything used here. Between the two, all four
 * mechanisms this platform has for extension-to-extension cooperation appear once. There is no event
 * bus and no runtime registry to join: every link below is DECLARED, and none of them makes this
 * package execute the other one's code.
 *
 * The one idea worth carrying away is that **a reference travels as a NAME and resolves at execution
 * time**, never as a local id and never rewritten on install:
 *
 *     com.microteia.library-example/normalize-code
 *     └── the owner ──────────────┘ └── its sourceId
 *
 * An artifact of generated id gets a NEW id in the office that installs it — the installer renames it
 * when the name is already taken. So the id it has in the author's office is not the id it will have
 * anywhere else, and a package that shipped one would point at nothing. The two namespaces cannot
 * collide: a local id can never contain a slash, so the slash alone means "qualified".
 *
 * Resolving at execution time rather than at install time is what makes this survive the library being
 * uninstalled and reinstalled — which renumbers everything — and it is also what makes the failure
 * legible: a dangling `wf-7` says nothing, while a qualified name says exactly which extension to
 * install.
 */

const message = (key: string): string => `@com.microteia.consumer-example/${key}`;

const LIBRARY = 'com.microteia.library-example';

/**
 * The flow that uses what it does not own. Neither step names a local id, and neither could: the ids
 * of both artifacts are decided by the office that installs the library.
 */
const WORKFLOWS: WorkflowModuleTemplate[] = [
  {
    templateId: 'wf-tidy',
    sourceId: 'microteia:consumer-example:tidy',
    sourceRev: 1,
    name: message('workflow.tidy'),
    description: message('workflow.tidy.description'),
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    parameters: [
      { key: 'code', label: message('parameter.code'), type: 'String', required: true },
    ],
    steps: [
      {
        id: 'normalize',
        stepDefinitionId: 'script',
        type: 'Script',
        order: 0,
        enabled: true,
        configuration: {
          /**
           * The library's SCRIPT, by qualified name. The engine resolves it with a single-field
           * equality on `sourceId` plus an owner check — the owner half matters, because two unrelated
           * extensions may legitimately use the same `templateId`, and without it this would silently
           * resolve to somebody else's script.
           */
          scriptId: { kind: 'Literal', value: artifactRef(LIBRARY, 'normalize-code') },
          /**
           * A DYNAMIC input — one that does not exist in the step definition, because it is born from
           * the target chosen at design time. It has to carry the `param.` prefix: without it the
           * package gate refuses the key as unknown, since the definition of `script` declares only
           * `scriptId`. This is the argument the script receives as `input.code`.
           */
          'param.code': { kind: 'Event', path: 'code' },
        },
      },
      {
        id: 'announce',
        stepDefinitionId: 'call-workflow',
        type: 'SubWorkflow',
        order: 1,
        enabled: true,
        configuration: {
          /** The library's FLOW, the same way. */
          targetWorkflowId: { kind: 'Literal', value: artifactRef(LIBRARY, 'wf-announce') },
          params: {
            kind: 'Expression',
            expression: 'object("code", steps.normalize.code, "reason", "tidied by the consumer example")',
          },
          waitForResult: { kind: 'Literal', value: false },
        },
      },
    ],
  },
];

export const consumerExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.consumer-example',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },

    /**
     * The dependency is NOT decoration, and in an office it is checked at the gate: installing is
     * refused when the library is absent, when its version does not satisfy this range, or when the
     * `sourceId` referenced above is not in the library's `exports`. Failing closed at the gesture is
     * the point — the alternative is a step that only fails the first time it runs, in production.
     *
     * When a reference is produced by the authoring screens rather than written here, this list is
     * DERIVED: the author picks a target in a selector and has no reason to know it just became an
     * installation requirement.
     */
    dependencies: { [LIBRARY]: '^1.0.0' },

    /** The other side of the library's `provides`. A range, so a newer library still satisfies it. */
    consumes: [{ capability: 'example.code-formatting', range: '^1.0.0' }],

    contributes: [
      consumerMessagesContribution(),
      consumerPtBrContribution(),

      /**
       * FILLING the library's point. The metadata is the whole contribution — no `impl` — so this
       * package still ships no executable code, and the library receives
       * `{ pluginId, id, metadata }` and nothing more.
       */
      pointContribution('codelibrary.formatter', 'dashed-slug', {
        label: message('contribution.slug'),
        description: message('contribution.slug.description'),
        separator: '-',
        lowercase: true,
      }),

      /**
       * This package's own capability — the one the requirement below adds to the library's closure.
       *
       * It carries no `requires` back to the library, and that is not an omission: the closure is a
       * GRAPH, and a sum that would close a cycle is refused before it enters — quietly, because the
       * one who erred is a third party adding to somebody else's permission. Requiring the library
       * here AND adding this to the library there would produce exactly that cycle, and the second
       * half would simply be dropped.
       */
      accessResourceContribution({ id: 'consumer-example', name: message('resource.consumer') }),
      accessPermissionContribution({
        id: 'consumer-example.tidy',
        name: message('permission.tidy'),
        description: message('permission.tidy.description'),
      }),

      /**
       * WIDENING somebody else's permission — adding to its CLOSURE, not granting anything.
       *
       * From here on, holding `library-example.use` also requires `consumer-example.tidy`. That is the
       * honest consequence of having filled the library's point: using the library now surfaces
       * something of this package's, and a permission that stopped short of what it reaches would let
       * someone see through it what they may not see directly. It is the same shape as an extension
       * that patches another's screen and then widens that screen's read permission to cover what it
       * put there.
       *
       * It exists as a separate point because `access.permission` REFUSES a duplicate id — this
       * package cannot re-declare `library-example.use` to widen it, and that refusal is what makes
       * the mechanism necessary rather than merely convenient. The library never learns it happened.
       *
       * The sum has no name, does not replace anything, REACHES DERIVED permissions (which is the case
       * it was built for), and several packages may add to the same id: the closure is their union.
       * A sum pointing at an id that does not exist is discarded with a diagnostic rather than
       * refused — it only ever widens, so dropping it can only narrow, and the one who erred is not
       * the owner of the permission being widened.
       */
      accessRequirementContribution({
        id: 'library-example.use',
        requires: ['consumer-example.tidy'],
      }),
    ],
  },
  summary: message('package.summary'),
  workflows: WORKFLOWS,
};
