# Microteia — kernel changelog

> Technical history of the Microteia platform package, newest first. One entry per `package.json`
> version, written in the language of the change itself: what moved, where, and why it had to.
>
> **This file travels inside the package**, and `microteia unpack` replaces the copy next to your
> `microteia.yaml` on every version. Do not edit that copy — put your own notes in `README.md`.
>
> The Console that installs this package keeps its own history in `CONSOLE-VERSIONS.md`, beside this
> one. Release notes written for the people who use the application are a separate document and are
> not distributed with the package.

<!-- A new entry goes here, above the previous ones, in this format:

#### [9.9.9] — YYYY-MM-DD

- feat(scope): what the change makes possible.
- fix(scope): what was broken, and what it did to whoever hit it.
-->

#### [9.70.0] — 2026-10-07

- feat(reference): `members` options now carry the member's e-mail as `meta`, and fall back to it as `label` when `displayName` is empty. `members` is not a screen, so no `subtitleFieldKey` could be declared for it, and two members sharing a name were indistinguishable in the picker. The stored `value` is still `userId`.
- feat(ui/MultiSearchSelect): options render `meta` as a second line in the list (not in the selected pills), and the search matches `meta` as well as `label` — the same behaviour `SearchSelect` already had, so a `multi: true` reference behaves like the single one.

#### [9.69.0] — 2026-10-07

- fix(agent): `microteia://office/workflows` read `name` from each parameter, which is stored as `key` — every parameter reached the agent as `"name": ""`. Parameters are now described once (`describeParameters`, `domain/schema/agent/agentWorkflow.ts`) and served by both the resource and the new tool: key, label, type, required, list, options / `optionsFrom` / `references`, format, pattern, default, `accepts` and an `example`.
- feat(agent): `describe_workflow` (twelfth tool, `automation.run`). Returns the parameters, the collections read / written / deleted, a step summary with each input's binding and every condition, the entry condition when it is not always-true, the result shape (via `returningStepsOf`) and an idempotency verdict with a closed-vocabulary reason (`reads-only`, `keyed-writes`, `may-duplicate`, `notifies`, `opaque-steps`). Effects are read from the catalog's input TYPE (`Query` / `Upsert` / `Remove`) over the `stepRegistry`, never from a step id, so extension steps are covered.
- feat(agent): `run_workflow` validates before publishing: undeclared keys (with the accepted ones), missing required parameters and values that do not coerce to the declared type are refused — previously unknown keys were dropped and the run ended SUCCESS with nothing received, and required ones were only checked inside the engine after `STARTED`. `dry_run: true` runs the same preparation, never refuses, and returns the coerced values, the issues and what the automation would write. `run_action` gets the same preparation against its target workflow, excluding the five system parameters.
- fix(agent): tool arguments are checked against the published input schema (`checkAgentInput`, `domain/schema/agent/agentInput.ts`) before any read. `additionalProperties: false` was declared and never enforced, so `filters` instead of `where` returned the whole collection unfiltered. Refusals now carry `details` (`issues[]`, `unknownParams`, `acceptedParams`) beside the sentence.
- fix(query): `compareValues` treats a date on either side as a date on both. Rows carry `Date` and filters carry ISO text, which went through `Number()` and became `NaN` — `gte` on `createdAt` returned nothing. A bare `YYYY-MM-DD` is the whole UTC day as a half-open interval for `eq`/`neq`/`lt`/`lte`/`gt`/`gte`. `runWorkflowQuery` no longer pushes an `eq` of text on a date field down to Firestore, where it could never match a `Timestamp`. Reports and the "Query" step share the fix.
- fix(reports): `spec.access.permission` was enforced nowhere — the `runReport` callable, the agent gateway, the Reports list and the command palette each built the collection-read list by hand, without it. `reportRequiredPermissions` (`domain/schema/report/reportSpec.ts`, synced) is now the single list: the report's own permission when declared, plus the read of every collection it touches. The callable charges it to the user through `requireReportAccess` (renamed from `requireReportCollections`, since it now charges more than collections); the agent charges it to the access; both screens hide what would be refused. `CommandPaletteReport.collections` became `permissions`.
- fix(agent): `run_report` refuses undeclared filter keys and missing required filters; `office/reports` lists only reports the access can run and gives each filter's value type.
- feat(agent): `describe_screen` lists the screen's record actions (`viewActionIds` ∪ `cardActionIds`, workflow-backed only) with their parameters — `run_action` had no discovery at all — and adds `pattern` and an `example` to each writable field. `get_workflow_run` refuses an event id that was never published (it answered `pending` forever) and adds `finished`. `search_records` refuses `in` without an array and declares its 200-result ceiling as `maximum`.
- refactor(workflow): `returningStepsOf` moved from `presentation/shared/workflowHelpers.ts` to the synced `domain/schema/workflowReturn.ts`, re-exported from its old place.

#### [9.68.0] — 2026-10-06

- feat(access): `PermissionPicker` replaces the flat `MultiSearchSelect` in both the AI agents tab and the OAuth consent. It groups by `resource` with a tri-state group checkbox and a search, over the `resourceLabels` the catalog already carried — a flat list of eighty items made "everything under Deadlines" four clicks and made discovering that Create needs View trial and error.
- feat(access): `withDependencies` and `requiredBySelection` in `permissionSelection.ts`, both pure and both over the `dependenciesOf` the roles screen already used. Ticking a permission pulls its closure in, crossing resources; unticking takes only that one and the row then warns which selection still needed it. The asymmetry is the design: a ceiling admits "writes and never reads", a role does not — so the dependency is added on tick and warned on absence, never locked as it is in Roles.
- feat(ui): `Checkbox` gains `indeterminate`, drawn in CSS and announced as `aria-checked="mixed"`. The DOM property of the same name is only writable through a ref, and the component would stop being props.
- fix(scripts): `sync-schemas --check` now also refuses a synced file whose relative import has no counterpart under `functions/src`. The copy is literal, imports included, so such a file compiles into a module that references one that does not exist — and the root gate never sees it, because `npm run typecheck` does not enter the functions tsconfig. `access/index.ts` re-exporting `permissionSelection` hit exactly this: every copy matched its source, and one was simply absent. The counterpart need not be generated; `domain/entities/{AuditLog,Workflow}.ts` are hand-written there and always were, so what is required is existence, not membership in the list.
- refactor(access): both agent screens lost their copy of the "what may this person offer" memo — the picker owns it now, so there is one filter instead of two that could drift.

#### [9.67.0] — 2026-10-06

- feat(agent): `list_screens` joins the MCP surface as the eleventh tool. The label-to-collection map existed only as the `microteia://office/screens` resource, under the rule that a pure read is a resource — and that rule assumes a client that fetches resources on its own. Where it does not, the model never sees the map and the office answers only to the technical collection name. The resource stays: a resource URI is a contract with whoever already configured the server, and nothing in a client validates one that disappeared. `mcpProtocol.test.ts` names `list_screens` as the one tool that may take no argument, rather than dropping the invariant.
- feat(agent): OAuth 2.1 on the office MCP, so a hosted client signs each person in with their own account instead of sharing one organization-wide token. The authorization server is the app itself: `/authorize` validates the client metadata document, the redirect URI and PKCE, then hands an opaque request id to a consent page that reuses the permission picker of the AI agents tab. `issueAgentGrant` is the single issuing path for both the tab and the consent, so neither can be laxer than the other, and `authenticateAgent` is untouched — the access token is the same `mt_<tenant>.<grant>.<secret>`, with its secret rotated on every exchange.
- feat(agent): `agentMcp` answers an unauthenticated POST with `WWW-Authenticate: Bearer resource_metadata=...`. Without it a client probes `/.well-known/*` on the Cloud Functions origin, which serves no root path, and the connection fails as "couldn't reach the MCP server" with nothing in the logs. The metadata is served from the Hosting origin, which the spec allows and which is where the consent page has to live anyway.
- feat(agent): `agentAuthRequests` is a root collection, closed to every client in both directions — whoever writes it chooses which authorization code is valid, and a chosen code is an access nobody authorized. `rules-tests/agentAuthRequests.test.ts` holds that against SYSTEM too.
- feat(agent): `AgentGrant` gains `origin`, `accessExpiresAt`, `refreshHash` and `clientId`. `accessExpiresAt` is deliberately distinct from `expiresAt`: conflating them forced a choice between a short-lived access token and a grant that vanishes from the list an hour after last use. `grantRefusal` answers `expired` for both, because the caller's next move is the same.
- refactor(agent): `authorizationCodeRefusal` gathers the whole code-exchange decision into one pure function with injected hashing and clock, so its refusal order is stamped in test — the same arrangement as `authenticateAgent`, and for the same reason.
- refactor(domain): `httpFunctionEndpoint` and `hostingOrigin` are one formula shared by the front and the backend. The `resource` field has to equal the URL the screen tells people to copy, and the comparison a client makes against it is literal.

#### [9.66.0] — 2026-09-18

- refactor(marketplace): the `plugin_registry` spine and the `plugin_installations` lifecycle are gone — 16 files. `PluginStoreProvider` was still mounted in `App.tsx` and `usePluginStore` had no consumer, so every session opened two Firestore subscriptions whose results nothing read. With it went `mergeCatalog`, `PublishPluginUseCase`, both registry repositories, `PluginLifecycleUseCases`, `installedPluginRecords`, the `PluginInstallation` entity and the three `make*MarketplacePluginUseCase` factories. The catalog the Extensions screen reads is `public_extensions`; the installed copy is `installed_extensions`.
- refactor(domain): `pluginLifecycle.ts` keeps only `LifecycleActor` — who operates and when, which materialization still needs. The `plan*` transitions belonged to a state machine that `applyPackageArtifacts` replaced with convergence.
- refactor(tests): `MarketplaceInstallUseCases.test.ts` now drives `applyPackageArtifacts`/`releasePackageArtifacts` — the live path — keeping every materialization, refcount and cascade assertion; the five tests that asserted lifecycle codes (`already-installed`, `not-newer-version`, `not-installed`) went with the machine they described. The four first-party plugin tests build host records with `extensionRecordFrom`.
- feat(scripts/reservedCollections): `SELADAS` — a reserved collection deliberately WITHOUT a named rule, so leftover `plugin_installations` documents stay unreachable while the name stays unclaimable by a new screen. Reserved-and-unmatched was indistinguishable from a rule block deleted by mistake, which is the accident this very test was written for.
- fix(firestore.rules): the `public_extensions` preamble described the approval queue that 9.65.0 removed.

#### [9.65.0] — 2026-09-18

- feat(marketplace): importing a `.json` now asks where the extension becomes available — this organization only, or the global catalog — and publishes right after the private write when the second is chosen. The catalog (`public_extensions`) was reachable before, through a second, unlabelled gesture that shared the header's upload icon; the path existed and nobody found it.
- feat(firestore.rules): an extension that ships `views` is published to `public_extensions` by `isSystemAdmin()` only. `statusMatchesCode()` let any `extensions.manage` holder queue third-party code as `pending`; it is now `ownerPublishing()` — no code, status `approved`. The rule reads `request.resource`, so adding code to a record you already own is refused the same way.
- feat(domain/plugins): `publishRefusal` is the single door for the four refusals (invalid version, code without SYSTEM, domain owned elsewhere, version not greater), used by both `PublicExtensionStore.publish` and the row's `PublishAction`. A gesture the screen offers is one the store would accept.
- fix(marketplace): republishing requires a greater version. `updateSourceOf` only hands an installed copy the new package when the version rises, so publishing over the same version wrote a package nobody would ever receive — the entity's own docstring already claimed the rule the code did not enforce.
- fix(marketplace): the publish action is `null` when the published copy is identical, `needs-version` (disabled, saying what is missing) when the package differs without a version bump. "Republish to the catalog" used to sit there right after publishing, which was the question `republish what?` in button form.
- feat(rules-tests): `publicExtensions.test.ts` — 15 checks over the real rules file; `seed` gained `root` for collections outside a tenant.
- feat(core.marketplace): `import.*`, `extension.publish.needs-version`, `publish.code-requires-system` and `publish.version-not-greater`, in `en` and in the pt-BR package (1.57.0); `extension.sent-for-approval` dropped with the approval queue.

#### [9.64.0] — 2026-09-17

- feat(entity-screen): the Documents tab uploads a BATCH. `EntityDocumentsController` traded `pendingFile`/`pendingType` for a `pendingUploads` queue of `{ id, file, type, status }` — the type stays per file, which is what a single shared type could never express. `handleConfirmUpload` walks the queue one file at a time (readable progress, no burst of Storage connections), prepends what landed, and keeps only what failed — with the type the user had already typed, so a dropped connection does not cost the file picker and the typing again.
- feat(core.ui): `documents.uploaded.many`, `documents.upload-failed.many`, `documents.upload-failed.partial`, `documents.confirm-upload.many` and `documents.pending.remove`, in `en` and in the pt-BR package (1.56.0).

#### [9.63.0] — 2026-09-10

- feat(agent): an MCP server over HTTP that lets an AI agent operate an office — the first `onRequest`
  in the product, claimed by `com.microteia.agent` so it is deployed only where the office installed
  it. Ten generic tools and four resources, none of them named after a business entity: the
  collection is an argument, and `describe_screen` is what replaces one tool per installed entity. A
  per-entity API would have made the kernel know the extension, which is the defect this project
  exists not to have, and would have grown the tool list with every install.
- feat(agent): the gateway is an ADAPTER, not an engine. Every operation delegates to an executor
  that already serves the workflow engine or the reports — `runWorkflowQuery`, `runWorkflowUpsert`,
  `runWorkflowRemove`, `runReportQuery`, `RunCalledWorkflowUseCase` — so field rules, uniqueness
  keys, type coercion, entity events, aggregates and the audit log all apply to an agent write
  exactly as they do to a screen write, and none of it is stated twice.
- feat(agent): access is a token issued in the application (`mt_<tenant>.<grant>.<secret>`), with
  only its SHA-256 stored. Effective permissions are `granted(user) ∩ grant.permissions`, recomputed
  on every call: an access can never exceed the person who issued it, and revoking their role
  narrows it on the next request without touching the token. The owner's `*` intersects down to the
  declared ceiling, so a ceiling stays a ceiling even for the office owner.
- feat(agent): the runtime gate asks the INVERSE question — "does any installed, active extension
  claim the function named `agentMcp`?" — instead of naming a plugin id inside the kernel
  (`InstalledExtensionCache.claimsFunction`). The kernel names only what is its own, the answer stays
  data belonging to the office, and forking the extension into another package keeps working.
- feat(i18n): the backend can now RESOLVE a message reference. It has always emitted
  `@core.records/field.invalid-format` and left resolution to the screen; the agent gateway is the
  first consumer that is not a screen, and a raw reference is no answer to a model. The ten source
  catalogs the backend cites are synced to `functions/src`, and `agentMessages.test.ts` refuses a
  namespace cited but not synced — so the list stays derived. A translation package installed in the
  office reaches the agent through the same `i18n.messages` contribution the screens use.
- fix(workflow/mutation): deleting a record now cascades its notes, its attached documents and the
  stored files of both. `DeleteRecordUseCase` always cascaded on the client; the "Remove record" step
  deleted the document alone and left everything hanging from it unreachable, with no error
  anywhere. The cascade runs BEFORE the record so a mid-way failure leaves something that can still
  be found and retried.
- feat(workflow/mutation): `UpsertOptions.writeActor` — the author stamped on a write. The engine
  stays the default because it is the truth when the engine wrote; the agent passes its own, because
  saying "workflow-engine" for a write a person asked an agent to make would lie in the only field
  anyone can trace it by.
- feat(access): `agent.manage` is a KERNEL permission, alongside `ai.manage` and for the same
  reasons — reserved collection, kernel callables, and a screen that needs the office's own
  permission catalog. Issuing an access for oneself needs no permission at all: it grants nothing
  new. `agentGrants` joins `RESERVED_COLLECTIONS`, and its rule reads for the owner or
  `agent.manage` and writes for nobody — whoever chooses the hash chooses the token.
- fix(rules): the `agentGrants` read is gated by membership on both branches. Without it, whoever
  LEFT an office would keep reading the access they issued while a member, because the document's
  `userId` still matches their uid — the only document in the product that would answer an
  ex-member.
- fix(errors): `errorParamsOf` now also reads the params a callable sends. `HttpsError`'s third
  argument reaches the client as `details`, and nothing in the front looked there — so
  `requirePermission`'s phrase arrived on screen with a literal `{permission}` in the middle of it.
  The mechanism existed on both ends; the bridge did not.
- feat(cli/manifest): `callableFunctionNames` now also matches `onRequest`. The list means "what the
  outside world calls", not "what is an `onCall`", and an HTTP endpoint depends on public invocation
  even more than a callable does. The `functions-invoker` prerequisite text was corrected in the same
  change: it promised every callable rejects a caller with no signed-in user, which is not what an
  endpoint authenticating by token does.

#### [9.62.0] — 2026-09-09

- feat(sdk/examples): eleven authored examples, one mechanism each, joining `automation-example` in
  `extensions/examples/`. Six examples covered six of the twenty-two extension points, and nothing
  anywhere said which sixteen were missing: whoever looked for a report, a Cloud Function or a
  permission found no source and concluded the platform had none. The collection covers reports in
  all four shapes, dashboard and shell surfaces, RBAC, backend requirements, the publish/consume pair
  for cooperation, `screenPatches` with a migration, theme tokens, `auth.provider`, gestures, and
  settings. They live in `src/plugins/marketplace/examples/<name>/`, stay out of
  `MARKETPLACE_CATALOG`, and travel as source.
- feat(sdk): `exampleCoverage` — every extension point, package artifact and manifest property against
  the examples that travel, derived rather than written. Points are walked from the point arrays;
  package and manifest keys are closed by `Record<keyof …>`, so a new one does not compile until
  somebody says whether an example should show it. `scripts/exampleCoverage.test.ts` fails on any gap
  that is not in an acknowledged table, in the discipline of `VERSAO_CONFERIDA`. A third state,
  `unreachable`, names what no example could show — `ui.command`, `ui.record.action`, `data.entity`,
  `data.lookup`, `data.service`, `report.definition`, `manifest.permissions` and `manifest.lifecycle`
  — and says the road that exists instead, so an author reads a redirection rather than a silence.
- feat(sdk/mcp): `microteia://example-coverage` serves that report from the installation, compiling
  the examples on the spot. `AGENTS.md` and `AUTHORING.md` point at it before concluding that
  something cannot be done here.
- feat(sdk): `themeContribution` joins the barrel. Its sibling `themeTokensContribution` was already
  there and the asymmetry was an oversight, not a decision: `theme.definition` is pure metadata, so
  any package may contribute it, and only the constructor failed to cross. Authoring-only, so
  `KERNEL_VERSION` does not move.
- fix(cli/pack): reading-only examples are excluded from the first-party backend accounting.
  `extension-templates/` now holds two kinds of package with the same shape and different owners, and
  the baseline is derived as `all functions − claimed`: the first example to teach Cloud Functions
  would have aborted every publish, and a claimed name would have been taken out of the kernel
  baseline by a template. `firstPartyTemplates` is the single door, and `backendShape.test.ts` reads
  through it — it had its own copy of the directory read, which is how a gate starts approving what it
  exists to refuse.
- feat(build): `tsconfig.extbackend.json` type-checks the Cloud Function source of an example against
  the generated `microteia-office.d.ts` and the real `firebase-functions`, and `npm run typecheck`
  runs it. It nearly did not exist: adding `firebase-functions` to the root hit a peer conflict — the
  root carries `firebase-admin ^14` and the 6 series accepted up to 13 — and the easy way out was to
  leave the source outside the gate with a note saying the office checks it. That is the debt code in
  a template literal was: eight wrong declarations in the curated API lived for years that way, and
  what found them was putting the file under `tsc`. `firebase-functions@^7.3.2` widened its peer to
  `^14`, which is the fix. The project is STRICTER than the `tsconfig.json` seeded in the office
  (which ships `noImplicitAny` and `strictNullChecks` off), so what passes here passes there;
  `skipLibCheck` is on, and for the opposite reason to `tsconfig.extsrc.json` — there the library is
  our own contract, here it is the third-party tree `firebase-functions` drags along.
- fix(cli/vendor): `stageExamples` copies `functions/` and `scripts/` beside `views/`, and
  `rewriteImports` sends the node-only modules to `@microteia/sdk/node` rather than to the isomorphic
  barrel, where `transpileScriptSource` deliberately is not.
- fix(cli/vendor): `MICROTEIA.md` derives its build command from the examples actually present. It
  named `examples/pessoa`, which left the repository with the office extensions.
- test(marketplace): the source-language sweep covers `automation-example` and the whole collection,
  and stops reporting three families of false positive — a chart's `category`, the `value` of an
  `InputMapping` or a condition, and the `value` of a parameter option, all of which are keys rather
  than text. Its floor of ten texts per package became one per package plus ten times the count over
  the set, so a small example is not refused for being small.

#### [9.61.0] — 2026-09-09

- feat(report): `dataset.includeWhen` — an expression evaluated over each row, and the row enters the
  report when it answers true. `dataset.where` compares one path with one value, which is what makes
  it cheap: an equality goes down to Firestore and the scan stays index-free. This is the other half,
  the question no list of predicates writes — two fields compared with each other, an arithmetic
  check, a date read against today, an OR between two ANDs. Same language as an action's `hiddenWhen`
  and a field's `aggregation.filter`, same function catalogue. It lives in `dataset` on purpose: a
  kernel that cannot execute it refuses the report by the name of the token instead of summing the
  very rows it would exclude. `dataset.includeWhen` joins `REPORT_CAPABILITIES`, and `KERNEL_VERSION`
  goes to `2.18.0`.
- feat(report): the paths an expression names join `reportPaths`, so they are hydrated AND charged by
  `requireReportCollections`. `client.city` in an expression asks for the read of the pointed
  collection exactly as grouping by it would — a report cannot reach a collection through an
  expression that a dimension could not reach.
- feat(report): `reportRowScope` builds the evaluation scope from the paths the expression itself
  names, so every name it uses exists and is `null` when the record has no value for it. `expr-eval`
  throws on a name that is not in scope and a field nobody filled in does not exist in the Firestore
  document: spreading the raw row would have broken the expression on half the records of a
  half-filled collection, and the result would have been a smaller number under the same label.
- feat(report): a failed expression refuses the REPORT, not the row. `filterReportRows` returns an
  outcome rather than a list, which is why it sits between the scan and the aggregation in
  `runReportQuery` instead of inside `aggregateReportRows`. There is no conservative fallback here:
  `false` gives a smaller total and `true` a bigger one, both silently. Syntax is refused earlier, in
  `validateReportSpecShape` — the only check on the expression that needs no schema, and therefore the
  only one `microteia pack` can make.
- fix(report): `WorkflowContext.actor.permissions` was `[]` in the report callable, so `hasPermission`
  answered no to everything. `requireReportCollections` now returns the granted set — the same read
  that just authorized, with no second trip to the member document — and the callable puts it on the
  actor. In a `hiddenWhen` an empty actor is a button that disappears; in a row filter it is a line
  that leaves the count.
- feat(report/design): the designer gained the expression editor, with variables derived from the same
  `pathOptions` that feed the field selectors. A reference is offered through the record it points at
  (`client.id`) and never through the raw path: hydration replaces the id with the whole record, so
  comparing the raw path with an id finds nothing — and the symptom would be an empty report over a
  full collection.
- feat(schema): `extractFieldExpressionPaths` and `fieldExpressionSyntaxError` in `fieldExpression.ts`.
  The first answers what DATA an expression reaches, whole paths included — a different question from
  `extractFieldExpressionDependencies`, which answers which scope KEYS it depends on. Both use the
  parser that evaluates: in a parser without the functions registered, every function name comes out
  looking like a field, and each one would become a path to hydrate and a collection to charge.

#### [9.60.1] — 2026-09-07

- fix(sdk/mcp): an artifact's NAME reaches the author, not its message key. `exportedSurface` and the
  cross-reference gate are domain functions: they return the artifact as it stands, because they run
  where there is no language — and `name: message('flow.notify')` is exactly how a first-party
  extension is written. So `list_referenceable`, `microteia://workspace/plugins` and the `check`
  report answered `@com.example.utils/script.normalize` to whoever asked for the script's name, having
  written the phrase themselves minutes earlier. `packageText(pkg)` in `messages.ts` is now the single
  door — the expression was being rebuilt in four places — and the workspace catalog resolves the
  surface once per package, at collection time, rather than leaving each of its two readers to
  remember. The installation snapshot is untouched: it carries no catalog, so there is nothing there
  to resolve with, and claiming otherwise would be worse than leaving it.

- fix(sdk/mcp): the cross-reference report says WHICH step. `RefOrigin.origin` may carry a parameter —
  the step origin is `step "{step}" of automation` — and it was being resolved with none, printing the
  placeholder raw. The kernel's own refusal has always passed `step` as a sibling param (`refusal` in
  `pluginReferences.ts`); this now does the same. A reference written inside a step is precisely the
  case where the author needs to know which one, in a flow with two branches of five.

#### [9.60.0] — 2026-09-07

- feat(sdk/mcp): `describe_extension` and the resource `microteia://examples`. "How is X done?" had no
  answer: what an agent could see of an extension was id, version and problems, so it opened six
  500-line `plugin.ts` files and inferred. The tool projects the COMPILED package — contributions
  grouped by point, extension points declared for others, screens with their collections and fields,
  option lists, flows, actions, scripts, reports, code views, `startup`, migrations, exported surface,
  declared dependencies, what it demands of the Firebase project, and whether it would install — with
  a `detail` flag because the full projection of one example runs past two hundred lines of JSON. Text
  is resolved through the catalog the package itself carries (`describeWith`), including the names in
  `exportedSurface`, which is a domain function and returns message references as they are. Nothing in
  the answer is prose written beside the code, so nothing in it can drift from the code. The resource
  is the question that comes BEFORE it — which folder to open —, and it carries the single sentence no
  package answers: which mechanism each example is the best one to read for (`exampleNotes.ts`, in the
  SDK because text describing what the kernel does travels with the kernel; `scripts/exampleNotes.test.ts`
  pairs it against the packer's list in both directions, since a seventh example would otherwise ship
  noteless without failing anything). Both are announced in `AGENTS.md` and `AUTHORING.md`, which the
  URI test already forced.

- fix(sdk/mcp): `examples/` stops being read as this organization's authorship. The first-party
  extensions the `sync` copies into `extensions/examples/` sat inside the authoring directory, so both
  `plugin.ts` sweeps — `mcp.ts` and `workspaceCatalog.ts` — picked them up. The result was not a gap
  but wrong attribution: `list_workspace_plugins` announced six packages as "authored here" that
  nobody there wrote, `list_referenceable` answered for an installed extension with the EXAMPLE's
  surface, and, through the `workspace wins` precedence, a collection declared by an example DISCARDED
  the organization's real screen coming from the installation snapshot — the one thing that
  precedence exists to prevent. New `workspacePlugins.ts` owns the directory name and the split, and
  both sweeps now go through it; the two hand-written walkers are gone. An example is no longer
  compiled by the catalog at all, so it got cheaper too. It is still ANNOUNCED, with its path, in every
  answer that carries provenance and in `workspace_info.examples`: a directory holding only examples
  must not look empty. A qualified reference whose owner is only an example is now answered by the
  snapshot instead — `unverifiable` without one, `absent-there` when one exists and does not list the
  owner — because whether the organization runs a first-party extension is the snapshot's to say, and
  an example answering for it fabricates both the approval and the refusal.

#### [9.59.0] — 2026-09-07

- feat(admin): the unread-critical audit badge reaches the top bar. It existed only on the sidebar
  `audit-logs` nav item, so a collapsed sidebar hid it entirely. As with the extension-update
  shortcut, the top-bar one only EXISTS while the count is above zero — the sidebar keeps its item
  visible for free because the item lives in a list, and a permanent top-bar icon would charge
  attention daily for something usually at zero. No permission check is duplicated here:
  `AuditLogAlertStore` already returns zero without `audit.read`. Opening the screen still clears it,
  which is what separates it from the extension shortcut — one is news, the other is a pending action.

#### [9.58.0] — 2026-09-07

- feat(marketplace): pending extension updates are now announced outside the Extensions screen. A new
  `hasExtensionUpdate` domain rule and the `useExtensionUpdates` hook derive, from the three sources
  already provided above the layout (installed copies, private authoring, approved public catalog),
  which installed copies have an update waiting and how many of those are IN USE (installed and
  active). The count reaches the user-menu item for Extensions (plus a dot on the avatar trigger, since
  that menu lives closed) and a top-bar shortcut that exists only while there is something to update.
  Unlike the audit badge, it is not dismissed by opening the screen: it clears when the last update is
  applied, because what it counts is a pending action, not a piece of news.
- feat(marketplace): the Extensions screen enters filtered by `update: yes` when an update is waiting,
  and unfiltered when none is — decided once, when the three sources finish loading, so that applying
  the last update never pulls the filter out from under whoever is looking at it.
- refactor(marketplace): `Marketplace.viewmodel` stopped computing `updateAvailable` inline and reads
  it from the same set that feeds the badges. A number that disagreed with what the row shows would be
  worse than no number.

#### [9.57.1] — 2026-09-06

- docs(sdk/authoring): the reports section of AUTHORING.md carries the grouped list, the fold table
  that separates GROUPING from SHOWING, and what each fold does with the dimensions that are not
  levels. It described only what existed before `9.56.0`, so an agent reading it answered "what each
  customer owes" with a `summary`, which is the other question.
- docs(sdk/authoring): the chart paragraph says a chart plots GROUPS — one point per member of one
  `groupBy` / `rows` level — so a `summary`, a `matrix` and a `tabular` WITH `groupBy` all draw and a
  plain list does not. Declaring one on a plain list is warned, not rendered as an empty frame.
- feat(sdk/mcp): `list_report_options` (`microteia://reports/options`) serves the folds, chart kinds,
  granularities, measure ops and capability tokens THIS kernel executes, derived rather than written.
  The fold notes are paired with `REPORT_SHAPE_KINDS` and a test refuses a fold without one — the same
  rule that keeps every other generated assertion about the kernel derived.

#### [9.57.0] — 2026-09-06

- fix(reports/design): `summary` and `matrix` consumed the WHOLE dimension list as levels — the other
  half of the defect `9.56.0` fixed for `tabular`. Ten fields declared to be columns became ten indent
  levels in a single column, and switching shape made them vanish without a word. The draft now holds
  `groupDimensions: string[]`, picked in one `MultiSearchSelect` shared by all three shapes: the
  chosen order is the level order, `tabular` puts the rest in `columns`, `summary` makes them
  `groupBy`, `matrix` makes them `rows` minus the column dimension.
- feat(reports): `shape.fields-unused` warns, by key, for every declared dimension the shape shows
  nowhere. The number stays right, so it degrades — but silence there read as lost data.
- fix(reports): `summary` with an empty `groupBy` is refused by name. `buildTree` has nothing to walk,
  and the report rendered "no data" over a full collection — the symptom that most looks like a data
  defect.

#### [9.56.0] — 2026-09-06

- feat(reports): `ReportTabularShape` gains `groupBy?: ReportGroupLevel[]` — the grouped list, the
  hole between the two shapes that existed. A `tabular` result showed the records and never gathered
  them; a `summary` gathered them and never showed them. Whoever wanted "what each client owes", and
  not "how much", switched to `summary` and lost the columns: every dimension became an indent level,
  one line per column. The aggregator now emits the group tree with the leaf records on
  `ReportRow.records`, and the table draws a band per group, its records, and the group total. Array
  from day one because `buildTree` already walks N levels — closing it at one would have cost a second
  format later, over `.json` already written in the office.
- feat(reports): capability `shape.tabular.group`, derived by `deriveReportRequires` and warned by
  name on a kernel that lacks it. Without a token of its own, an older kernel would draw the whole
  list flat, with the right total, and nothing on screen saying the groups were gone.
- feat(reports/design): the fold picker gains "Group the lines by" for the list shape, and the field
  that groups leaves `shape.columns` — the same rule the pivot already applies to its column
  dimension. `tabularShapeOf` is pure and exported: that removal is the decision the defect turned on.
- fix(reports/design): section labels said the opposite of what they did. `design.dimensions` was
  "Groupings" while, in a list, it is the columns; `design.shape` was "Fold". Each shape's label now
  states what it delivers, and a new report defaults to `tabular`.
- feat(reports): the chart accepts a grouped list — `categoryDepth` reads `groupBy` on both shapes,
  and `chart.shape.tabular` only warns when there is no grouping at all.
- feat(reports/csv): a grouped list exports flat, the group value repeated in a leading column. A band
  or a subtotal inside the file is text that breaks `SUM` over every column below it.

#### [9.55.1] — 2026-09-06

- fix(reports): the chart is drawn again. `ReportChart` read the grouped rows, but a `tabular` result
  carries its data in `records` and always returns `rows: []` — so a chart on a plain list rendered an
  empty frame beside a full table, with nothing on screen saying why. `validateReportSpec` now warns
  on that pairing, through the warning path the report screen already renders.
- fix(reports): `presentation.chart.category` stopped being read and ignored. The axis was always the
  innermost grouping level, so picking the outer one of two changed nothing. Points now come from the
  rows of the level the chart names — the same subtotal rows the backend already returns.
- fix(reports): nothing to draw no longer draws a frame. No points, no series, or a mark this kernel
  does not know now yields `mark: null`, which is what the degradation contract already promised: the
  chart disappears and the table keeps showing the same data.
- fix(reports): `presentation.chart.splitBy` was a silent no-op. `deriveReportRequires` now emits
  `presentation.chart.split`, a token `REPORT_CAPABILITIES` does not hold, which puts it on the same
  warning path as every other property the contract foresees and this kernel does not yet execute.

#### [9.55.0] — 2026-09-06

- fix(reports): `aggregateReportRows` emits `records` with dates as ISO text. A date field is stored as a Timestamp and read back as a `Date`, and the callable's response encoder turns a `Date` into `{}` — `Object.entries` of a date has no entry at all. The date column of a plain list reached the screen as `[object Object]`: the whole value lost in transit, with nothing on screen saying it was. It is done in the aggregation and not in the Cloud Function because the same pure function answers the executor and the authoring preview, and both cross the same wire.
- feat(reports): `useReportCellText` cuts a date by the SAME bucket the aggregator uses when the dimension declares one, and formats it in the locale in force when it does not. A plain list is the only fold whose cell comes from the record instead of the aggregator, so the granularity picked in the design screen had no effect anywhere in the report it described.
- fix(reports): "Exact value" REMOVES `dimension.granularity` instead of writing it as `undefined`. The `spec` is stored verbatim, and an `undefined` inside it made Firestore refuse the whole write — `Unsupported field value: undefined`, said with the SDK's words about a document the author never saw. `FirebaseReportDefinitionRepository.stripUndefined` now walks DEEP for the same reason: the `spec` is a nested object, and a shallow pass only ever covered the top level.
- fix(reports): the granularity picker is shown when the FIELD is a date, not when a bucket is already chosen. Picking "Exact value" made the control disappear, and with it the way back to "By month".
- fix(reports): the design tab remembers the report it just created. The create tab carries no key in its name, so `editing` stayed empty after the first save and each following Save created ANOTHER report — and a third, and a fourth. From the second Save on, the tab edits.
- feat(reports): the groupings can be reordered — drag handle or arrows, the Form Design gesture. Their order is the order of the summary levels and of the plain list's columns; without it, swapping two meant removing both and declaring them again.
- fix(reports): `ItemLabel` and `ItemMeta` are blocks. As inline spans they touched with no space between them — "Tipo" and "é" reached the screen as "Tipoé", which nobody reads as two things.

#### [9.54.0] — 2026-09-05

- feat(reports): `deriveReportRequires` now emits a token for every property the contract has and this version does not act on — `shape.limit`, `presentation.fields`, `presentation.drilldown`, `export.filename`, `dimension.sort.by` and the `control`/`required`/`default` of a prompt. They were silent no-ops: the author declared one, nothing happened, and nothing anywhere said why. The token puts each on the SAME warning path the capability gate already had, and the day one is executed is the day it enters `REPORT_CAPABILITIES` and the warning goes away on its own. Nothing is refused by this — `reportCapabilitySeverity` still refuses only under `dataset.` and `measure.`.
- fix(reports): a dimension `limit` marks the result PARTIAL. `sortedChildren` sliced the members and said nothing, while the grand total kept summing every scanned row — so the visible rows did not add up to their own total, which is the one failure a reader cannot catch. It now reports what it dropped, and that reaches the same partial notice the scan ceiling already used, on screen, in the CSV and on the printed page. The `ReportDimension.limit` comment promised a residual bucket that never existed; it now describes what the code does.
- feat(marketplace): the package gate refuses a `spec.requires` that OMITS what the spec uses (`@core.marketplace/issue.report.requires`). `unsupportedReportCapabilities` prefers a declared `requires` over the derivation, so a short one was the only way to make a kernel run a report without the feature it lacks instead of refusing it by name. A token too MANY is not a defect and still passes: that is a package written with an SDK that derives more than this kernel, and the path for it already exists. The `ReportSpec.requires` comment claimed `microteia pack` enforced this; it did not, and now `packageIssues` — and therefore the extension build and `validate_plugin` — does.
- fix(sdk/mcp): `sdkDeclaration` walks past a bare re-export. `ReportModuleTemplate` lives in `Report.d.ts` and `MarketplacePlugin.d.ts` re-exports it, so `describe_sdk_type ReportModuleTemplate` answered `= ReportModuleTemplateType` — an alias to a symbol the barrel does not publish, and so with no expansion possible. Whoever was about to declare a report in a package could not learn that it takes `templateId`, `key`, `title` and `origin`.
- docs(sdk): AUTHORING.md §6 no longer states that the Widget DSL cannot reach data. The `report` node has been the one binding since it shipped, and the closing paragraph forbade in writing the very thing that makes a declarative dashboard possible; it now shows the grid of `report` nodes and says the key is not rewritten on installation.
- docs(sdk): AUTHORING.md §11 gains what an author could not learn anywhere — the module envelope, `presentation.prompts` (the reader's filter, which worked and was documented nowhere), the tabular/matrix asymmetry (`columns` is an array of strings in one and of levels in the other), `format`, `sort`, `limit`, `emptyCell`, the chart's `category`/`series`/`splitBy`/`stacked`, `access.permission`, the refusal list, and why `requires` is never written by hand.
- docs(sdk/mcp): the `model_business_rule` prompt names the report among what the model's vocabulary does not reach, reading the note from `coverageGaps()` instead of restating it. The question arrives disguised as a rule — "how much did we sell by month" comes in the same sentence as the structure — and the guided path ended at screens and automation, which is where it was being translated into a screen.

#### [9.53.0] — 2026-09-05

- feat(schema): a path may now cross a list of references by FIELD NAME, and what it reads there is one value per pointee. `stepCursor` in `pathResolver.ts` used to refuse it with `path.is-list` and demand a fixed position (`activePoleIds.0.cpf`), which answers for one item and ignores the rest — so no report grouping, fixed filter or reader prompt could ask "the CPF of the active pole", the most ordinary question there is about a multi reference. The hop is unchanged: whoever hydrates does not need to know the path went further. `PathNode` carries `list: true` for what was harvested from a list, and `suggestNextSegments` offers the item's fields beside the index instead of only the index. The kernel contract goes to 2.16.0: additive, and an extension can now declare such a path.
- feat(schema): `getValueAtPath` projects a key segment over an ARRAY value, flattening one level per step and dropping the absent — an empty projection is absence of value, not the empty value, which is what keeps `exists` answering no. A list of records is what hydration puts under a multi reference, so this is the read side of the same capability; `evaluateResolvedPredicate` already compared list against value by pertinence, so a filter over the projected path matches the row where ANY pointee satisfies it.
- fix(reports): `applyAggregationOp` enters a list-valued measure through its ITEMS. `Number([10, 20])` is `NaN`, which fell out in the filtering and made `sum` answer 0 — a number with the same face as a legitimate total. `count` still counts ROWS, not items.
- fix(query): `contains` has two readings and the VALUE decides which, in `predicateMatch.ts`: substring between two TEXTS, and item by item wherever there is a list. Comparing the list by exact equality was right while the only reachable list was of ids or options — a path across a multi reference now harvests one text per pointee (an email, a name), and there "contains alex" has to find `alexnaldo.santos@gmail.com`. It asked for membership between whole texts in a field where nobody types the whole text, and the report came back empty, which reads as "there is nothing like that". A record-shaped item still falls to `looseEquals` and is matched by id, so `contains` over a list of references stays pertinence and no id is ever matched by substring.
- fix(query): `contains` no longer distinguishes case, which is what the automation condition (`ConditionEvaluator`) has always meant by "contains". Two answers to the same word were two truths about the same filter. It only ever matches MORE than before, never fewer.
- fix(reports): `bucketDateValue` buckets a LIST of dates item by item and composes the key, the same way `scalarKey` already composes the key of a raw list. Without it the bucket did not apply and the grouping fell back to the raw value: the whole date where the month was asked for, with nothing on screen saying the cut had been ignored.

#### [9.52.0] — 2026-09-05

- feat(reports): `filterFieldOf` makes a `reference` or `select` filter a MULTIPLE choice regardless of the field's own `multi`, which is the rule the listing's filter bar already follows. A filter asks "is it among these"; making the same person learn one gesture in the listing and another in the report bought nothing.
- fix(query): the pushdown decision is now derived from the field, in `documentFieldPath`, and it is the single place where the engine splits what Firestore answers from what it filters in memory — the same split for the report, the workflow step and the Script, since all three funnel through `runWorkflowQuery`. A TERMINAL reference is a document field like any other (the document keeps the id; hydration puts the record there afterwards, in memory), and treating it as a deep path pushed into the scan ceiling a question the database answers by itself. Navigated by the pointee's name (`cliente` for `clienteId`), what goes down is the key the document actually keeps.
- fix(query): only EQUALITY goes down, and that is the index-free strategy stated: a conjunction of equalities is served by merging single-field indexes, which every collection gets for free. A tenant collection is born at runtime and can have no composite index declared, so an `in` or an `array-contains` beside another filter would make the query FAIL asking for an index nobody can create. Filtering in memory costs scan; asking for an index that cannot exist costs the whole report.

#### [9.51.3] — 2026-09-05

- fix(query): a predicate over a REFERENCE matched nothing — neither single nor multi, `eq` nor `contains`. `runWorkflowQuery` hydrates the row before evaluating in-memory predicates, so the value under the path is the pointed RECORD, and the comparison was record-object against the id the filter carried. `looseEquals` in `predicateMatch.ts` now takes the `id` of a record-shaped value, which is the same identity rule `aggregateRows` uses for group keys. This was never report-only: the workflow "find records" step filtered by a reference the same way.
- fix(query): equality against a LIST-valued field is pertinence, not identity. `evaluateResolvedPredicate` treats `eq`/`neq` with an array on either side as "any of" — a field of many has no value, it has a list, and comparing the whole list to one value is a question that can never be answered yes. `in` and `contains` route through the same helper.
- fix(query): a `stringArray` path, or a resolved value that is an array, no longer becomes a Firestore equality filter. There `==` over an array field compares the WHOLE array, so a multi-select filter came back empty with no error and nothing to distinguish it from "nobody matches". These join the deep path and the derived field in memory.
- feat(reports): `filterFieldOf` preserves the field's `multi` instead of forcing `false`, and `filterValueOf` / `filterLiteralOf` carry the chosen ids as a LIST across the text the screen transports. The control let you pick one person for a pole the office declared as many, and the literal `"p1,p2"` was the id of nobody.
- fix(reports): `promptPredicates` skips an empty list the same way it skips an empty string — no one chosen is the same as not asking, and the predicate it built matched nothing.

#### [9.51.2] — 2026-09-05

- fix(reports): a report row arrives HYDRATED — where the document keeps a reference id, the row carries the referenced record itself, and a multi reference carries the list of them. The simple list wrote every cell through `String`, so a reference column read `[object Object]`, and one `[object Object]` per pointee on a multi reference: the whole datum lost with nothing on screen saying it was lost. `presentation/shared/report/useReportCellText.ts` names a hydrated record by the TITLE FIELD of its screen — the same name the listing, the search and a mention show — reading it from what already came hydrated, so no second query and no dependency on the pointed collection being loaded in this screen. `ReportTable` and `useReportCsv` both go through it, because the table and the spreadsheet cannot disagree about the same cell.
- fix(reports): `scalarKey` in `aggregateRows` now takes the `id` of a record-shaped value as the group key. `String(record)` made every pointee collapse into `[object Object]`: one group for all of them in a `summary` or `matrix`, and a `count distinct` over a reference answering 1 — a number that is wrong without looking wrong. The raw key is what `useReportGroupLabels` was documented to receive all along.

#### [9.51.1] — 2026-09-05

- fix(reports/csv): `useReportCsv` read `result.rows` for every shape, but a `tabular` fold returns `rows: []` and puts the data in `records` — the export wrote a header and nothing else while the table on screen showed the whole collection. It now reads `records` and resolves each column by its dimension path, the same way `ReportTable` already did.
- feat(reports/csv): `ReportCsvTable` gained `totalsHeader`, for the fold whose totals do not share the body's columns. The simple list shows record fields in the body and aggregates in the total; emitted on the same columns, the sum landed under "Client" — a plausible number read as something else. With a header of its own it becomes a block after a blank line.

#### [9.51.0] — 2026-09-04

- feat(reports): a filter value is asked for in the SHAPE OF THE FIELD, in the design screen and in the reader's prompt bar alike. `useReportPathOptions` now carries the `FieldDefinition` behind each path, and both screens render it through `ui/FieldInput` — the same schema-driven atom the record form uses, so a date is picked in the date control, a lookup in its own list and a reference in the record it points at. A free text box there charged whoever filters with what the product already knows: the referenced record's id, the exact wording of an option, the exact format of a date.
- feat(reports): `presentation/shared/report/reportFilterFields.ts` holds the two translations that keep the ends tied — `filterFieldOf` (the field seen as a filter: one value, nothing required, no seeded default, no generated code, no new option written into the office's list) and `filterTextOf` / `filterValueOf` (the spec's `Literal` is TEXT; the control speaks number and boolean). `fieldAtPath` moved here from `useReportGroupLabels`, which now imports it.
- feat(reports): a stored filter value reads back through `useReportValueLabel`, which is the listing's own `displayValue` — the report and the record card say the SAME word about the same datum.
- fix(reports): a filter's `Literal` is written in the FIELD'S type, not as text (`filterLiteralOf`). A shallow `eq` reaches Firestore with the value exactly as the spec holds it, and the string `"true"` never meets the boolean `true` stored in the document — the filter did not fail, it found nothing, silently. Dates stay ISO text: that is the format the whole product speaks, and an object there would not survive the report's `.json`.
- feat(ui): `ui/FieldFilterInput` — the filter-value control. It is `FieldInput` with one divergence, and the divergence belongs to the QUESTION, not to the control: a record's boolean is yes or no and a checkbox says both, while a filter has a third answer — "do not filter by this" — that an unchecked box cannot tell apart from "no". So a boolean filter is a three-state list.
- fix(reports): a report with `presentation.prompts` no longer runs before it is answered. `runWith(values)` takes the prompt values instead of capturing them, and the open-the-tab effect fires only when there is nothing to ask. The prompt values were a dependency of `run`, which was a dependency of the effect: the report was re-run on the server on every keystroke, and the answer that arrived last was not always the last question's. The first run also spent the whole scan showing the year to someone who opened the report to see one month.
- feat(reports): the prompt bar's "Apply" and "Clear" became the run and clear icons the rest of the product already uses (`prompts.apply` → `prompts.run`); `design.filter-value` dropped with the free text box it labelled.

#### [9.50.0] — 2026-09-04

- feat(reports): declarative reports, as three separable layers — `dataset` (the semantic layer: dimensions and measures), `shape` (the fold: tabular, grouped, crossed) and `presentation` (chart, prompts, export). The spine is fixed and the variation lives inside each layer, which is what makes the compatibility policy derivable from POSITION: unknown token under `presentation` is ignored, under `shape` degrades with a visible warning, under `dataset` refuses the report by name. Silence is only allowed where the loss can be seen — dropping a measure would show a different number under the same label.
- feat(reports): new extension point `report.definition`, metadata-pure or `code`-backed, plus `MarketplacePlugin.reports`. `KERNEL_VERSION` 2.14.0 → 2.15.0: new shape of installed package.
- feat(reports): callable `runReport` aggregates on the server and returns only the aggregate. It charges, per collection, the read permission of everything the report touches — including collections reached through a foreign key, derived from the hydration plan so a package cannot hide a hop by declaring less. The workflow query executor does not do this because it runs as an automation actor; a report runs as the USER.
- feat(reports): `@microteia/report` on the curated host API — the same components the declarative renderer composes, so writing a report in code is composition, not reimplementation. Code replaces the presentation of a report, never its dataset: numbers still arrive through the callable.
- feat(widget-dsl): node `report`, which names a report from the catalogue. This is the data binding v1 lacked, and the indirection is deliberate: an inline query would put aggregation, permission and scan limits inside a layout DSL.
- feat(query): `runWorkflowQuery` takes caller-supplied limits (today's values remain the default) and reports `scanned`/`complete`. The second half fixes a latent defect that already affected the "Find Records" step: a flow scanning 5000 records saw 300 and had no way to know.
- refactor(schema): the predicate evaluator moved out of the workflow executor into `domain/schema/predicateMatch.ts`, shared. Two copies would have diverged on the first new operator, and the divergence would read as "the flow refuses, the report accepts".
- feat(reports): the authoring screen closed its three gaps — a fixed `dataset.where`, the declared `presentation.chart`, and `presentation.prompts`. `presentation` is only written when there is something in it: an empty object would be noise in the `.json` and one more layer for whoever reads the report. A date filter uses `DateInput`, like everywhere else in the product.
- feat(reports): the reader's filters got their form, on the report itself. Only what was filled in is sent — an empty filter narrows nothing, and sending it empty would make the server compare against the empty string, which is a different question. The bar carries `data-print-hide`: on paper what counts is the result.
- feat(reports): reports reached the command palette. The search compares the RESOLVED title, not the declared key — a report from an extension names itself `@ns/key`, and matching against that left it unreachable. It hides what the person could not run: the same question the list and the server ask.
- feat(reports): the tab now carries the report's name, in both reading and authoring. "Report" is the name of the type, and three tabs called that do not tell each other apart.
- fix(reports): the header buttons used the wrong colours. Delete painted its icon with `surface` over red — dark on dark — where the house style is `white`, and save had no `success` hover at all. Both now match every other editing screen.
- fix(reports): the measure key for a count was recorded as `contagem` — our own word inside an IDENTIFIER, which is what travels in an exported `.json` and what the fold references. A key is not translated; the label is. It is now `count`, kept in a named constant so the next hand does not translate it again.
- fix(reports): the report list drew itself its own way — cards with a text button, no filter, and "New report" spelled out. It now follows every other listing in the product: `+` in the header, `CompositeFilter` with saved filters, one row per report with edit and delete on it. A listing that invents its own gestures teaches something that holds nowhere else, and whoever uses it pays that every day.
- fix(reports): the authoring screen's actions moved from the form footer to the top-right of the header, where every editing screen in the product keeps them.
- feat(reports): a report can now be edited and deleted. The authoring page took a report key in the tab (`report-design:<key>`), the list gained "Edit", and deleting asks first. A report from an extension is read-only there, and says why: a spec is a single statement, and half from the package with half from the office would give a number nobody wrote.
- fix(reports): saving a second report with the same name answered `artifact.id-taken`. The name is the office's and the key is the system's — the key now steps aside. Two defects in one: the message was also shown RAW, because a `LocalizedError` carries the reference in `message` and nothing resolved it.
- fix(reports): the authoring screen showed `core.reports/design.remove` where the remove button should be — the key was used and never added to the catalogue.
- fix(reports): a `tabular` report always drew "no data" over a full collection. The aggregator returns the RECORDS in `records` for that fold — there are no groups in a plain list — and the table read `rows` in both cases. `ReportTable` now renders one column per declared dimension, reading each value by path, and puts the totals on a single footer line: in a plain list the body shows fields and the total shows aggregates, so aligning them by column produced a footer wider than the table.
- fix(reports): a report with no figure, or a plain list with no column, is now refused by name. Both were accepted in silence, so the authoring screen's save button sat disabled with nothing explaining why — a refusal without a reason.
- fix(reports): the report list gained "New report". The authoring page existed as a contribution and nothing pointed at it: the only way in was the command palette.
- feat(sdk): AUTHORING.md gained the reports section — the artifact in the package, the three layers, the degradation table, and what the author does NOT control (permission per collection, the scan ceiling). The closed vocabulary in it is DERIVED from the kernel constants, not prose, and `templates.test.ts` guards both directions: nothing missing, nothing invented.
- fix(sdk): `packageIssues` now validates the shape of every report in a package — the third gate of the same validator, next to the authoring screen and the callable. Without it a report citing a dimension it does not declare travelled inside the package and failed only in the client's organization, as a report that does not open with nothing saying why.
- fix(sdk): `CORE_BUNDLES` was missing `core.reports`, so `list_extension_points` answered with the raw `@core.reports/point.definition.title` — the exact defect the comment above it records as having already happened with `core.data`.
- fix(sdk): the aggregate list of extension points was hand-written in three files, and the one in `mcp.ts` was missing `AUTH_EXTENSION_POINTS` — the authoring agent never saw `auth.provider`, and nothing failed. It is now derived from `KERNEL_EXTENSION_POINTS`, with a test that scans the sources and rejects any family nobody aggregated.
- fix(query): `fetchByIds` batches `getAll` in chunks of 300. A report scanning 2000 rows with one reference would have sent 2000 refs in a single call, well past what gRPC accepts, and the whole call would fail.
- chore(rules): collection `reports` added to `RESERVED_COLLECTIONS`, to the wildcard denylist and to a named `match` — the three places `scripts/reservedCollections.test.ts` guards. Needs `npm run deploy:rules`.

#### [9.49.0] — 2026-09-03

- feat(ui/SearchSelect): a reference field now offers the way to the record it points at. The optional `onOpenSelected` prop puts a discreet arrow beside the clear button and opens the referenced record in its own tab. Reaching a linked record meant leaving the form, finding the screen in the menu and searching for the record again — the field knew the id the whole time and had no way to say so.
- feat(presentation/useReferenceOpener): the resolution of "is there anywhere to go" now lives in one hook, beside `useOpenRecord` and `useOpenScreenList`. It answers with `null` unless three things hold together: the field names a collection, some screen describes that collection, and the viewer can read it — so a lookup, a free list and a reference to an uninstalled extension show nothing instead of opening a dead tab or a list the server keeps empty. The collection is also looked up by screen key, for the same reason `useReferenceOptions` does it: declarations written before `dataCollection` stored the key.
- feat(ui/MultiSearchSelect): the same `onOpenSelected`, but per PILL — two selected records are two destinations, and one arrow on the control would have had to elect one of them. The label keeps opening the list, as in `SearchSelect`: the arrow is what navigates. It reaches multi-valued reference fields and `EntityReference` parameters declared as a list; a lookup or option list references no record and shows nothing.
- feat(ui/CustomFieldsSection): `referenceOpener(field)` joins the field view model, so the shortcut reaches the standard form, the `FieldInput` atom an extension composes its own screen with, and the read-only form — where seeing the referenced record is what one wants most. `EntityReferenceControl` gained the same, which carries it to every workflow and action parameter that asks for a record.

#### [9.48.0] — 2026-09-03

- feat(license): the Terms and the Privacy Policy no longer presuppose a nationality. §11 elects the law of no country: each party complies with the legislation applicable to it, the organization answers for its own jurisdiction and for those where its users and clients are, a mandatory provision that conflicts with a clause limits that clause instead of voiding the document, and a dispute goes by preference to the domicile of the defending party. The LGPD citation and the Brazilian forum are gone — §6 now says that what data protection law requires differs between countries and that identifying which ones apply is the organization's, naming none.
- feat(license): §3 states the fact the whole document rests on and that it never said — Microteia is installed in a cloud project belonging to the organization, its own Firebase project, not in an environment the author operates. Four consequences follow in the clause: the project, its billing account, its administrative credentials and the choice of region are the organization's; every record, file, access profile, audit entry and backup is written to and stays inside that project; the author has no standing access to the installation, its data or its credentials, and depends on temporary access the organization grants when it asks for support; and availability, backup, retention, restoration and cloud cost are the operator's, under its own provider's terms.
- feat(license): §6 turns the privacy section from "what we collect" into what the architecture guarantees — nothing leaves the installation to the author, data reaches only the cloud provider hosting it and the AI, e-mail or integration services the organization configured with its own credentials, an extension's external service is authorized by installing that extension, and audit records stay inside too. The organization is named the controller, and a data-subject request is addressed to it: it is the only party with access, and the author cannot act on data it does not hold.
- feat(license): §7 splits information security into what ships (permission-based access control, isolation between tenants, server-side rules for data and files, audit trail) and the four measures only the operator can take (credentials, profile review and offboarding, assessing an extension before installing it, tested backups and applying fixes). §8 adds loss or leakage of data and the acts of the cloud and third-party services the organization contracted, and says plainly that the author does not administer the installation. §9 grants a non-exclusive, non-transferable licence to install and use the software for the organization's own operation, with no right to redistribute, sublicense or offer it as a service. §10 binds each installation to the terms that shipped with the version it runs.
- refactor(license): the key set follows the new structure — `install.*`, `privacy.item.no-collection|processing|extensions`, `privacy.controller`, `privacy.laws`, `security.item.*` and `security.note` in, and `privacy.item.account|records|email` plus `privacy.isolation` out; `License.view.tsx` gains the new section and the two lists. `locale.pt-br.license` at 1.2.0, translated clause for clause in the same commit, and `coreLicense.ts` records the distribution premise in its JSDoc so no later edit writes as if we hosted the data.

#### [9.47.0] — 2026-09-03

- fix(license): the Terms of Use and the Privacy Policy described a law-firm management product — clients, cases, deadlines, contracts, financial entries, an e-mail monitor reading court notices — none of which the kernel does: the seven office extensions left this repository in August, and the document kept promising them. Section 2 now describes the platform itself: each organization declares the application it needs (screens, collections, forms, reports, automations, access profiles) and extends it with extensions authored by itself or by third parties, with AI assisting both the authoring and the processing of what the organization submits.
- fix(license): the neighbouring clauses carried the same defect and moved with it. §4 no longer names a closed role list (`admin, lawyer, assistant, user`) — gone since authorization became per-permission — and instead binds the tenant to the access profiles it creates and to what its extensions and automations do on its behalf; §5 replaces the e-mail-monitor item with the content the organization submits to AI features, for the purpose the submitting screen, automation or extension declared; §6 says permission-based access control; §7 drops "missed procedural deadlines" and "the practice of law" and adds the behaviour of installed extensions; §8 states that a third-party extension belongs to its own author; and the contact clause no longer assigns the copyright to "the lawyer responsible".
- chore(license): `locale.pt-br.license` at 1.1.0, translated in the same commit, clause for clause — its JSDoc no longer claims the text is the original document word for word, because that claim is what would let the two drift. `LAST_UPDATED_AT` moves to 2026-09-03: the document changed, and that date is the only thing on the page that says so.

#### [9.46.0] — 2026-09-03

- feat(plugins): `manifest.category` — an optional, free-form category for an extension, `KERNEL_VERSION` at 2.14.0 (additive to the installed package's shape). Free on purpose: a closed union here would be the kernel deciding which subjects exist, and the first office with one that is not on the list would have to wait for a new core release to file its own extensions. It is text like `name` and `summary` are — literal, or a message reference resolved at render — so whoever declares a category answers for translating it, and the core catalog carries no extension vocabulary. `PLUGIN_MANIFEST_REACH` (`sdk/domain/coverage.ts`) files it as out of a model's reach, with the note that says why.
- feat(marketplace): the "All" tab gained a `CompositeFilter` — text, active/inactive, private/published, from the system, with code, part of the system, category, update available, installed or not. The list only ever grows (every builtin, every installed copy, every approved package in the public catalog), and the four tabs are coarse: finding one extension meant reading all of them. The filter lives on "All" alone because the other three tabs ARE a slice, and offering "installed: no" inside "Installed" would offer the empty set. Category options are derived from what the LISTED packages declare — never a list of ours — and the "no category" option appears only when something lacks one.
- feat(marketplace): a category filters by its resolved TEXT, not by the reference that declared it. Two extensions that both say "Integration" pointing at their own catalogues would otherwise be two identical options, each slicing half the list — and which of them a person picked would be luck. Options are indexed by label with the first reference that produced it as the value, so the token still stores the reference and survives the office changing language.
- feat(marketplace/author): the extension form writes `manifest.category`, and the row shows the resolved category beside the id.
- feat(plugins): the first-party packages declare a category, each from ITS OWN catalogue: `com.microteia.calendar` 1.3.0 (Productivity), `com.microteia.dashboard` 1.2.0 (Analytics), `com.microteia.news` 1.4.0 (Communication), `com.microteia.automation-example` 1.1.0 (Automation), and the nine theme packages `@core.theme/category.theme` (`com.microteia.theme-*` at 1.2.0). `com.microteia.brasil` 1.1.0 and `com.microteia.locale-pt-br` 1.43.0 point at `core.i18n` instead — country conventions and a translation package are kernel capabilities, and the namespace that owns the concept owns its word.
- feat(i18n): `category.theme` in `core.theme`; `category.language` and `category.localization` in `core.i18n`; `package.category` in the calendar, dashboard, news and automation-example catalogues; `filter.compose.placeholder`, `filter.search.placeholder`, `filter.visibility`, `filter.installation{,.yes,.no}`, `filter.category.none` and `author.field.category{,.placeholder}` in `core.marketplace` — every one with its pt-BR pair.
- test(plugins): `category` joins `TEXT_KEYS` in `sourceLanguagePlugins.test.ts`, so a literal category in an agnostic package fails there. It stays OUT of the ESLint property selector on purpose: outside a plugin manifest the same word names the technical grouping of automation steps (`workflowStepCatalog`), which a selector cannot tell apart.

#### [9.45.0] — 2026-09-02

- feat(automation/editor): a qualified artifact ref that does NOT resolve now says why, naming the owner extension. `SearchSelect` drew one sentence for every absence — `core.ui/reference.not-found`, "Record not found ({id})" — which is true about the local collection and irrelevant about a ref the engine resolves by owner + `sourceId`: it sends the reader looking for a document that was never there. `resolveArtifactRef` (`domain/services/artifactLookup.ts`) turns the lookup into a verdict — `found`, `unresolved`, `owner-absent`, `not-exported`, `owner-inactive`, `artifact-absent` — and `artifactRefTarget` (`presentation/shared`) turns the verdict into the sentence. `not-exported` is checked BEFORE `owner-inactive` on purpose: the owner being there and not promising that id is a fact about the ref, so turning it back on would change nothing, and sending the reader to do that first costs a wasted round trip. The reason reaches the picker through the new `orphanMessage` prop, which every other `SearchSelect` ignores.
- fix(automation/editor): re-picking the target already chosen REWROTE a qualified ref as the local document id. `pickerValue` (9.43.3) resolved the stored ref to the local id and handed that to `SearchSelect` as its value, so the option the user clicked carried the document id and `setPickerValue` saved it — silently converting the cross-extension ref into a tenant-local pointer, which is exactly what must not happen: the ref has to keep travelling literal to survive the owner being updated or reinstalled, and `pluginReferences` reads it to derive `manifest.dependencies` when the workflow is packaged again. `pickerValue` and `pickerOptions` are replaced by a single `pickerDisplay`, which keeps the STORED value on the matching option (replacing the local-id line in place, or appending it when the filter hides it) and carries the absence sentence alongside — one resolution instead of two that could disagree.
- feat(i18n): `step.target.ref.owner-absent`, `.not-exported`, `.owner-inactive` and `.artifact-absent` in `core.automation`, with the pt-BR pairs; `com.microteia.locale-pt-br` at 1.42.3.

#### [9.44.0] — 2026-09-02

- feat(automation/editor): `WorkflowStep.signature` — the free label `getStepDisplayName` puts first on the flow card — had no field in the step editor. Nothing in the tree writes it any more (the screen that did is gone), so a card showed either a label nobody could change or the technical identifier, and the identifier is the one field the form did expose — immutable after creation. `EditWorkflowStep` now edits the label in all three forms (action, condition, loop), saving into `signature`.
- refactor(automation): `WorkflowStep.name` is gone, from both copies of the entity (the backend's is hand-kept — `domain/entities/Workflow.ts` is not in `sync-schemas`). It was a second spelling of the same label that no screen, engine path, authored workflow or template ever wrote, and its only reader was the fallback line right under `signature` in `getStepDisplayName`. Keeping it meant every future decision about the label had to answer for two fields — which is what made writing the label the wrong way tempting in the first place. `stepTree.test.ts` used it as its arbitrary mutable field and now uses `signature`.
- feat(i18n): `step.label`, `step.label.hint` and `step.label.placeholder` in `core.automation`, with the pt-BR pair; `com.microteia.locale-pt-br` at 1.42.2.

#### [9.43.3] — 2026-09-02

- fix(automation/editor): the `workflow` and `script` pickers matched their option list by LOCAL id, and a step that targets another extension's artifact stores the qualified ref `<pluginId>/<sourceId>`. Nothing matched, so `SearchSelect` drew a working target as `reference.not-found`. `EditWorkflowStep.viewmodel` now exposes `pickerValue`, resolving the stored ref through `findByArtifactRef` — the same lookup the dynamic inputs and outputs already used — and `pickerOptions` takes the resolved value so an option can be appended for a target the filter would otherwise hide.
- fix(automation/editor): the callable-workflow picker offered DISABLED workflows. Every runtime path refuses one — `RunCalledWorkflowUseCase` returns `found: false`, `AIDetectWorkflowStep` reads `findEnabledByEvent` — so the editor was the only surface that let you choose a target that cannot run, and the refusal arrived only when somebody depended on it. Filtered by `enabled`, with the current selection kept in the list so a workflow disabled after being chosen still renders by name.
- fix(automation/editor): a `list` parameter of a called workflow rendered `{name} (lista)` raw in "Chamar Workflow". `flattenParameterInputs` is the only place that INVENTS a message reference (`@core.automation/output.list`), and it emitted `label` + `labelParams` for a consumer to resolve — `useStepCatalog` resolves the catalog's inputs, nothing resolved these. It now takes the label resolver and resolves its own reference; the regression test covers the list case the previous "no reference reaches the screen" test did not.
- fix(automation/engine): `call-workflow` reported only `bad-status` when the called workflow failed. The reason existed — written to the called execution's own logs — but the caller's log did not carry it, so diagnosing meant leaving the screen and matching the other workflow's execution by timestamp. `RunCalledWorkflowResult` now returns `failures` (the ERROR entries, reference and params intact) and the step replays them through `context.logger.error` before the verdict, attributed to the calling step.

#### [9.43.2] — 2026-09-02

- fix(i18n): a sentence that WRAPS a `LocalizedError` lost the params the wrapped sentence interpolates. `translate` descends only the SIBLING params the outer message received, so `t('extension.operation-failed', { detail: err.message })` resolved the nested reference and then printed `{kind}`, `{id}` and `{plugin}` raw: the refusal to install an extension whose dependency is absent named neither the missing extension nor the artifact it references. `wrappedErrorParams` (`domain/errors/LocalizedError.ts`) emits the `{detail}` and the error's own params together, so forgetting one stops being possible; applied to `extension.operation-failed`, `extension.publish-failed`, `extension.import-failed` and `author.save-failed`.
- fix(screens): deleting a screen printed the refusal REFERENCE on the banner — `NotificationBanner` renders the string it is handed, and the three `DeleteScreenDefinitionUseCase` messages reached it unresolved. Resolved with `useLabel` at the call site, as `RolesTab` already did.

#### [9.43.1] — 2026-09-01

- fix(plugins/author): the export screen picked the diagnostic sentence by the presence of `SdkIssue.ref`, not by the message. Every ref-bearing refusal — the eight of `validatePackage` and all of `workflowStepIssues` — was printed as `author.issue.external-ref`. A step missing a required input surfaced as `automation "X" references the automation "X", which belongs to another extension`: `workflowIssues` anchors its `ref` on the workflow that OWNS the defect, so origin and target were the same automation, and the step and input the real sentence names were discarded. The branch now keys on `REF_EXTERNAL_MESSAGE`, exported from `pluginReferences`, and forwards `ref.from.step` so a step-scoped origin no longer renders `{step}` raw.
- fix(i18n): `author.issue.external-ref` claimed the artifact "belongs to another extension"; `issue.ref.external` means it is neither in the package nor covered by a declared dependency, which is not the same thing. Both catalogs restated, `com.microteia.locale-pt-br` at 1.42.1.

#### [9.43.0] — 2026-09-01

- feat(access): member permissions recompose themselves when the CODE catalog changes. The four Firestore triggers wake on writes to the database — role, member, screen, extension — and cover nothing that moves in code: a new kernel version can change what a permission depends on, and no write happens to wake them. `KERNEL_CATALOG_FINGERPRINT` (`domain/schema/access/catalogFingerprint.ts`) summarizes `id` + `requires` of the kernel catalog, plus a synthetic resource that exercises the CRUD DERIVATION — so the day "create requires read" was introduced would have moved it. `MaterializeMemberPermissionsUseCase` stamps it into `permissionsCatalog` in the SAME write as `permissions`, and the stamp joins the idempotency guard; `AuthorizationStore` compares the stamp already loaded on the member document against the one in code, and calls `syncTenantPermissions` once per office per session. The first person to open the app after an upgrade heals the whole office.
- feat(access): `syncTenantPermissions` asks for MEMBERSHIP, not permission. Whoever holds the stale set is precisely who may not have `roles.manage`, and requiring it left out the case the function exists for. The operation grants nothing — it recomposes what the roles already declare — and a fingerprint guard reads the caller's own member document first, so a repeated call costs one read.
- fix(access): the "Recalculate permissions" button is gone, with its five message keys in both catalogs. It required someone in the office to know that a kernel upgrade happened, that the upgrade touched a dependency, and that the consequence was a button on a profiles tab. Nobody knows all three, and the symptom is silent: the screen recomputes locally and keeps being right, only the field the Security Rules read goes stale.
- fix(access): a resource label travels with its params. `PermissionResource` gained `nameParams` and the catalog now holds `resourceLabels` (`ResourceLabel`) instead of `resourceNames`. `AuthorizationStore` mapped `{ id, name: lookup.label }` and dropped `labelParams`, so `@core.data/lookup.qualified` reached the roles screen with nothing to interpolate and rendered as the template itself — uppercased by the group header style, in every language. Two more sources were latent behind the same drop: a screen's `tagCollection` and `BUILTIN_TAG_LISTS`, both `@core.records/tag-list.of` with `{name}`.
- fix(domain): `DerivedCollection` declared `{ collection, label }` while `screenTagCollections` actually returned `labelParams`. The type lied, the field survived at run time and was invisible to `tsc` — which is why nothing caught the drop above.
- fix(access): a RESERVED collection derives no CRUD. The `firestore.rules` wildcard that builds `<collection>.create` requires `!isReservedCollection(name)`: a reserved collection has its own rule and its own permission — `documentTypes` is guarded by `document-types.manage` — so the four derived ones were a whole group of permissions no rule reads, sitting next to the real group. The composition moved to `collectionPermissionResources` (`domain/services/`), a single door, where both this rule and the params live.
- fix(rules): `permissionsCatalog` joins `permissions` in the denied `affectedKeys` of a member update. Whoever could stamp it by hand would claim the set is current, and the recomposition that would fix it would never be asked for again.
- chore(marketplace): `com.microteia.locale-pt-br` at 1.42.0, so the offices that already installed the translation drop the five `role.sync.*` strings.

#### [9.42.1] — 2026-09-01

- fix(plugins): `workflowOutRefs` walks the WHOLE step tree. It iterated the root of `workflow.steps`, so a `scriptId` or a `targetWorkflowId` inside `loop.body` or `branches.whenTrue`/`whenFalse` never became a reference — and what is not a reference is refused by nothing: not `issue.ref.external`, not `.undeclared`, not `.malformed`, not `.self`. A package whose every call lives inside a loop passed `check` clean, installed, and spoke for the first time at run time, as `step.script.not-found` in a log, in the organization that installed it. The same hole reached every consumer of `packageOutRefs`: the install gate and `not-exported` in `crossExtensionRefs`, `dependentRefIssues` (a dependent that only calls from inside a loop was invisible, so updating the owner did not warn that it would break it), and the dependency closure of the authoring screen, which left the nested script out of the package.
- fix(plugins): `buildPackage` rewrites the foreign-artifact reference at every depth. `rewriteStepRefs` was applied with a flat `.map`, so a nested step travelled with the LOCAL id of the organization that exported it, which resolves nowhere else. This one and the walker above hid each other: the export left the local id, and the validation that would refuse a local id did not look there.
- feat(plugins): a refusal born inside a step NAMES the step. `RefOrigin` carries an optional `step`, and the step-derived reference points `origin` at the new `ref.origin.workflow-step` — "step \"{step}\" of automation". It rides the nested-parameter mechanism that already passes siblings down, so not one of the refusal messages changed shape to receive it, and the trigger reference, which belongs to no step, still names only the automation. With the walk now reaching every depth, "automation X references script Y" left the author searching a flow of two loops of five steps.
- refactor(domain): one traversal, in `domain/services/stepTree.ts` (`flattenSteps`, `mapSteps`). Four walks over the step tree existed and two did not descend; the private `flatten` of `workflowIntegrity` and the recursion of `rewriteStepLiteral` now come from here, because two copies of a traversal are what left the third with none. A test asserts collection at every depth — root, loop body, both branches, and a loop inside a branch — so the next new walker cannot quietly forget to descend.
- chore(marketplace): `com.microteia.locale-pt-br` at 1.41.0, so the offices that already installed the translation are offered the new `ref.origin.workflow-step` string.

#### [9.42.0] — 2026-09-01

- feat(sdk): the referenceable surface is served where the reference is WRITTEN. It is now a resource of its own (`microteia://referenceable`), and `describe_workflow_step` repeats it on the input that holds the id, filtered to the `kind` that fits there — `scriptId` never lists an automation. It used to travel only in the three answers that carry `catalogSources`, and all three are about entities, screens and fields; whoever writes the step asks about the step.
- feat(sdk): `readWorkspaceCatalog` returns `authored` — the exported surface of every `plugin.ts` in the directory, derived by the new `exportedSurface` from the same `manifest.exports`. The snapshot cannot cover the most common case of sharing: the `utils` and its caller authored side by side, neither installed anywhere yet. Here an empty list is an assertion rather than a silence, because the package is in hand, and the workspace wins over the snapshot the way it already does for a collection.
- feat(sdk): `validate_plugin` now runs the WHOLE cross-extension gate offline. It promised "the exact same checks the platform runs on install" and reached two of the four — the reference's shape and the declared dependency; the other two, the `sourceId` being in the owner's `exports` and the version satisfying the range, lived only in `crossExtensionRefIssues` at install time. A mistyped id passed in the author's terminal and was refused in the organization that installs the package, the one place nobody can fix it.
- feat(sdk/cli): `microteia-plugin check` charges the same gate and exits non-zero on a refusal, printing the kernel's own phrase beside the reference that caused it. It is the command an author runs far more often than any tool, and it answered "no problems found" for a package that would be refused. Only `refused` fails the command: `absent-there` is reported and does not, because the package may be meant for another organization. `--root` selects the directory to read (default: the working directory), and the catalog is only read when the package points outward at all.
- refactor(domain): `crossExtensionRefIssues` splits into `crossExtensionRefChecks` (the verdict) and `crossRefIssue` (the refusal), because one of the four verdicts changes meaning with the asker: `owner-absent` is a refusal on install and "cannot be checked here" in an authoring directory, which is not the office. Without the split, the only way for the terminal to charge the other three checks was to rewrite them — two copies of one rule, and a new check in either never reaching the other.
- feat(sdk): the report distinguishes `absent-there` from `unverifiable`. The snapshot lists ALL installed extensions, so an owner missing from it is information — installing THERE would be refused — while no snapshot at all, or a snapshot whose owner carries no `exports`, is a statement about what is not known, answered with the command that closes the gap. An extension from the snapshot without the key is deliberately kept out of the known owners: the gate reads a missing key as an empty surface, and passing it through would turn an old Console's silence into an invented refusal.
- test(sdk): every `microteia://` URI cited in `AGENTS.md` and `AUTHORING.md` is checked against the served list, in both directions. A URI is what a client attaches to the context, so citing one that does not answer breaks the attachment with no error at all — and a resource nobody cites is a resource nobody reads.

#### [9.41.0] — 2026-09-01

- feat(sdk): the installation snapshot carries the exported surface of every installed extension, and every answer with a `catalogSources` block lists it as `referenceable`, already in the form the reference takes (`com.example.utils/normalize-tax-id — Normalize tax id (script)`). The snapshot brought screens, lists and WHICH extensions are installed, and nothing from inside them: a qualified reference could be written by hand and could not be DISCOVERED. A name you cannot see is a name you cannot write. The `kind` travels because it decides where the reference fits — a script in `scriptId`, an automation in `targetWorkflowId`.
- feat(sdk): `INSTALLED_CATALOG_OMITS` states the line where it actually falls. What a workflow, script or action DOES stays out — steps and code are behaviour — while the name and kind of what is public are CONTRACT, and contract is shape. The old "workflows, scripts and actions" entry had become a half-truth.
- feat(sdk): `exportsKnown` tells an empty list from a missing key. A Console older than the field writes no `exports`, and reading that absence as "these extensions export nothing" would be a claim nobody made; the answer says the surface is unknown and names the command that refreshes it. `INSTALLED_CATALOG_VERSION` deliberately did NOT move: the field is additive and an old reader ignores it, while bumping it would make the strict-equality check reject the whole file in both directions.
- feat(sdk): the authoring guide documents the surface next to the reference syntax it serves, so §3 is usable from a directory that never talks to the database.

#### [9.40.0] — 2026-08-31

- feat(plugins): `buildPackage` translates the OUTGOING reference — local id to `<pluginId>/<sourceId>` — for a step's `scriptId` and `targetWorkflowId` and for the workflow an action calls. The step picker always offered another extension's automation and script, and always stored their local id, which is what the engine resolves here; what was missing was the other end, where that id exists in no other office. The package referenced an artifact it did not include, `validatePackage` refused it with `issue.ref.external`, and the refusal could not be answered from the screen — only by hand-editing the `.ts`. Only the FOREIGN artifact enters the map: `sourceId` and `ownerPluginId` are written together at materialization, so an office artifact has neither and its local id already IS the `templateId` — the coincidence that lets the authoring dependency closure keep comparing local ids. An already-qualified reference is left alone, and a non-`Literal` target is no reference at all.
- feat(plugins): the authoring screen DERIVES `manifest.dependencies` from what the package points at, the way it already did for `core.ui`. The author picks from a selector and has no reason to know the pick became an install requirement; the range is `^` over the version installed here, the only one known to be true. An extension that is referenced but not installed is not declared — there the integrity refusal is the right answer.
- feat(marketplace): the author is told, in an `InfoBanner`, which extensions the package now requires. Without it the first notice of the requirement would be the install gate's refusal, in another office, to someone who did not make the choice.

#### [9.39.1] — 2026-08-31

- fix(plugins): updating an extension is now fail-closed on the other side of the reference too (`dependentRefIssues`, wired into the same single install door). `applyPackageArtifacts` CONVERGES, and converging removes what the package stopped bringing (`releaseVanishedGeneratedArtifacts`): the owner stopped owning the artifact, and it was deleted once no owner was left — while the dependent stayed installed, enabled and loaded, because its dependency had not vanished, only the artifact. The failure surfaced on the step's first run, months later, in a log. Losing the OWNER is enough to break the reference even when the document survives under a third extension, because `findByRef` matches `sourceId` AND owner. A DISABLED dependent counts: the reference is still written in its step, and letting it through would only trade today's refusal for the same silent failure the day the office switched it back on. Narrowing `exports` while still shipping the artifact is not refused here — nothing breaks at run time, and the dependent is charged for it on its own next gesture, by `issue.ref.not-exported`.
- docs(plugins): uninstalling the owner deliberately still passes, and `ARCHITECTURE.md` now records why. The symmetric refusal would open a reachable trap — a mutual A↔B is not INSTALLABLE, but is reachable by updating A after B is in —, and from there neither would come out without someone discovering on their own that the way back is restoring A from history. The gesture is deliberate, `PluginHost` reports `dependency.missing`, and reinstalling A recreates the artifact under the same `sourceId`.

#### [9.39.0] — 2026-08-31

- feat(plugins): a package can now reference an automation, action or script brought by ANOTHER extension, written as `<pluginId>/<sourceId>` (`domain/schema/plugin/artifactRef.ts`). Until now only `kind: 'screen'` could cross a package boundary, because a screen is identified by its collection name while the three generated-id artifacts are identified by a local id that install may rename — so there was no name to point at. The reference resolves by name at RUN time (`findByRef` on the workflow-definition and script repositories), never rewritten at install: a rewritten id dangles the moment the owning extension is reinstalled and renumbers, a name does not. KERNEL_VERSION 2.12.0 -> 2.13.0, additive.
- feat(plugins): `manifest.exports` declares which generated-id artifacts an extension makes public. Absent means an EMPTY public surface, not a total one — without it every `templateId` an extension ever shipped would become a contract by accident, and renaming an internal helper would break a consumer that its author never knew about.
- feat(plugins): installing is fail-closed on a cross-extension reference (`crossExtensionRefIssues`, wired into the single install door in `InstalledExtensionStore`). The owning extension must be installed, satisfy the declared range, and list the artifact in `exports`. `PluginHost` already refused to LOAD a plugin whose dependency was missing; what was missing was refusing the gesture that puts it there.
- fix(plugins): `rewriteStepLiteral` now refuses to rewrite a qualified reference explicitly. It already behaved correctly, but only because the id map MISSED — the same "accidentally correct" that produced the `0 > 0` freeze in `shouldRewriteContent`.
- fix(automation): a call to a missing artifact of another extension names that extension (`step.call-workflow.target-missing-extension`, `step.script.not-found-extension`). A dangling local id said nothing; the answer the office needs is which extension to install.
- fix(functions): `sourceId` and `ownerPluginIds` reach the backend `WorkflowDefinition` and `Script` entities and their Firestore mappers. Both fields existed in Firestore and were dropped on the way in, so the engine could not tell whose artifact a `sourceId` had found — and install dedups by `sourceId` alone, so two unrelated extensions can share one.

#### [9.38.3] — 2026-08-31

- fix(workflow/steps): `UpsertStep`, `RemoveStep` and `QueryStep` dropped the mutation outcome's `errorParams`, so every write refused by a field rule reached the execution log as the raw template — "Invalid write: {detail}" — with no field and no reason. The office had no way to tell which field the engine refused.
- fix(schema/fieldRules): `ruleIssueParams` replaces `describeRuleIssues` wherever a refusal reaches a SCREEN. The old summary joined the issues into one string with each message reference buried inside it, where nothing resolves it any more; the new one returns reference plus values — `detail` points at the wrapper, `label`/`reason` describe the first issue and its siblings descend into the nested phrase, exactly as the catalog's `resolveParam` resolves. Applied to the upsert/remove specs, the rule outcome, `ValidateStep`, `ScriptStep`, `runScript` and the workflow parameter gate. `describeRuleIssues` stays for the technical log.
- fix(workflow/mutation): the "fields ignored" warning carried `path (@core.automation/mutation.path.unknown-field)` as text; it now carries the reason as a reference, so the warning says WHY the field was dropped instead of showing the key raw.
- feat(messages): `core.records/field.issue` and `field.issue-more` — the wrapper a refusal resolves through, with the count of the issues the sibling set cannot describe at once.


#### [9.38.2] — 2026-08-31

- docs(readme): the "Multi-tenant" section still listed `admin`, `lawyer`, `secretary` and `user` as per-office roles
  and `SUPPORT` as a global one. Both were revoked: authorization is by permission over office-authored profiles
  (`roleIds` -> `Role`), `UserRole` is `SYSTEM | USER`, and the bootstrapped tenant seeds no profile at all — the owner
  passes through the `*` wildcard read from `Tenant.ownerId`. A reader following the README would have written
  `role === 'admin'`, which no code path answers any more.
- docs(readme): section 5 still put the office's own Cloud Functions in `.microteia/install/functions/custom/src/`, a
  directory the `unpack` replaces wholesale — `PRESERVED` is down to `functions/node_modules`. The source lives in
  `functions/` beside `microteia.yaml` (shared) or `extensions/<plugin>/functions/` (owned by one extension), and the
  `deploy` assembles `custom/src/` from both, refusing duplicate export names.
- docs(readme): `microteia-plugin new` does not exist — the command is `create`. Also: the two theme bases are
  `dark`/`light`, not `dark`/`white`; the examples in `extensions/` are the six of `EXAMPLE_SOURCES`, so the count came
  out of the prose; the installation layout now lists `functions/`, `README.md`, `MICROTEIA.md` and the two technical
  changelogs the `unpack` writes; the Console table gained `export-catalog` and the `--all` flags; the source tree
  gained `src/sdk/`; and the backend `.env.<projectId>` is named at the root everywhere, never under `functions/`.
- docs(claude): the `functions/custom/` bullet described the revoked model and contradicted the bullet under it, which
  already said nothing a person types lives in `.microteia/`.
- docs(architecture): two spots contradicted the rest of the file — the bootstrap paragraph still added the first user
  as `admin` (it adds a member with `roleIds: []` to a tenant named `${displayName}(${email})`), and the backend-env
  table still claimed `install/functions/custom/` is copied back through an upgrade, four sections after the one that
  took it out of `PRESERVED`.

#### [9.38.1] — 2026-08-31

- fix(records/identity): the detail header and the tab label read the title and subtitle fields with `readRecordText`,
  which returns the stored value. A reference stores the target's id and a select stores the option key, so the same
  record read "Alex" on the list card — which resolved through `displayValue` — and `BnUQ236xn6k16FTlcwfQ` in its own
  header. One declaration, three places, and now one resolver: `useRecordIdentityText`, used by the card, the header
  and the tab title.
- fix(records/identity): an untitled record put `@core.records/record.untitled` on the card and on the tab, raw —
  `resolveRecordTitle` returns a reference and neither consumer resolved it. Both go through `useLabel` now.
- fix(extensions/detail): `useEntityDetailVM` built the new-record tab title as a Portuguese template literal with the
  unresolved `titleSingular` in it. It is `record.new.title` with a resolved label, like every other screen.
- fix(screen-builder): the identity block was gated on `titleFieldOptions.length > 0`, so a screen with no required
  text field lost the subtitle and image selectors along with the title one. The gate is split, and the title filter
  no longer demands `required` — being required is good advice for the field that names a record, not a precondition;
  an empty one already falls back to "untitled". The saved value is always offered, as the subtitle's already was.

#### [9.38.0] — 2026-08-30

- feat(marketplace/history): applying an extension overwrote the installed copy and left nothing
  behind. An update that made a screen worse could only be undone by whoever still had the previous
  `.json`, and an accidental uninstall could not be undone at all — the installed package died with
  the document. Every applied version is now recorded in
  `tenants/{tenantId}/extension_history/{pluginId}`, and going back to one is the same `install` as
  ever.
- feat(marketplace/history): the recorded entry is the version being APPLIED, not the one leaving.
  That is what makes the three rules fall out for free: the last installed version is already in the
  history when the office uninstalls (nothing to write in a gesture that applies nothing), and
  re-applying one from the history creates no item, because `record` is idempotent by revision.
- feat(marketplace/history): the entry's identity is `SHA-256(packageFingerprint)`, not the declared
  version — the same fingerprint `builtinUpdateOf` already used to offer "Update" for a builtin whose
  version had not moved. Keyed by version, a first-party extension under development and a private one
  edited in place would collapse two applications into one.
- feat(marketplace/history): the index doc holds up to `EXTENSION_HISTORY_LIMIT` (10) metadata entries
  and the package of each lives in `versions/{revision}`. Subscribing to the index is what the screen
  needs; the package costs a read only for whoever chose to go back. Inline, the subscription would
  carry megabytes on every load and the index would pass Firestore's 1 MiB before a translation
  package's fourth version. `record` is transactional and prunes the dropped package in the same
  transaction — outside it, the cap would bound the list and leave the bytes.
- feat(marketplace/history): `uninstall` preserves the history (it is where "bring it back" comes
  from); `removeExtension` — DELETE, offered only for the office's own private extension — cascades it
  away. Unlike `extension_migrations`, the Firestore rule allows `delete` here: a package kept to
  re-apply to an extension that no longer exists serves no one.
- feat(marketplace/history): `restore` hands the stored package to the same `install`, so a rollback
  pays for converged artifacts, a migration queue planned against what this office already applied,
  and code trust re-evaluated by hash. A separate rollback path would have to repeat all four, and
  would be where the fifth was forgotten.

#### [9.37.3] — 2026-08-30

- fix(sdk/docs): `list_workflow_events` and the authoring guide both said an `{ kind: 'Expression' }`
  mapping addresses the event ABSOLUTELY, `event.payload.x`, same as a condition's `fieldPath`. The
  engine binds `event` to the payload itself (`buildVariablesContext`), so `event.payload` is
  `undefined` there — and the member access after it THROWS, which fails the step's input resolution
  and halts the run. It does not read as empty, and nothing reports it until a record is saved. Both
  now state the three addressing forms apart: absolute in `fieldPath`, relative in an `Event` mapping,
  and the payload itself in an expression.
- fix(marketplace/automation-example): the canonical automation example was written from that wrong
  instruction, so both audit messages of its only save-triggered workflow — the created branch and the
  updated branch — crashed on every save. The one worked automation the guide points at could not run
  at all.
- test(scripts/declarativeWorkflow): the addressing is now pinned from both ends — the real engine is
  run twice to show `event.title` resolving and `event.payload.title` failing the execution, and every
  first-party workflow declaration is swept for an expression that asks for `event.payload`.

#### [9.37.2] — 2026-08-30

- fix(sdk/screen-plan): the generated `disabledWhen` joined its terms with `||`, which in the expression
  language is SQL-style text concatenation, not "or". `!(a) || !(b)` evaluated to the string `"falsefalse"`,
  and every non-empty string is truthy in all four combinations — so an action carrying at least one
  blocking invariant was permanently greyed out and no data could light it up, while an action with none
  emitted a single term, no operator, and worked. Copying the plan verbatim, which is what the guide asks
  for, is what shipped it.
- fix(engine/expression): `!` is logical negation in the workflow engine too. It was still the raw
  `expr-eval` factorial there — `!(status == "draft")` returned `1` — so a step condition written with `!`
  passed for any data, and the only symptom was an automation running when it should not have. The screen
  evaluator had been fixed; the fix never crossed over.
- fix(sdk/behavior-mapping): `workflowCondition` is an EXPRESSION again. On an entity-event transition it
  carried the reason it converges as English prose inside the parentheses of the expression itself —
  `status == "draft" (false after the write, which is what ends the cascade)` — a field named condition,
  emitted to whoever writes the `plugin.ts`, that does not parse. The guide asks for the plan to be copied
  verbatim. The reason survives in `conditionNote`, beside it, and `describe_domain_model` emits both.
- feat(domain/schema): `expressionSyntax.ts` holds the operator vocabulary — `NOT_OPERATOR`, `OR_OPERATOR`,
  `notExpression`, `anyOf` — beside the file that configures the parser. Whoever BUILDS an expression no
  longer types the token from memory, which is how the wrong one got in.
- test(sdk/screen-plan): every condition the plan emits for the corpus — `disabledWhen`, `hiddenWhen`,
  `workflowCondition` and the `fromCheck` tests — is run through the real evaluator and must come back a
  BOOLEAN. A condition that returns a string is a condition the grammar reads differently, and one that
  does not parse is one nobody can copy; both fail here, naming the expression. That catches the operator
  nobody has got wrong yet.
- test(engine/expression): `fieldExpressionParity.test.ts` now compares operator SEMANTICS across the two
  ends, not just the function catalogue — which is what it was doing while they disagreed about `!`.

#### [9.37.1] — 2026-08-30

- fix(sdk/workspace): the `.gitignore` seeded into `extensions/` swallowed `domain-model.json`,
  `business-rules.json` and `business-rules-input.json` under its `*.json` wildcard. Those three are the
  author's SOURCE — the guide tells you to keep them beside the `plugin.ts`, the directory's own `npm test`
  reads them back, and the plan hands you the ledger entry ready to write. Uncommitted, a declared snapshot
  exception was raised again on the next machine, and a CHANGED rule had no previous batch to diff against,
  so it proposed a second set of screens that looked like the first. `REQUIRED_IGNORES` now negates all three,
  and `sync` appends the missing lines to a `.gitignore` that already exists.
- refactor(sdk/domain): `DOMAIN_MODEL_FILE` moved from `node/workspaceCatalog.ts` to `domain/domainModel.ts`
  (re-exported from its old home, so no importer changed), next to `RULE_LEDGER_FILE` in `traceability.ts`.
  The `.gitignore` seed needs the two names without dragging the extension compiler in behind them, and a
  filename written twice is a filename that diverges on the third.

#### [9.37.0] — 2026-08-29

- feat(domain/ui): the icon vocabulary moved out of the presentation layer into `domain/schema/ui/screenIconCatalog.ts`
  (`SCREEN_ICON_KEYS`, `ScreenIconKey`, `isScreenIconKey`). `screenIcons.tsx` is now only the drawing, typed
  `Record<ScreenIconKey, IconType>`, so a key with no component and a component with no key stop the typecheck instead
  of falling through to the generic marker.
- feat(domain/plugins): `packageIconIssues` joins `packageIssues`, so the single validation door refuses an icon that
  is not in the catalogue — in `manifest.icon`, in the metadata of any contribution to a core UI point, in
  `screens[].icon`, in a card field's `listIcon`, in `actions[].icon` and in `views[].icon`. `icon` was free text in
  all of them and the kernel draws a generic marker for what it does not know: nothing validated, nothing failed, and
  the invented name only showed up on the screen of whoever installed it.
- feat(sdk/node/mcp): the resource `microteia://icons` (`list_icons`) serves the catalogue, derived from the kernel.
  The MCP server had no icon resource at all, which is why an authoring agent had nothing to ask and guessed.
- feat(sdk/node/workspace): AUTHORING.md §4 gains "Icons — a closed vocabulary", with the full list derived from
  `SCREEN_ICON_KEYS`. A partial list would send the author back to guessing, which is the defect itself.
- fix(marketplace/automation-example): `act-mirror` shipped `icon: 'refresh'`, which never existed in the catalogue. A
  first-party example, written to be read as a reference, carried an invalid icon and nothing ever said so.
- fix(sdk/node/workspace): the `icon: 'chart'` and `icon: 'receipt'` in the AUTHORING.md and AGENTS.md examples — the
  ones an author copies — never existed either.
- test(sdk/node/workspace): `templates.test.ts` extracts every `icon: '…'` written in the authoring texts and refuses
  what is not a key; `extensionTemplates.test.ts` now runs every embedded extension AND the travelling examples
  through `validatePluginPackage` instead of referential integrity alone, which is the gap the example fell through.

#### [9.36.2] — 2026-08-29

- fix(records/validation): `requiredFieldError` asked `t` for `@core.automation/parameter.required`. The sigil marks a
  message REFERENCE, which is `useLabel`'s road; `t` qualifies and looks up a key, misses, and returns the key it was
  given — so every empty required field showed the raw reference under it.
- fix(records/validation): a rule issue reached `fieldErrors` and the save toast raw. `RuleIssue.error` is a reference
  with `errorParams` beside it, and the toast was built from `describeRuleIssues`, which is the LOG summary. Both now
  resolve through the catalog, and `errorParams` — dropped until now — reaches the sentence that interpolates it.
- refactor(records/validation): the two record screens kept a byte-identical `validate`; the copy is why one side could
  be right and the other wrong without a symptom. Both now call `useRecordFormValidation`.
- fix(ui/custom-fields): `fieldError` renders through `useLabel`, so a reference from a screen's own `logic.validate`
  or from a workflow's `fieldErrors` resolves, while text the office wrote in the rule passes intact.

#### [9.36.1] — 2026-08-29

- fix(presentation/child-tabs): the child-screen tab label now goes through `useLabel`. `useChildScreenTabs` was the
  only place a screen title reached the screen without the catalog — the sidebar, the command palette, the list
  header and the screen definition itself all resolved it — so an extension whose child screen is visible as a tab
  showed the raw `@plugin/key` reference instead of the translated title. No first-party child screen is a visible
  tab (`newsComments` sets `hideFromParentTabs`), which is why the path was never exercised.
- fix(presentation/dynamic-list): the workspace tab title of a dynamic screen opened on its own was set from the raw
  `titlePlural`; the tab-title override bypasses `TabBar`'s resolution, so it reached the tab strip unresolved too.

#### [9.36.0] — 2026-08-28

- feat(schema/record-keys): a screen can declare what must not repeat in it — `ScreenDefinition.keys`, with
  `FieldDefinition.unique` as the one-field shorthand that `resolveEntityKeys` desugars. Composite keys, a
  `parent` scope, declared normalization (trim, case, format preset) and a sparse-by-default policy. Until now no
  layer enforced uniqueness at all: two identical records were accepted everywhere, silently, and `autoValue` only
  avoided collisions inside the 500-record window the client happened to hold.
- feat(data/record-keys): the guarantee is a reservation document under `tenants/{id}/recordKeys`, whose id derives
  from the normalized value and which is written in the SAME batch as the record. The `recordKeys` rules allow
  `create` and not `update`, and `create` only fires when the document is absent — so a duplicate fails the batch
  whole. No read-then-write, no race, and no composite index: the lookup is by document id. It generalizes the
  `/nicknames` pattern that already lived in this repository for exactly one case.
- feat(workflow/mutation): `runWorkflowUpsert` and `runWorkflowRemove` reserve and release through the same plan,
  in an Admin-SDK transaction where `tx.create` is the lock. A uniqueness the automation path could bypass would
  not be a uniqueness — it would be a hint in the form.
- feat(sdk/domain-model): `DomainEntity.keys` and `DomainField.unique` enter the model, invariant scope
  `collection` enters the behavior half, and the whole "there is no uniqueness constraint here" answer is replaced
  across the surfaces that state it — the JSON schema, `BEHAVIOR_MECHANISMS`, the one-to-one storage note, the MCP
  rules resource, the modelling prompt and `AUTHORING.md`. Seven `model.key.*` detectors and
  `behavior.invariant.uniqueness-undeclared` refuse a key over an unknown or derived field, a second primary, a
  parent scope on a non-child, and uniqueness written as an expression.
- feat(sdk/plan): `generate_artifact_plan` emits the keys of each screen, and marks the ones that need a sweep over
  records that already exist — a key installed over a populated collection is born pending, because a key that
  "already holds" and meets two old duplicates blocks the next write for a reason nobody showed.
- fix(presentation/schema): `useSchemaContext` now goes through `toSchemaScreens` instead of a second hand-written
  copy of it. The two had drifted by construction: a new property reached the write path and not the screen, which
  is exactly how the keys would have gone missing.
- fix(schema/screen-entity): `NativeFieldSpec` carries `unique`, so the `FieldDefinition` round trip stops dropping
  it. Without this a key declared in the Form Design vanished on the next read with nothing to show for it.
- KERNEL_VERSION 2.11.0 -> 2.12.0 (additive: a screen in an installed package may now declare `keys`).

#### [9.35.0] — 2026-08-28

- docs(sdk/authoring): the installation-gate refusal is described as being of the FUNCTION, not of the command. An author reading "refused before anything is deployed" had no way to tell that a source left in the workspace for an uninstalled extension blocks nothing, and that the day it is installed is the day it is refused.

#### [9.34.0] — 2026-08-28

- feat(functions/office): `requireInstalledExtension(pluginId, tenantId, request)` — the three refusals an extension's callable owes before it reads the payload: the caller signed in, the caller belongs to that organization, and the extension is installed and active there. Returns the caller's uid. "An orphan callable just sits there" was true of the INTERFACE and not of security, and it was the sentence this repo's own documents carried: the deploy grants `allUsers` the `roles/run.invoker` role on every callable, so what stands between the function and the internet is the Firebase token check alone. The screen leaving with the extension closed nothing — the endpoint answered any signed-in user of the project, from any organization.
- feat(functions/office): the middle refusal is the one that mattered. `useCallable` sends only what the screen passed, so the organization arrives in the payload, and the scaffold checked nothing but `request.auth !== undefined`. Together that let a user of one organization point an extension's function at another. The membership question comes from `isOfficeMember`, extracted next to `requirePermission` so member/owner/SYSTEM has ONE implementation on the functions side rather than a fourth copy diverging on the rule that decides who gets in.
- feat(functions/office): it throws rather than returning a boolean, and asks about the organization BEFORE the installation. A `false` invites being ignored and the missing `if` leaves no symptom; and a stranger is not told whether an extension is installed in an organization they have no business in.
- feat(sdk/authoring): the callable scaffold is generated with the guard, and the guide's "a callable does not need it" is replaced by the reason it does. A generated example without it taught the defect.
- chore(kernel): `KERNEL_VERSION` 2.11.0 — additive: an extension written against `requireInstalledExtension` needs a kernel that ships it.

#### [9.33.0] — 2026-08-28

- feat(functions/office): `forAnyInstalledExtension(pluginIds, handler)` — the guard for a function in the installation's own `functions/`, the directory for one that SEVERAL extensions need. `forInstalledExtension` cannot answer there, because the question is not "is this extension installed?" but "is any of the ones this function serves installed?". Any one of them is enough, and that is the only sensible rule: the function exists because more than one extension needs it, so requiring all of them would make uninstalling one switch off the others' behaviour. It stops at the first positive answer, and fails closed on an event with no `{tenantId}`.
- feat(sdk/authoring): the guide documents `microteia.serves` and the guard together, because one without the other leaves half the defect standing — the declaration authorizes the withdrawal, the guard stops the function from acting where it should not. It also states what a shared function with no `serves` still does, so nobody has to infer it.
- chore(kernel): `KERNEL_VERSION` 2.10.0 — additive: an extension written against `forAnyInstalledExtension` needs a kernel that ships it.

#### [9.32.0] — 2026-08-28

- feat(functions/office): `forEachInstalledOffice(pluginId, handler)` — runs an extension's handler once per organization that installed it, and returns how many. It answers the events that carry no `{tenantId}`: a scheduled run, a Pub/Sub message, an HTTP request, a Storage event. For those, both of the author's options were wrong — unguarded, the function acts on the whole project; wrapped in `forInstalledExtension`, it never runs at all, because that guard fails closed and never finds the `{tenantId}` that does not exist. An author following the generic "wrap the handler in the guard" produced a function that passed the deploy, reported nothing and did nothing.
- feat(functions/office): it lists the organizations and asks one by one rather than querying a collection group. The installation document carries the plugin id as its own id and not as a field, so the query would need a new field, an index and a migration of documents already written — for a function that runs on a cron. It shares the guard's cache, because two implementations of "is it installed?" would diverge on exactly the rule that decides whether an extension's code runs. It is sequential on purpose: a scheduled run opening a burst of parallel writes across every organization at once is the kind of thing that only shows up on the invoice.
- feat(functions/office): one organization failing does not take the others' turn, and the function still fails at the end. Stopping at the first error would let a bad record in one place silently suspend the routine everywhere else; swallowing it would make the routine "pass" forever.
- feat(sdk/authoring): `create function` gained a third answer to "what sets it off?" — a clock — and it is scaffolded with the loop already in place. A generated example without it would teach the defect, which is the same reason the Firestore trigger is scaffolded with its guard.
- chore(kernel): `KERNEL_VERSION` 2.9.0 — additive: an extension written against `forEachInstalledOffice` needs a kernel that ships it.

#### [9.31.0] — 2026-08-28

- feat(marketplace): the Extensions screen shows what provisioning left behind in the project. It is the other half of the "Backend pending" badge — that one is the installation that has not reached the project yet, this one is the withdrawal that has not happened — and it exists because the person who reads that screen is not necessarily the person with a terminal. `--prune` staying an explicit act is right; nobody being able to learn that it was needed was not.
- feat(domain/data): `BackendResidue` and `backend_state/current`, read-only for the client. The document is written by the Microteia Console with administrator credentials, so the repository has no write method and the rule denies the client one — not even SYSTEM. Write access would be worse than no document: an administrator could forge the orphan list and have whoever maintains the project run `--prune` against another extension's function. Reading is defensive field by field, because the Console is versioned separately and the document can come from an older version (missing a field) or a newer one (carrying fields this kernel does not know).
- fix(firestore.rules): `backend_state/{documentId}` — read for any signed-in user, write for nobody. Read is open because the document is the PROJECT's backend inventory (function names and extension ids) and carries no office data; that openness is what lets the banner reach whoever lacks the terminal, which is the only reason the document exists.

#### [9.30.0] — 2026-08-28

- docs(sdk/authoring): "nobody owns it, so nothing can claim it" is now a refusal the author can read as one. The sentence stated the shape of `functions/` and left the consequence of claiming one to be discovered — which is a deleted function, a deploy that puts it back, and other extensions losing their backend in between. The paragraph names all three, and says where to move the function if it really belongs to one extension.

#### [9.29.0] — 2026-08-28

- docs(sdk/authoring): the installation gate is stated as a refusal, not as advice. The guide told the author what `forInstalledExtension` prevented and left the impression that writing it was a matter of care; the Console now refuses an ungated trigger, so the paragraph that describes the contract had to say the same thing. It also names the two forms the check accepts — the call inside the trigger, and the guard declared in an identifier beside it — and the one it does not: a comment that only mentions it.

#### [9.28.0] — 2026-08-27

- feat(functions/office): `forInstalledExtension` and `isExtensionInstalled` — the curated server surface an extension's own Cloud Function imports as `microteia-functions/office`. A Cloud Function belongs to the project and an installation belongs to the organization, and nothing in Firebase reconciles the two: an extension's Firestore trigger ran for every organization in the project, including the ones that never installed it and the one that uninstalled it while another still had it. Pruning cannot reach that last case — the function is still needed by somebody — so the guard is the only thing that stops the side effect, and it is also what covers the gap between the uninstall and the next `microteia provision --prune`. It wraps the HANDLER, never the function: `firebase-functions` reads `__endpoint` off the exported symbol, and a wrapper outside would make the deploy stop seeing the function at all.
- feat(cli/packageTemplates): the installed `functions/package.json` declares `exports`, so package self-reference resolves `microteia-functions/office` at runtime, and `custom/tsconfig.json` maps it for the deploy's compile. Neither costs a dependency, which is what keeps the packaged `package-lock.json` valid.
- feat(sdk/workspace): `REQUIRED_PATHS` resolves the same specifier in the authoring workspace, against `sdk/types/microteia-office.d.ts` — derived by `tsc` from `functions/src/office/index.ts`, never hand-written. `officeModule.test.ts` ties the three ends together; separated in silence, each divergence has a different symptom and none of them names the cause.
- feat(sdk/scaffold): `microteia-plugin create function` asks what sets the function off and writes the guard when the answer is a saved record. A generated example without it would teach the defect.
- KERNEL_VERSION 2.7.0 -> 2.8.0: additive. An extension whose function imports the surface needs a kernel that ships it.

#### [9.27.0] — 2026-08-27

- fix(cli/provision): the "no installed extension asks for backend artifacts" shortcut returned before orphan functions were computed, so uninstalling the LAST backend-bearing extension left its Cloud Functions deployed with nothing reporting them and `--prune` unable to reach them. A Firestore trigger of an extension nobody has kept firing on every write. The shortcut is gone; the index side had already been rescued from it, the function side had not.
- fix(cli/provision): a claim the run could not resolve (a renamed export in `extensions/<x>/functions/index.ts`, a name a kernel upgrade dropped) took the plugin out of `valid`, which turned its functions into orphans — `--prune` then deleted the function of an extension that was still installed. Unresolved claims are now preserved and named, never pruned.
- feat(cli/backendShape): `baselineClaimProblems` refuses a claim over a function the platform deploys itself. Packaging cannot ask the question (the baseline is derived from the claims), the installation can — and claiming one changed nothing until the day it removed a working kernel trigger from the project.
- feat(cli/appliedFunctions): `backend.functions` records `name@pluginId` instead of a bare name, so an orphan report can say whose it was. Entries written by earlier installations are still read.
- feat(cli/provision): the orphan report states the survey it rests on — offices read, extensions read — because "no installed extension needs them" is a claim about every office in the project, not about the last one read.

#### [9.26.1] — 2026-08-27

- chore(scripts): `publish:packages` joins `pack:kernel` and `pack:console` in `package.json`, running
  `npm run build:cli && node cli/lib/index.js publish`. Releasing was the only step of the three without
  a script, so the path to the compiled Console was typed by hand every time — and the step reads
  `CLI_VERSION` from that COMPILED copy to find `distributions/console/<version>/`, so a bumped
  `CLI_VERSION` against a stale `lib/` looks for a directory nobody built. Building first is the same
  reason the two `pack:*` entries do it. One entry covers every variation, because the flags reach the
  command through `npm run publish:packages -- --dry-run | --kernel-only | --console-only | --otp <code>`.
- chore(scripts): the name is `publish:packages` and not `publish` because npm reserves `publish` as a
  lifecycle script — `npm publish` in the repository root would fire it as a hook. The root package is
  `"private": true`, so that call dies with `ENOPRIVATE` before any hook runs; but `npm publish` and
  `npm run publish` differing by one word, on the command that releases to a registry, is an ambiguity
  that costs nothing to remove and everything to hit once.

#### [9.26.0] — 2026-08-27

- feat(sdk/domain): `screenPlan.ts` now EMITS the universal `sourceId` of every screen it plans, and the precedence comes before the derivation (`SCREEN_SOURCE_ID_PRECEDENCE`): the ledger first, then whatever the `plugin.ts` or the installation catalog already declares, and only for a NEW screen the derivation `<extension id>:<collection>`. A sourceId that already exists is never recomputed — not by a renamed entity label, not by a rewritten rule, not by a future change of the derivation itself. It was the most consequential human decision left in the plan and it failed in silence: `buildScreenKeyMap` looks the screen up by that identity, so a value changed between two versions of the same package installs a SECOND screen beside the first, releases the first, and leaves the records in a collection with no screen over them — in every office at once, with nothing on screen saying so.
- feat(sdk/domain): the base is the extension id plus the COLLECTION, by elimination. What the identity must survive is exactly what a person rewrites — the entity label (which is the screen's `titleSingular`), the rule statement and the order of screens in the plan — and none of the three is in it. The extension id is globally unique by construction, so two extensions with same-named entities cannot collide; the collection is unique inside the extension, so two screens of one package cannot collide.
- feat(sdk/domain): three ERROR detectors on what the plan emits — `domain.plan.screen-source-id-missing` (a planned screen with no identity), `...-divergent` (the package declares one value and the ledger records another; the plan keeps the RECORDED one and the message names it, because the fix is to use the recorded one and never the new one) and `...-duplicate` (two screens of one plan sharing an identity, which the installation reads as one screen).
- feat(sdk/domain): `business-rules.json` records the identity of each screen (`screenSourceIds`), which turns it from a record of provenance into a dependency — and `ledgerFindings` now compares it with what exists: an artifact this rule produces that ALREADY existed here and the book does not mention (an earlier pass that never wrote the book, which is where the identity is lost), and an artifact the book names that is neither in the plan nor in the catalog. WARNING, not error: the book is written by hand and may legitimately be one write behind, and refusing the plan would block the very call that hands back the corrected book. `generate_artifact_plan` says it out loud in its own `ledgerIntegrity` field, not only among the issues.
- feat(sdk): barrel adds `SCREEN_SOURCE_ID_PRECEDENCE`, `deriveScreenSourceId`, `declaredScreenSourceIds`, `registeredScreenSourceIds`, `ledgerFindings` and the types `ScreenSourceIdOrigin`, `LedgerIntegrity`, `LedgerReality`. `KERNEL_VERSION` does NOT move: `sourceId` already exists on `ScreenModuleTemplate` and the installed package keeps exactly the shape it had — what is new is who decides the value.
- docs(sdk/workspace): §8.1 of `AUTHORING.md` stops telling the author to choose the `sourceId` and derives the precedence table from the code, with `templates.test.ts` guarding the derivation. `screen.sourceId` leaves the coverage gap list (135 mechanisms: 53 reached, 82 not).

#### [9.25.0] — 2026-08-27

- feat(sdk/domain): `screenPlan.ts` — the artifact plan now decides the SCREEN, by rule. Root entity to a list plus a detail; `kind: 'child'` to a tab of its parent and never a sidebar entry; `kind: 'lookup'` to an option list and never a screen; a flattened `valueObject` to a section of the owner's form; many-to-one to a reference field on the N side with the label resolved at render and never copied into a second field; a one-to-many that is not a child to nothing at all; a derived field read-only (by mechanism — the form disables anything carrying `logic.compute` or `aggregation`); the state field to the list and to the filters. `SCREEN_PLAN_RULES` is the single source, and `microteia://domain-model/rules`, the `AUTHORING.md` table and the plan's own answer all read it. What filled these gaps before was the language model, once per session, with a different answer each time.
- feat(sdk/domain): every `user-action` transition yields one record action, and its `disabledWhen` is the transition's `from` joined with every invariant declared `enforcement: 'blocks'`, negated. That is the only place a blocking invariant can sit on a gesture; an action written without it fires a flow whose condition silently discards it. `hiddenWhen` comes from the permission, and the reference parameter the flow needs to resolve the state field is named.
- feat(sdk/domain): the plan names what it does NOT decide — icon, `sidebarOrder`, `subtitleFieldKey`/`imageFieldKey`, the action's own title — and for action PLACEMENT it decides only the derivable half: when the refusal reads a field the list card does not show, the place is the detail header (on the card it would be a greyed-out button with no visible reason); when it reads only visible fields, both are legible and the choice is handed back.
- feat(sdk/domain): `businessRule.ts` — the rule as an artifact (`{ id, statement, actors, concepts, invariants, processes, acceptance }`), with tolerant parsing (a bare pasted sentence becomes the statement) and six checks that report the DISTANCE between the rule and the model without blocking: a concept no entity carries, an actor no transition asks anything of, more invariants or processes than the behavior declares, and no acceptance criteria at all. Same standing the workflow description already has as the classification contract of the automation detector.
- feat(sdk/domain): `traceability.ts` — `ruleId -> artifacts produced`, in `business-rules.json` beside the `plugin.ts`. The alternative was stamping the `ruleId` inside the installed artifact, which needs a new property on `ScreenModuleTemplate`, `ActionModuleTemplate` and `WorkflowModuleTemplate` — the shape of the package changes and `KERNEL_VERSION` moves with it. "Which screens did this rule create?" is an authoring question: whoever asks it has the `plugin.ts` open, and the organization never asks it. Same verdict `CatalogException` got, and the same consequence. `buildArtifactPlan` takes `{ rule, ledger }` and answers with the delta; `readWorkspaceCatalog` reads the ledger next to each package.
- feat(sdk/domain): reconciliation gains the case the rule brought — the rule changed and a screen it created is no longer needed. `PlannedDeactivation` proposes DISABLING (`enabled: false`, `hideFromSidebar: true`), never deleting, with `domain.plan.deactivate-proposed` carrying the reason: deleting a screen means deciding what happens to the records in it, and this plan sees no records.
- feat(sdk/node): the MCP server declares the `prompts` capability and serves `model_business_rule`, which conducts understand -> model -> validate -> plan. It was left out with the argument that "there is nothing here that is a text for the user to choose", and the argument was wrong: the ORDER of working a business rule is exactly that, and while it lived in a paragraph of `AGENTS.md` it applied to whoever had read `AGENTS.md`. The text is DERIVED — `STORAGE_MECHANISMS`, `BEHAVIOR_MECHANISMS`, `SCREEN_PLAN_RULES`, the gap count — and it cites tools by their real published names, saying so when one is missing.
- feat(sdk/domain): `BehaviorTransition.description`, and `behavior.transition.without-description` for its absence where the mechanism requires it. `AIDetectWorkflowStep` builds its candidates with `findEnabledByEvent(tenantId, WORKFLOW_CALLED_EVENT)` and then drops every flow whose description is empty — the filter is in the step and again in `detectWorkflowIds` — so a callable flow with none installs, runs when somebody presses the button, and is absent from the only surface that would pick it on its own. `DESCRIPTION_REQUIRED_EVENTS` derives which events need it.
- feat(sdk/domain): `coverage.ts` and `microteia://domain-model/coverage` — the mechanism surface walked and classified: registered steps, the required inputs of the steps the model reaches, event-catalog entries, contribution points, and the properties of `MarketplacePlugin`, `ScreenModuleTemplate`, `ActionModuleTemplate`, `WorkflowModuleTemplate` and `PluginManifest`. 134 mechanisms, 52 reached, 82 not. The four property maps are `Record<keyof …, string | null>`, so a property added to any of them does not compile until somebody says whether the model should be able to ask for it; `coverage.test.ts` stamps the gap list, so a new one fails the build instead of being discovered three phases later. Nothing it reveals is implemented — the list is the deliverable.
- feat(sdk/domain): `DomainEntity.tabs: { kind, because }[]` — notes, documents and tags are OFF by default and turning one on carries the reason, for the same reason a snapshot carries `reason`. Without it, "on purpose" and "out of habit" read identically six months later.
- fix(sdk/domain): `behavior.state.reachability-not-verifiable` (info) — an effect that writes the state field with an EXPRESSION counts as an entry to every key, which silences both `unreachable` and `dead-end` for that entity. That loosening is the safe direction and it was silent: a clean report read as "everything is verified" when the honest reading is "nothing here can be verified". It now says which transition did it and how many keys it covered.
- test(sdk/domain): `pipeline.test.ts` — one rule sentence through model, validation and plan, with every screen rule asserted, plus reapplication: the same rule twice proposes nothing, a changed rule proposes only the delta, and a rule that lost an entity proposes disabling. The three false-positive corpora now assert the whole screen plan too, and the only fixture change since they were written is a `description` on each gesture transition — the vocabulary did not exist when they were.

#### [9.24.0] — 2026-08-27

- fix(sdk/domain): `BehaviorInvariant` now declares `enforcement: 'blocks' | 'reacts'`, required on `scope: 'transition'`. The single scope mapped to the workflow condition plus an `exit` step and the table read "refuses the passage" — which is false on an `entity-event` trigger: `publishWorkflowEventOnEntityChange` is an `onDocumentWritten`, so by the time the event exists the document is committed, and `exit` is `halt: true`, which halts the rest of the flow and nothing else. A rule someone wrote as a barrier was installed as an after-the-fact notice, and the plan said otherwise. `BEHAVIOR_MECHANISMS` now carries a row for each, and the `blocks` row names the only two mechanisms on the write path: the field rule the repository throws on, and the record action's `disabledWhen`.
- feat(sdk/domain): three detectors for the rule declared in the wrong place — `behavior.invariant.transition-without-enforcement`, `behavior.invariant.blocks-after-the-fact` (a blocking rule on a save or clock trigger, or on `scope: 'record'`, whose only mechanism is the `validate-object` STEP) and `behavior.invariant.transition-unknown`, which nothing checked before.
- fix(sdk/domain): `mapTransition` returns a `fromCheck` per trigger, and the workflow condition it emits now resolves. It emitted `<field> == "<from>"` for `workflow.called` too, whose catalog entry has `fields: []` and `hasOld: false` — the condition resolved against nothing, so the `from` was decoration on every user-action transition. It is now `<parameter>.<field>`, with the `EntityReference` parameter named, plus the action's `record.<field>` as what actually stops the person; on `.saved` the check reports `old.<field>` and `changeType == "created"`, both already published in the payload.
- fix(sdk/domain): a transition triggered by a delete no longer maps to a state `upsert` — it would resurrect the document that was just removed, holding one field.
- fix(sdk/domain): `behavior.state.unreachable` and `behavior.state.dead-end` count a cross-entity effect that writes the state field. The detector only looked at transitions of the state's own entity and refused the commonest shape there is ("finishing the class completes every enrollment in it"); a literal value counts as that key, an expression counts as all of them.
- test(sdk/domain): the three false-positive corpora carry behavior now — states, transitions and invariants, written as a modeller would. The `unreachable` above was found by them, and no fixture was adjusted.


#### [9.23.0] — 2026-08-27

- feat(sdk/domain): the domain model gained its missing half. `DomainModel.behavior` declares
  `states`, `transitions` and `invariants` — what happens to a record, when, and who may — and it is
  read by the SAME gate: `validate_domain_model` validates structure and behavior together, because
  they cannot be checked apart. A state lives in a field, an effect writes to a collection, a total is
  a derived field; two gates would each answer about the half it does not hold, and the second one
  would only ever be called by whoever remembered it existed. `A_STATE_IS_A_KEY` names the rule the
  way `SCREEN_IS_NOT_AN_ENTITY_MODEL` names the other one.
- feat(sdk/domain): `behaviorMapping.ts` is the translation table, sibling to `STORAGE_MECHANISMS` and
  written for the same reason: every trigger, guard, effect, invariant and permission names a
  mechanism that exists, by its real identifier, and every step it cites is checked against
  `CORE_STEP_DEFINITION_IDS` / `CONTROL_STEP_TYPES` in the test. `entity-event` becomes a workflow on
  `<eventPrefix ?? collection>.saved`; `user-action` becomes a `workflow.called` definition plus the
  record action that invokes it; a guard becomes a `Condition` node and never a `script` step; an
  effect becomes `upsert` / `remove` / `notify` / `call-workflow`; a total becomes NO step at all,
  because it is a field `aggregation` the kernel recomputes. `SCHEDULE_TRIGGER_SUPPORTED` is derived
  from `WORKFLOW_EVENT_CATALOG`, so the refusal disappears on its own the day a time-based event is
  published — the alternative was a sentence in the docs that stays true until someone adds the
  mechanism.
- feat(sdk/domain): nineteen detectors, each with a positive and a negative test, registered in the
  same `Record<DomainIssueCode, Detector>` the documentation and `AGENTS.md` already read from. The two
  that had no way of being caught before: `behavior.effect.self-trigger-loop` — an effect writing back
  into the record that triggered it, which converges only when the flow's condition stops matching
  (the state moved) or the second pass writes the same value (the platform does not publish when the
  document did not change, which is the same property that makes recomputing an aggregate safe); and
  `behavior.transition.compares-label` — a `from`/`to` naming an option's LABEL, which works the day it
  is written and stops at the first rename, silently, because the identity is the key.
- feat(sdk/domain): `behavior.transition.permission-on-event-trigger` refuses a permission on a
  trigger with no actor. `accessFns.ts` answers `false` when `context.actor` is absent — granting on
  the absence of a person would turn "nobody triggered this" into "can do anything" — so such a flow
  never runs, and nothing reported it. `behavior.transition.actor-without-permission` is the other
  direction: the actor a rule names ("the manager") is declared so that its missing permission becomes
  a comparison instead of a judgement.
- feat(sdk/domain): two refusals with no mechanism behind them, each carrying the path that does
  exist. `behavior.transition.schedule-unsupported`: no event here is time-based and `Delay` was never
  registered, so a plan that accepted a clock would promise a charge nobody ever sends.
  `behavior.invariant.cross-record`: no layer enforces uniqueness — not the field rules, not
  `validate-object`, not the security rules — and the closest declarable thing is a check AFTER the
  fact, which must be presented as one because two writes at the same instant both pass.
  `behavior.guard.needs-other-records` points at the `query` step rather than working around it.
- feat(sdk/domain): `PlannedLookup.options` carries the state keys as SEED options, which is the one
  artifact the behavior half owns — `LookupModuleTemplate.options` is written only when the collection
  is empty, and it is the only place an option key can live in a package. Without it an installed
  state machine has no state to pick, and the first key the office typed differently would stop every
  transition.
- feat(sdk): the behavior vocabulary is published in the barrel, for the reason the domain half was: an
  author tests their own `domain-model.json` in their own `npm test`, and a rule that exists only in
  the dialogue with the agent is not a rule. `sdkSurface.test.ts` carries both new lists. It does NOT
  move `KERNEL_VERSION`: nothing here reaches the installed `.json`, and the seed options are a
  manifest property that already existed.
- docs(sdk/node): `AGENTS.md` §8.0.1 and `microteia://domain-model/rules` are derived from
  `BEHAVIOR_MECHANISMS`, including which rows are refusals, and they say what stays a JUDGEMENT: which
  states the business actually has, and whether an actor named in a rule is a new permission or one a
  collection already yields for free.

#### [9.22.0] — 2026-08-27

- feat(sdk/node): the MCP catalog can finally see what an office RUNS. It read the `plugin.ts` files
  in the authoring directory plus the two entities `entityRegistry.ts` still declares, and that left
  out the two things that matter most in a real installation — a screen built in the Form Design and a
  third-party extension already installed. `domain.field.belongs-to-other-entity` could not fire
  against the entities it exists for: `Sale.customerName` is a defect only BECAUSE Customer is a thing,
  and Customer was invisible. `installedCatalog.ts` reads a snapshot the Console exports, when one is
  present; `workspaceCatalog.ts` adds it to what it already read. Without the file nothing changes.
- feat(sdk/domain): `CatalogScreenInput.source` and a third value on `CatalogEntity.source`,
  `installation`. Precedence is settled in `buildDomainCatalog` and again where the two lists are
  joined: a collection in both sources resolves to the WORKSPACE one — it is the copy being edited —
  and the installed screen is dropped whole, never merged. The divergence is reported as information.
- feat(sdk/node): every answer that uses the catalog carries `catalogSources` — which entity came from
  where, when the snapshot was taken, how old it is, which collections only the installation has, which
  are shadowed, and what the snapshot omits. `list_entities` already refused to present a partial list
  as complete; that posture now covers `validate_domain_model` and `generate_artifact_plan`, whose
  verdicts are only as complete as the catalog behind them.
- feat(sdk/node/workspace): `installed-catalog.json` joins `REQUIRED_IGNORES`, through the existing
  reconciliation policy — it adds the line, never rewrites what diverges. It is spelled out even though
  `*.json` already covers it: it is dropped for a different reason from the others, being tenant data
  and not a build artifact.
- fix(sdk/domain): `domain.entity.collection-exists` now says WHERE the collection already exists.
  "It exists" reads differently when it is in the `plugin.ts` you are editing and when it is already
  running in the office.

#### [9.21.1] — 2026-08-27

- fix(sdk/domain): the validator refused GOOD models. Three complete, realistic models — a support
  desk, a clinic, a school — written without any care for the checks produced four errors, all false:
  `Ticket.requesterCode`, `Ticket.agentNotes`, `Appointment.insuranceCode` and
  `Enrollment.studentNumber`. In all four the data belongs to whoever declares it, and the detector
  was reading "talks about X" as "belongs to X". No fixture was adjusted; two detectors changed.
- fix(sdk/domain): the suffix now decides the weight of the evidence. `name`, `email`, `phone`,
  `document`, `address` describe the OTHER entity and nothing else; `code`, `number`, `status`,
  `notes` describe the relation seen from this side just as well. An ambiguous suffix counts as
  identity only when the target actually declares that field. `domain.field.prefix-group` needs two
  identity hits and stays an error; a single hit is `domain.field.belongs-to-other-entity` and drops
  to **warning** — one field is a smell, and a gate that blocks on a smell is a gate people learn to
  route around, after which it protects nothing.
- feat(sdk/domain): `domain.field.reference-without-relationship` now also refuses a foreign key held
  as a plain scalar (`<knownEntity>Id`). It is not ambiguous in either direction, and it is what keeps
  the gate load-bearing after the downgrade above.
- fix(sdk/domain): `domain.field.prefix-group-unnamed` no longer fires on keys produced by embedding a
  value object. The concept has a name — the platform itself flattened it — and the model says so.
- feat(sdk/domain): a declared exception survives the cycle. `source` and `reason` on a snapshot have
  nowhere to live in `FieldDefinition` (every candidate property is text a person reads), so the
  artifact ships a plain column and the next session raised the same field again, forever.
  `CatalogException` carries the declaration on the plan (`applyPlanToCatalog`) and, between sessions,
  in `<folder>/domain-model.json` beside the `plugin.ts` — a workspace file, so the shape of the
  installed package is untouched and `KERNEL_VERSION` does not move. It comes back as
  `domain.field.exception-on-record`, an info that names the source, the reason and the file.
  Making it survive into the INSTALLED artifact would need a new property on `FieldDefinition`; that
  moves the kernel contract and is not this change.
- refactor(sdk/node/mcp)!: eight of the sixteen tools took no argument and did nothing — they were
  documents costing an input schema in every agent's context, in every session, including one opened
  only to validate a package. `list_entities`, `list_extension_points`, `list_workflow_steps`,
  `list_workflow_events`, `list_record_commands`, `list_expression_functions`,
  `list_workspace_plugins` and `workspace_info` are now resources under `microteia://`. Their bodies
  are unchanged. **Breaking for any client prompt that called them by name**; the guides that name
  them travel with the kernel and `microteia-plugin sync` rewrites them. The rule from here: takes an
  argument or changes something, it is a tool; hands back a document, it is a resource.
- fix(sdk/domain): the multi-reference materialisation ceiling in the storage table comes from
  `MULTI_FK_MATERIALIZE_LIMIT` instead of a hand-written "50", with a test that refuses a second
  literal in the guide.
- test(sdk/domain): `corpus.test.ts` — three complete models that must validate with zero errors AND
  zero warnings, plus one case per false positive that actually happened, and proof that the real
  defects are still caught inside those same models.

#### [9.21.0] — 2026-08-27

- feat(sdk/domain): a formal domain model layer, run BEFORE any artifact is generated. `src/sdk/domain/`
  carries the model (entities of kind entity|child|lookup|valueObject, fields carrying a `semanticType`
  of scalar|reference|snapshot|derived|embedded, and relationships), a deterministic validator, and an
  artifact planner. Nothing of it reaches an installed package, so `KERNEL_VERSION` stays at 2.7.0; the
  symbols are authoring-only, like `AuthoredPlugin`. The rule it exists to enforce is named in the code
  and in both generated guides: "A screen is not an entity model." A request describing what someone
  SEES used to become one entity holding everybody else's data — a package that validates, installs and
  runs, which is why nothing else here ever refused it.
- feat(sdk/domain): `validateDomainModel` refuses, with severity error|warning|info and a fixed issue
  shape `{ code, severity, entity, field, message, suggestion, howToDeclareException }`: a scalar field
  that is an attribute of another known entity; a group of fields reproducing one; a collection modelled
  as numbered fields; a many-to-many with its own attributes stored as an array of ids; and a field
  typed `snapshot` without both `source` and `reason`. Duplication is not forbidden — the rule is that
  source-of-truth data stays normalized unless a semantic reason is declared, which is what makes a line
  item's frozen unit price pass.
- feat(sdk/domain): `derived` carries `derivedFrom: 'self' | 'children'` because the two are different
  mechanisms here — a `compute` expression cannot see child records and would return zero forever, with
  nothing reporting it. `domain.aggregation.multi-via` refuses an aggregation over a `multi` reference
  for a checkable reason: the recompute reads the parent id out of the child's field as a single value
  and queries by one equality, so an array never matches.
- feat(sdk/domain): `STORAGE_MECHANISMS` maps each relationship storage (reference, child, association,
  lookup) to the declaration the platform actually accepts, and refuses loudly where none exists —
  `onDelete: 'cascade'` and `'restrict'` have no mechanism (there is no cascade between business
  entities), so they are errors pointing at the workflow on `<collection>.deleted` that does exist.
- feat(sdk/domain): `buildArtifactPlan` returns a DIFF against the existing catalog, never a creation.
  Field key and type are immutable, a single/multi change is refused as needing a declared migration,
  nothing is ever removed, and changing an extension raises its version. `applyPlanToCatalog` makes the
  second-run-proposes-nothing property a test rather than a promise.
- feat(sdk/domain): embedded value objects are flattened with a `section` (`EMBEDDED_STRATEGY`), the
  platform having no object field and no dotted field key, and the leaves therefore staying reachable
  from compute, validate and the list filter.
- feat(sdk/node/mcp): `list_entities`, `validate_domain_model` and `generate_artifact_plan`, plus the
  `resources` capability with `microteia://domain-model/schema`, `microteia://entities` and
  `microteia://domain-model/rules`. Every enum and table in them is derived from the kernel. The
  existing thirteen tools are untouched.
- feat(sdk/node/workspaceCatalog): the catalog is read from the `plugin.ts` files of this workspace plus
  `ENTITY_REGISTRY`, and says so — it does not read the organization's database, and a screen built in
  the Form Design is not listed.
- docs(sdk/workspace): AGENTS.md and AUTHORING.md carry the modelling step, with the storage table and
  the detector list derived from the validator. `CLAUDE.md` and `README.md` of `extensions/` untouched.
- fix(sdk/node/mcp): `list_workspace_plugins` pointed at `microteia-plugin new`, a command that does not
  exist; the guide's loop did the same. Both now say `create`.

#### [9.20.0] — 2026-08-26

- test(i18n): `declarativeCatalogs.test.ts` sweeps every DATA catalog of the kernel —
  `ENTITY_REGISTRY`, `LOOKUP_REGISTRY`, `CORE_FIELD_RULE_PRESETS`, `CORE_STEP_CATALOG`,
  `WORKFLOW_EVENT_CATALOG`, `KERNEL_PERMISSIONS` — and requires every label to BE a message
  reference. It exists because the same failure came back from five different places through the same
  gap: ESLint only sees a Portuguese literal when it has an accent or sits loose in JSX, and
  `'Membro'`, `'Documentos'`, `'Tipo'`, `'Lista'`, `'Objeto'`, `'Campo'` have neither. Widening the
  accent trigger would flag every identifier in the project; a guard on the SHAPE OF THE DATA is
  language-agnostic by construction — mutation-verified with a Portuguese label AND an English one.
  The check is `isMessageRef`, not `startsWith('@')`: `@core.data` without the slash is not a
  reference and would pass the looser test until someone opened the screen.
- fix(i18n): the sweep found `LOOKUP_REGISTRY` — the last one. `screenLabel: 'Documentos'`,
  `entityLabel: 'Tipo'`, and `getLookupLabel` gluing them with `:`. Concatenation was the defect
  twice over: it pinned both labels in code and pinned the separator with them, which is where the
  language hides. `lookupLabelRef` now returns a reference plus params, and the composition
  (`'{screen}: {entity}'`) lives in the catalog. Four display sites resolve it: the schema lookups,
  the store's, the field's lookup selector and a parameter's.
- fix(i18n): `PathSuggestion.detail` was Portuguese written in a module the BACKEND also compiles —
  `'Lista'`, `'Objeto'`, and `` `Lista: ${…}` `` composed. It gains `detailParams`, and the three are
  references now.
- feat(automation): `LOOKUP_COLLECTION_OPTIONS` was a MODULE const, which is why its label had to be
  ready-made text — there is no hook outside a component. It became `buildLookupCollectionOptions(label)`,
  memoized by the screen.

#### [9.19.5] — 2026-08-26

- fix(i18n): `pathAutocomplete` had the last literal of the expression editor's seven groups —
  `category: 'Campo'`, in Portuguese, in code, while the other six already came from
  `t('expression.category.*')`. It is now the `@core.ui/expression.category.field` reference.
- fix(i18n): writing the test for it surfaced a second one in the same object. A suggestion's
  `description` is built from `suggestion.label`, which is the FIELD's declarative label — and the
  kernel's own fields carry references: `changeType` declares
  `@core.automation/event-field.change-type`, and that key was what the editor showed. Both `label`
  and `detail` now resolve.
- fix(i18n): the resolver parameter of `buildPathAutocompleteItems` lost its default. A default that
  returns the text unchanged turns "the caller forgot the resolver" into "the key shows up on screen",
  which is the silent failure this module already had — and the second call site (`input-field` mode)
  was in fact not passing one.
- test(i18n): the test catalog answers in ENGLISH on purpose. With `'Campo'` in it, the assertion
  passed both with the resolved key and with the literal it replaced — a test that cannot tell the two
  apart is not a test. Mutation-verified after the change: both fixes fail their assertion when undone.

#### [9.19.4] — 2026-08-26

- fix(i18n): the note/document event labels were BUILT by concatenation —
  `\`${labelPrefix} de ${parent.labelSingular}\`` and `\`Ao salvar: ${label}\`` — pinning two pieces of
  interface text in code, with the preposition between them pinning the language too. They are now
  references composed by the message engine: `event.nested-item` (`{item} of {parent}`) reached through
  `labelParams`, with `event.note` and `event.document` as the item. Inert today (both parent arrays are
  empty), which is exactly why it was a landmine: it would have produced Portuguese the day someone
  filled them.
- fix(i18n): `resolveEventCatalogLabel` resolved `labelParams.name` by hand and THREW THE SIBLINGS AWAY.
  Enough for one turn, broken on the second: the nested message came out as
  `Ao salvar: {item} de {parent}`. It now hands the params to the engine, which is what `resolveParam`
  was built for — it resolves a reference inside a param and carries the siblings into the nested
  message. Mutation-verified: the previous form fails the new test with exactly that string.
- test(i18n): the event-catalog test uses the REAL resolver instead of a hand-rolled fake, because what
  it guards is the engine's nesting — a fake that interpolates by hand would pass even if the engine
  stopped doing it. Plus the rule that was missing: every catalog entry's label must BE a reference, not
  built text. A concatenated label does not start with `@`, so the older "nothing reaches the screen
  raw" assertion walked straight past the Portuguese.

#### [9.19.3] — 2026-08-26

- fix(i18n): `members` carried `labelSingular: 'Membro'` / `labelPlural: 'Membros'` — Portuguese
  literals in `ENTITY_REGISTRY`, the last entity not to use a reference, while its own FIELDS already
  did. Neither rule saw it: not JSX, and neither word has an accent. Now `@core.data/member.singular`
  and `@core.data/member.plural`.
- fix(i18n): the ripple that made it worth doing. An entity label reaches the screen through
  `pathAutocomplete` (the expression editor's suggestion detail) and `useEntityReferenceOptions` (a
  parameter's entity selector), and neither resolved — so a screen an extension declared already showed
  `@ns/screen.singular` in both, before `members` ever joined them. `buildPathAutocompleteItems` takes
  the resolver as a parameter, since the module is pure and its caller already has one.

#### [9.19.2] — 2026-08-26

- feat(i18n): `LabelInput` accepts `as`, so a screen with its own styled field does not have to choose
  between its shape and translating what it shows. Without it the only way into `PluginAuthor` — which
  has its own `S.Input`/`S.Textarea` — would have been repeating the mechanism there, and a repeated
  mechanism is the one that drifts.
- fix(i18n): `PluginAuthor` uses it, and the argument for keeping it raw did not hold. The objection
  was that there the person typing is the one CREATING the reference. But the authoring screen does not
  package only what the author just wrote: it packages what the ORGANIZATION built, and whatever is
  already carried from another extension arrives with that extension's reference. Name, version,
  summary, description and a code view's title now use it; the IDENTIFIER stays a plain field, because
  it is not a label — it is the package's address. On the version field the component is inert by
  construction: a semver never matches `isMessageRef`.
- fix(i18n): the "Content" tree resolved nothing — `@com.acme/screen.request.plural` on one line and
  `Pet1`, an organization's own screen, on the next. Half a screen in text and half in keys is worse
  than either one whole. Both the carried artifacts and the organization's own now resolve, and a
  patch's target label with them.
- test(i18n): `PluginAuthor.viewmodel.test.tsx` pins the mixed tree — carried resolves, office-typed
  passes through, no row starts with `@`, and the FORM still holds the real value, which is what
  reaches the manifest. `declarativeFields.test.ts` grows the five new fields. Both mutation-verified.

#### [9.19.1] — 2026-08-26

- fix(i18n): the Form Design's own fields still showed the raw reference. `LabelInput` was built in the
  previous version but not applied where the rule had originally been WRITTEN — `ScreenBuilder`, whose
  "labels stay raw" was a choice between two defects, not an answer. The five fields that hold a
  declarative label there now use it: both screen titles, and a field's label, section and placeholder.
- fix(i18n): the reflections inside `ScreenBuilder` — the field list rows, the delete-screen and
  delete-field confirmations, and the chip of a static option — resolve. The option's chip TEXT resolves
  while its identity stays raw, because the raw label is what `removeStaticOption` addresses.
- test(i18n): `declarativeFields.test.ts` pins each declarative-label field to `LabelInput`. A source
  test, like `viewSources.test.ts`, and for the same reason: what is being guarded is a writing
  decision. Verified by mutation — putting one field back on `Input` fails it.
- docs(i18n): the "where the label stays raw" paragraph is marked as superseded in part, instead of
  being deleted. `PluginAuthor` stays raw, and the reason is now written down: there the person typing
  is the one CREATING the reference, and the catalog it points at lives inside the package being
  authored — possibly not installed, and possibly the very thing being changed.

#### [9.19.0] — 2026-08-26

- feat(i18n): `LabelInput` (`components/ui/LabelInput/`) is the field that edits a DECLARATIVE label.
  At rest it shows the translation; on FOCUS it reveals the real value, which is what is about to
  change. Outward, `value` and `onChange` are the real value on both sides — the translation exists
  only on screen, and no other component can reach it, which is why none of them had to change. The
  two halves of the problem looked mutually exclusive: showing the raw reference leaves text on screen
  nobody reads, and showing the translation makes the next Save write over the reference. `isMessageRef`
  decides whether there is anything to reveal, so office-typed text behaves as a plain `Input` instead
  of swapping content under the reader's hand. Applied to the seven fields that hold one: workflow
  name and description, action title and confirm message, script name and description, parameter label.
- fix(i18n): three more raw reflections. The Form Design "Actions" tab labelled its options with the
  ACTION's title, the Actions screen labelled each expression editor with the flow PARAMETER's label,
  and the parameter accordion header showed the key. None of the three is the value being edited — the
  "Form Design keeps labels raw" rule is about the screen it edits, and had been read one size too wide.
- fix(i18n): the step editor derived input and output labels from a target flow's or script's
  parameters without resolving them. `parameterForDisplay` moved out of `RunModal` into
  `shared/parameterInputs.ts` — which already called itself the single bridge between what a workflow
  ASKS and what a screen SHOWS — and now covers all four consumers from one place.
- fix(i18n): `'registro filho'` was a Portuguese literal in `ScreenBuilder`, inside the migrated zone.
  It is not JSX and has no accent, so no rule saw it; the non-accented non-JSX literal stays a known
  blind spot, since widening the accent trigger would flag every identifier-shaped string.
- test(i18n): the regression guards the reports asked for — `LabelInput`'s whole contract,
  `parameterForDisplay` over label/options/nested fields plus idempotence, `resolveEventCatalogLabel`'s
  two turns, and one guard per reported screen (`ScreenBuilder.actionOptions`,
  `ViewAction.promptableParameters`, `WorkflowParametersEditor.headerTitleFor`). Each was verified by
  mutation: dropping the `label()` call fails the test.

#### [9.18.1] — 2026-08-26

- fix(i18n): the automation admin screens resolved no declarative label. Workflow, Action and Script
  names arrived from an extension as `@ns/key` and were rendered raw in the list, the tab title, the
  page header, the delete confirmation, the ⌘K, the markdown mention and every selector that offers a
  flow or a script. `useLabel()` now runs at each of those display points; the FORM fields stay raw,
  because there the reference is the value being edited — the same rule that already held for
  `ScreenBuilder` and `PluginAuthor`.
- fix(i18n): searching is part of resolving, again. The three lists matched the query against the raw
  name, so a flow an extension installed was reachable only by whoever typed its message key.
- fix(i18n): record actions were half resolved. `useRecordListViewModel` translated a card action's
  title while `useScreenActions` did not, and neither confirm dialog nor the parameter prompt did —
  the same action read translated on a card and raw in the toolbar above it.
- fix(i18n): parameter labels and their `select` options now resolve at the entry of `RunModal`, which
  is the ONE modal that asks for parameters (manual flow run, script run, action that prompts). One
  point covers the three, instead of three that each had to remember.
- fix(i18n): `useStepCatalog` resolved a step input's label but not its STATIC options, so the
  severity list of `register-audit` showed `@core.automation/step.register-audit.label.alta`.
- fix(automation): `DataProcessor` sent the model each flow's description RAW. A message reference
  describes nothing to a model — the flow it picked was chosen from a key, not from a description.
- refactor(i18n): `resolveEventCatalogLabel` moves the two-turn composition of an event label
  ("On save: {name}", where `name` is itself a reference or office-typed text) into
  `domain/schema/eventCatalog.ts`, shared by the trigger selector and the mention modal.
- feat(lint): `no-restricted-syntax` now catches user text as a literal inside JSX BRACES — plain,
  ternary and logical — as a child of an element or fragment. `{w.enabled ? 'Habilitado' :
  'Desabilitado'}` crossed the migrated zone untouched: not `JSXText`, not an attribute, no accent in
  either word. Attribute values stay out on purpose: there the literal is almost always a technical
  enum. The rule found one more, in `AuditLogs`.

#### [9.18.0] — 2026-08-26

- feat(boot): `BOOT_PLUGINS` is the base host: the core plugins plus the extensions STAMPED into the
  installation, read from `window.__MICROTEIA_EXTENSIONS__`. It closes the gap the previous version
  left open — the sign-in screen runs above the organization, so nothing an organization installed can
  reach it, and `auth.provider` had no source but the bundle.
- feat(boot): stamped packages are always `trusted: false`. Nothing stamped runs JavaScript, and that
  is not caution: it is what allows an installation to put an SSO live without anyone reviewing code.
  Their effect is BEFORE sign-in only — inside the organization what applies is what the organization
  installed, or a stamped extension would appear in every organization's menu with nobody having
  installed it.
- feat(boot): `PRE_LOGIN_POINTS` names the points that take effect at boot — `auth.provider`,
  `i18n.messages`, `theme.definition`, `theme.tokens`, `ui.slot`. `pack` derives it into the package
  manifest so the Console never knows it by heart: the Console ships separately, and a copy there would
  silently describe another version's contract.
- feat(boot): `parseStampedExtensions` is a pure function, separate from the window read, and it
  discards rather than throws. This is the first code that runs on the page: an interrupted deploy, a
  hand edit or a stale cache all produce the same half-written file, and there an exception is a blank
  screen.
- feat(hosting): `index.html` loads `/microteia-extensions.js` beside `/firebase-config.js`, and
  `public/microteia-extensions.js` is the empty placeholder — with no stamp, `npm run dev` and the
  TARGET builds behave exactly as before.

#### [9.17.0] — 2026-08-26

- feat(auth): `auth.provider` is the sign-in screen's extension point, and it accepts NO
  implementation. A corporate SSO fits entirely in a declaration — Firebase Auth already speaks OIDC
  and SAML, and what the package adds is the id — so requiring `code` would have made single sign-on a
  first-party privilege, which is the opposite of what it needs to be. `KERNEL_VERSION` goes to
  `2.7.0`.
- feat(auth): `IAuthRepository` has one entry path, `signInWithProvider(spec)`, in place of one method
  per provider. `signInWithGoogle` and `signInWithFacebook` forced the repository to know every way of
  signing in up front, and an organization's SSO has no way of being written there. The Facebook path
  never reached the screen at all — the symptom of a hand-written path nobody walks.
- feat(auth): `flow: 'redirect'` and `consumeRedirectResult()`. Redirect is the only path that works
  where the popup is blocked — a hardened corporate browser, an iframe, an embedded app. What needs
  `getRedirectResult` is the ERROR, not the user: without it a refused SSO returns the person to the
  sign-in screen without a word.
- refactor(auth): `authErrorKey` moved from `Login.viewmodel` to `domain/schema/auth`. It has two
  readers now — the screen on click, the boot on the way back — and two copies would guarantee a new
  code was handled in one of them. Four codes joined it: popup blocked, popup closed,
  account-exists-with-different-credential, operation-not-allowed.
- feat(auth): declaring `password` through the same point is what lets an installation that requires
  single sign-on simply omit it — the form, the sign-up link and the password reset then disappear
  together, because the three only exist for whoever has a password here.
- feat(ui): `LOGIN_SLOT_SURFACES` (`login.header`, `login.footer`) host `ui.slot` on the sign-in
  screen. `useOptionalAuthorization` and `useOptionalSettings` are the doors for that area: above the
  organization there is no permission and no settings document, so a slot that asks for a permission is
  dropped — absence closes rather than opens. They are separate doors on purpose; had
  `useAuthorization` returned `null` instead of throwing, every consumer inside the organization could
  forget the check with nothing complaining.
- feat(sdk): `authProvider` and the `auth.provider` contract join the barrel. The authoring guide
  derives the provider kinds from the union instead of listing them in prose.

#### [9.16.0] — 2026-08-26

- feat(ui): two extension points open the shell to a package — `ui.slot` puts content into a named
  region of it (`sidebar.header|footer`, `top-bar.left|right`, `status-bar.left|right`, listed in
  `WORKSPACE_SLOT_SURFACES`), and `ui.menu` adds an entry to a menu. Until now an installation had
  nowhere to put its own mark: nothing reached the top bar, the footer or the sidebar without a commit
  in the kernel. `KERNEL_VERSION` goes to `2.6.0` — both points are additive.
- feat(ui): a `ui.menu` entry carries no `impl` at all. What it does comes from a closed `action`
  union — `{ kind: 'openTab', tabKey }` or `{ kind: 'url', href, newTab }` — so a package that ships
  no JavaScript can still contribute to a menu. An unrecognised action drops the ITEM, never the menu.
- refactor(shell): the eight hand-written entries of the user menu left
  `WorkspaceSidebar.view.tsx` and became `menuItem(...)` contributions of the plugin that OWNS each
  screen. The kernel knew `screen-builder`, `data-processor` and `marketplace` by name, so removing the
  owning plugin left the row behind, opening a tab nobody can render.
  `workspaceSurfaces.test.ts` asserts the order, the icons and the permissions are the ones that
  already applied, and that no entry lives outside its owner.
- refactor(settings): `surfaceTabsProperty`, `surfaceSlotsProperty` and `surfaceMenuProperty` are one
  function with the point and key as parameters, and `useSurfaceTabs`/`useSurfaceSlots` are one
  `useSurfaceItems(point, surface)`. Three copies of the same twenty lines would only have guaranteed
  that a later fix reached one of them.
- feat(sdk): `surfaceSlot`, `surfaceSlotSpec` and `menuItem` join the barrel, along with
  `UI_SLOT_POINT`, `UI_MENU_POINT`, `USER_MENU_SURFACE`, `WORKSPACE_SLOT_SURFACES` and the three
  metadata types. The authoring guide derives the region names from the constant instead of listing
  them in prose.

#### [9.15.0] — 2026-08-26

- feat(workflow/steps): two AI steps, `ai-detect-workflow` and `ai-extract-parameters`, in a new backend plugin `core.ai.steps` (depends on `core.workflow` and `core.ai`, so the data steps do not inherit a dependency on a model). Detection reads the callable workflows' own descriptions and never returns an id outside the candidate list; it excludes the running workflow, which the model could otherwise pick with only the call-depth limit to stop it. No match is a SUCCESS with `found: false`, so a Condition can route what did not classify. Extraction builds the schema from the target's declared parameters and coerces the answer through the same `coerce` the Data Processor always used.
- refactor(ai): the detection prompt and the extraction prompt/schema/coercion moved out of the `detectWorkflows` and `runWorkflow` callables into `domain/services/aiWorkflowDetection.ts` and `domain/services/aiParameterExtraction.ts`. They were local constants of two handlers, unreachable from the engine: a second caller had to either import a handler or restate the prompt, and two extractions that accept different things from the SAME document diverge without a symptom.
- feat(workflow/steps): `call-workflow` accepts a target that is not a `Literal` — it can come from an earlier step's output — and a new `params` input carrying the parameters in bulk. `params` is applied first and the per-key `param.<key>` mappings override it: pinning one field by hand is the more specific gesture of the two. Catalog `version` 1 → 2.
- feat(catalog): `InputDefinition.picker` (`workflow` | `script` | `ai-connection`) declares what an input names, and the editor offers the list only while the mapping is `Literal`. The workflow/script picker used to be rendered because the input was the `dynamicInputs` source, so a target chosen any other way got no picker at all and an input that only points at a target could not ask for one. KERNEL_VERSION 2.4.0 → 2.5.0 (additive).
- feat(catalog): `dynamicOutputs.kind: 'from-target-workflow-parameters'` publishes `params.<key>` for a target chosen at design time — the same gesture as a query's projections — so the extraction step feeds the call step with IntelliSense intact.
- test(plugins): the step contributions are now compared against `CORE_STEP_DEFINITION_IDS`, not against a hand-written list. A catalog entry with no contribution shows up in the visual builder and only fails with the flow already running ("unknown StepDefinition"); a contribution with no catalog entry is never offered.

#### [9.14.0] — 2026-08-26

- refactor(plugins/marketplace): the first-party example views now obey the rules the guide states. Calendar was 784 lines in one file and NewsRead 973, with "which day does this card belong to" and "most liked first, newest among equals" living inside a `useMemo` — reachable only by opening the screen and looking. All three are now four files each (view / view model / styles / rules), and the rules files import nothing, so `Calendar.rules.test.ts`, `NewsList.rules.test.ts` and `NewsRead.rules.test.ts` exercise them in a second. 35 cases where there were none. Dashboard stays one file on purpose: a view that only renders what a hook returned has nothing to split, and the guide says so.
- feat(sdk): `mergeViewSources` is published on the SDK surface, and the merge itself moved from `sdk/node/compile.ts` to `sdk/mergeSources.ts`. The embedded catalog hands its package straight to the browser runtime — no terminal, no `.json`, no compiler — so it has to merge at declaration time; a second implementation of the same merge would be a second way for the same package to come out different. Path resolution and the compile check stay with the caller, as hooks. Authors are unaffected: they declare the `sourceFile` list and the compiler merges.
- fix(plugins/marketplace): `viewSources.test.ts` no longer forbids every relative import in a view source — it requires the import to point at a part MERGED WITH IT, deriving the groups from the plugin files rather than from a list beside them. It also guards the shape of every composed view: no hooks in the view, no JSX in the view model, no import at all in the rules, no literal colour in the styles, and a test beside every rules file.
- fix(sdk): the SDK purity detector matched across statements — an `export interface` at the top of a file paired with the first `from "..."` anywhere below it, so `mergeSources.ts`, which imports nothing, was reported as depending on `${specifier}` out of an error message. A real import never has a `;` before its `from`.
- docs(sdk/workspace): the styling rule in `AUTHORING.md` §7 says what it means. Colour has no exceptions (a hex or `rgba()` is what breaks on a theme switch, an alpha suffix on a token colour does not); spacing, type and radius come from a token whenever a token means the same thing, and a genuinely one-off geometry does not get a token invented for it. §7 also explains why a first-party example merges its own sources, so nobody reads `mergeViewSources` as the authoring path.

#### [9.13.0] — 2026-08-25

- feat(sdk/workspace): `AUTHORING.md` §7 and `AGENTS.md` now say what code should LOOK like once declaring is no longer an option. Both documents ranked code last and stopped there, so at the moment writing it was the right answer the guidance went silent — and what came out was a single `.view.tsx` holding state, hex colours and rules no test could reach. §7 adds the three-file split (render / state / styles), the rule pulled out of React into a file that imports nothing and gets a test beside it, and styling through the theme rather than through a literal that stops matching the day the organization switches theme. §12 adds the same division for a Cloud Function: a thin handler over a plain function `npm test` can call, because a function is the one part of an extension that cannot be tried in a second.
- feat(sdk/scaffold): `create` generates the view already divided — `Summary.view.tsx`, `Summary.viewmodel.tsx`, `Summary.styles.tsx`, plus `Summary.rules.ts` and its test — and declares the list in `sourceFile`. The mould is what becomes habit, and it was teaching the opposite: one file, inline `style={{ }}`, hand-written pixels. The styles now read `theme.spacing`, `theme.colors`, `theme.fontSizes` and `theme.borderRadius`, and the generated sources type-check against `microteia-host.d.ts`.
- test(sdk): the mould's shape is now guarded — the view carries no hooks, the view model no JSX, the styles no hex/`rgba(`/`px` literal, and the rules file no import at all; and both documents are checked for the passages above.

#### [9.12.0] — 2026-08-25

- feat(cli/deploy): `microteia deploy` no longer redeploys a Cloud Function the project already runs. Firebase stamps every function with `firebase-functions-hash` — sha1 of the whole source directory plus the resolved environment variables plus the secret versions — and skips unchanged ones in a bulk deploy; deploying one at a time with `--only functions:<name>` marks each as `targetedByOnly`, which is exactly what turns that skip off. The Console now groups the functions by the stamp they carry, deploys one reference function per group, and reads the stamp back: unchanged means the rest of the group is byte-for-byte what the project runs. Worst case is the previous cost; the common case after an `unpack` that only touched the frontend is one deploy instead of 28.
- feat(cli/provision): an extension function whose SOURCE changed is deployed again. Provisioning decided by name and by parameter value, so editing `extensions/<plugin>/functions/` moved nothing — the function kept running the previous code with no command able to reach it. It also requeues a function recorded as applied that is missing from the project or not `ACTIVE`.
- feat(cli): `--all` on `deploy` and `provision` deploys every function whatever the project already runs. It is the answer to configuration changed outside the package — memory, timeout, concurrency, invoker policy — which the stamp does not see, and which a bulk `firebase deploy` does not see either.

#### [9.11.1] — 2026-08-25

- feat(core.ui): `app.tagline` reads "AI-First Application Platform" in the source catalog and in the pt-BR package. It said "Curator of Legal Practice" — a domain name for the product itself, in a kernel that carries no business vocabulary, and the one string that told every installation the platform was for law firms.
- chore(public): logo and favicon assets replaced with the current mark, including the web app manifest icons the installed shortcut uses.
- chore(marketplace): `com.microteia.locale-pt-br` at 1.24.1, so the offices that already installed the translation are offered the new string.

#### [9.11.0] — 2026-08-25

- feat(schema/workflowStepCatalog): the step catalog metadata moves from `functions/` to `src/domain/schema/`, synced back by `sync-schemas`, and each `make…StepDefinition` now spreads `coreStepMetadata(id)` instead of redeclaring it. It was the one large kernel capability an extension author could not enumerate: the SDK, the MCP server and the authoring guide all live in `src/`, the two projects share no code, and the automation documentation stopped at that border. The guide said so out loud — "the one part of a workflow you cannot enumerate from here" — and sent the author to read the Automations screen of a running installation, while the visual builder inside the app held the whole catalog. The agent writing the extension knew less than the screen. `StepDefinition` keeps only the executor. Bumps `KERNEL_VERSION` to 2.4.0.
- feat(sdk): publishes `UpsertStepConfig`, `RemoveStepConfig`, `MapStepConfig`, `ValidateStepConfig`, `UpsertSpec`, `MapFieldMapping` and the catalog surface (`CORE_STEP_CATALOG`, `coreStepMetadata`, `WorkflowStepMetadata`, `InputDefinition`, …). Four of the eleven steps required a type the barrel did not export, so `describe_sdk_type` answered "not published by this SDK" for the exact shape the step needed. The inconsistency was an active trap: `QuerySpec` WAS published and the `query` step really does take one, so whoever learned `query` generalised to `upsert` and wrote `UpsertSpec` — which is not what the step reads, and nothing refused it.
- feat(plugins/workflowIntegrity): step integrity joins the single validation door — unknown `stepDefinitionId`, missing required input, unknown `configuration` key, a mapping `kind` outside `allowedMappingKinds`, a literal the input's own validator refuses, a `{ kind: 'Output' }` naming a step or an output that does not exist, a control node without its `condition`/`loop`, and the unimplemented `Delay`. Validation checked a workflow's script, sub-workflow and trigger-screen references and nothing about the STEP: the package validated, installed, and the flow did not run — the typo surfaced only in the engine log, as "StepDefinition desconhecida", with the flow already executing. The list of defects was not invented here; it was written years earlier in the comment of `scripts/declarativeWorkflow.test.ts`, which already said which errors compile and fail only when someone runs the flow.
- feat(sdk/node/mcp): `list_workflow_steps`, `describe_workflow_step`, `list_workflow_events` and `list_record_commands`. Nine tools and none answered the first question of anyone writing an automation — which steps exist, and what each one takes. `describe_workflow_step` also names the type a composite input needs (`Upsert` → `UpsertStepConfig`), which is the distinction that cost the most.
- fix(sdk/node/messages): the terminal translator loads every core namespace, not `core.marketplace` alone. `list_extension_points` returned `@core.data/point.entity.title` in place of "Domain entity" and dropped `description` entirely — the field that says what a point is FOR. The tool that existed to teach the extension points answered with a list of ids and opaque keys.
- feat(schema/ui/recordActionMetadata): `RECORD_ACTION_METADATA` moves out of `plugins/core.records/recordActionCommands.ts`, which reaches `window` through the deeplink generator. The list is a declaration and the SDK serves it to the author; the commands stay where they are. `tsconfig.sdk.json` caught the layering the root gate does not.
- fix(sdk/node/workspace/authoringGuide): the step catalog table is DERIVED from the catalog, guarded by a test that fails when a kernel step has no row. Three claims in the guide were wrong and each would have been believed: `Delay` was documented as "waits before the steps that follow" and is not registered in the engine at all (the flow stops there); the script example used `op: '=='`, which falls through the engine's switch and quietly matches no rows; and the action snippet omitted `order`, `enabled` and `danger`, which are required. Adds the `workflow.called` section — parameters, their types and their rules — which had one clause for the most-used trigger there is.
- feat(marketplace/automation): `com.microteia.automation-example`, a complete validating automation that travels in `examples/` — a workflow on save, a `Condition` node that branches and converges, a `query`, a `map` feeding an idempotent `upsert`, a called flow with parameters, and an action with `promptParameters`. Every shipped example carried `workflows: []`, and the guide admitted the gap; writing this one is what surfaced the three wrong claims above.

#### [9.10.0] — 2026-08-25

- feat(schema/fieldRules): `logic.derive` — a field value evaluated on every READ and never stored, the counterpart of `logic.compute`. A `compute` that asks the clock (`today()`, `now()`) persists the verdict of the day it was saved: a record stored today as on time stays on time a year later, and nothing ever comes back to correct it. Bumps `KERNEL_VERSION` to 2.3.0 (additive: an installed package may now declare the slot).
- feat(schema/clockGate): the evaluation instant as a module gate, alongside `permissionGate` and `localeGate` — `expr-eval` hands no scope to registered functions, so `FieldExprContext.at` is pushed and restored around the evaluation. One read captures one instant and passes it to every record, so two rows of the same list cannot disagree on what day it is. Restoring resets to NO instant (`configuredInstant()`), never to the clock read on entry — that would pin the clock for the whole process.
- feat(schema/recordRules): `applyDerivedFields` / `deriveFieldValues` / `collectDerivedFieldKeys`, and `formatAndValidateRecord` now drops derived leaves before coercion, formatting and validation. That is what keeps `compute` and `validate` from seeing them: both run on save, where a read-time value would be frozen into the document.
- feat(data/recordRulesGate): `makeRecordDeriver`, the read gate mirroring `applyRecordRules`. A factory per READ, not per document: targets resolve once instead of once per row, and the instant is captured once. `FirebaseRecordRepository.mapRecord` is the single door records enter the front through, so lists, cards, filters, ordering and action expressions see derived values like any stored field.
- feat(workflow/query): `runWorkflowQuery` derives over the hydrated rows before predicates and ordering, and never pushes a derived predicate down as a Firestore equality filter — pushed down it would query a field that is not there and come back empty, which is indistinguishable from "no record matches".
- feat(screen-builder): the derived-value editor, plus four authoring refusals — `compute` and `derive` on the same field, a `compute` depending on a derived key, an `aggregation.field` pointing at one (the aggregate IS stored, so it would freeze the same way), and a cycle among derived fields, whose graph is separate from the computed one.

#### [9.9.0] — 2026-08-24

- feat(pack): the manifest written BESIDE the tarball carries `tarball: { name, bytes, sha256 }`, and the copy inside the tarball does not — a manifest cannot describe the file that contains it. That asymmetry is the whole reason the external copy is now written after `tar` instead of with the internal one, and it is declared on `KernelManifest.tarball`. Nothing carried a checksum before: while the package was handed over as a file, the transport was trustworthy by construction, and it is not once it is downloaded.
- feat(sdk/authoring): `AGENTS.md` teaches `microteia unpack --version latest` as the way to take a new platform version, keeping `--kernel <package>.tgz` as what it now is — the path for a machine that cannot reach the published catalog.
- `MINIMUM_CLI_VERSION` stays at `2.1.0`: the new field is additive and an older Console ignores it, and a package published to the catalog can still be installed from a downloaded file by a Console that knows nothing about catalogs.
- `KERNEL_VERSION` is untouched. None of this reaches the installed package's shape.

#### [9.8.2] — 2026-08-24

- fix(core.tenant/ai): the connection form owns its own error. `error` was one piece of state serving both the tab (load, delete, set-default) and the modal's save, so a failed validation stayed painted behind the modal after Cancel — the modal had closed and the message it wrote had not. `formError` is separate, renders inside `ModalContent`, and is cleared on open, on close and on any field change; `ai.save-failed` moved with it, for the same reason.

#### [9.8.1] — 2026-08-24

- fix(core.tenant/ai): the model field is a `SearchSelect` over the provider's known models, not a free `<input list>`. Its placeholder was `e.g. gpt-4o`, which reads as a value already filled in — the field was blank, and a connection saved that way reached the provider with no model at all. Providers with no known list (`other`) keep a text input, and a model already stored that the list does not carry is added to the options so editing never drops it.
- feat(core.tenant/ai): the connection form validates on save instead of disabling the button. `validate()` returns the errors per field, `handleSave` refuses and renders them under each control; `canSave` is gone. A disabled button states that something is wrong and never which one — name, provider, key, model and max tokens each say so now, and the model is required, which it always was for the call to work.

#### [9.8.0] — 2026-08-24

- feat(kernel/manifest): `PluginManifest.license` — an optional `WidgetSpec` holding the terms whoever authored the extension sets. It lives on the manifest, not beside the package's `overview`, because its second reader is the organization's Terms page, where no package is in hand and `host.manifestOf` is all there is. `KERNEL_VERSION` goes to 2.2.0: additive to the shape of an installed package.
- feat(license): the Terms page appends the terms of every extension the Kernel LOADED — `collectPluginLicenses` over `host.loadedIds()`, not over the installed copies. A deactivated extension, one refused for a missing dependency and one owing a data migration are all installed and none is live, and terms that do not apply have no business in a document whose whole job is to state what does.
- feat(core.license): the plugin now contributes a `license` page. `/license` stays public and untouched — whoever has no account yet must be able to read it — but there the host is the base one and the sum is empty by definition. The tab is the same `LicenseView` under `TenantKernelProvider`; the status bar opens it instead of a new window, and ⌘K finds it.
- feat(marketplace): a licence icon on each extension's row opens its terms, before installing included. The renderer descends under `PackageLocaleProvider` for the same reason `overview` does — the package may not be installed, and without its catalog the terms would render as raw keys.
- fix(license): `License.styles` traded `min-height: 100vh` for `height: 100%` with `overflow-y: auto`, and the page contribution declares `fullBleed`. On the public route the parent has no height, the percentage does not resolve and the page grows with its content; inside the panel it takes `PanelContent`'s height and scrolls within.
- chore(news): the example extension declares terms, so the round trip is exercised by something that ships. It goes to 1.2.0, and `com.microteia.locale-pt-br` to 1.22.0 for the new marketplace keys.
- fix(build): `VERSAO_CONFERIDA` in `extensionTemplates.test.ts` records a (version, content fingerprint) pair per bundled extension, and fails when the content moved and the version did not. News shipped its licence terms on 1.1.0 first: every office that already had it installed was never offered the update, and nothing showed — the Marketplace only offers one when the version rises, and regenerating the `.json` just makes both ends agree on a version that lies. Same mechanism as `PT_BR_MESSAGES_FINGERPRINT`, extended to all twelve.

#### [9.7.2] — 2026-08-24

- chore(license): drop the `banner.email-monitor` warning from the top of the Terms of Use — the key leaves both the `core.license` source catalog and the bundled pt-BR translation, and the `InfoBanner` leaves `License.view.tsx`. It survived 9.7.1, which removed the section it referred to, so the page still warned about a feature the document no longer described. `S.BannerGroup` stays around the single remaining banner: it carries the block's bottom margin. The bundled `locale.pt-br.license` package goes to 1.0.2.

#### [9.7.1] — 2026-08-24

- chore(license): drop section 4 ("E-mail monitor, court notices and deadlines") from the Terms of Use — the `monitor.*` keys leave both the `core.license` source catalog and the bundled pt-BR translation, the section leaves `License.view.tsx`, and sections 5–11 are renumbered 4–10 so the document has no gap. The bundled `locale.pt-br.license` package goes to 1.0.1 because its catalog changed.
- chore(license): remove the author's bar-registration number from the contact card. It was a hardcoded datum in `License.viewmodel.tsx` that no other screen read, and the contact block still carries the name and the e-mail.

#### [9.7.0] — 2026-08-24

- feat(sdk/authoring): `AUTHORING.md` now documents the DECLARATIVE vocabulary, which is most of what an extension is: field types and every property that governs one, screen relationships and where a screen surfaces, the Widget DSL nodes, the expression language with the scope each slot actually sees, workflows/actions/scripts with their reference wiring, and the script sandbox's API and budget. It described the package envelope and left the rest to whoever already knew the kernel from the inside — and the author of an extension does not, and has no way to. The SDK emits its `.d.ts` with `removeComments`, so this document was already the only explanation of that vocabulary reaching an installation; it just was not written yet.
- feat(sdk/authoring): the field-type, widget-node and step-type tables are `Record`s closed over their unions, so a new kind in the kernel does not compile until it has its line in the guide; the expression roster is derived from the engine, with a test that every function it resolves is named in the text. `CUSTOM_FIELD_TYPES` and `STEP_TYPES` are new arrays with the unions derived FROM them, which is what makes that possible.
- feat(sdk/mcp): two tools. `describe_sdk_type` returns the exact declaration of any published authoring symbol, read from the `.d.ts` the installation carries, with the file it came from — the comment-stripped emit meant an author could see that `TemplateField` has an `autoValue` and never learn what one is. `list_expression_functions` answers from the engine rather than from prose.
- feat(sdk/mcp): `describe_sdk_type` expands one level, capped at six: asking for `TemplateField` — the most used type of all — used to answer `Omit<FieldDefinition, 'origin'>`, correct and useless. And `FieldDefinition`'s own references (`FieldLogic`, `FieldRules`, `FieldAggregation`, `FieldFileConfig`, `CustomFieldValue`, `ValidateRule`, `FormatRule`, `AggregationOp`, `FieldLookupBinding`) are now published, because structural typing without a name is a dead end: an author could write `logic: { compute: '…' }` and never name the shape, store it in a constant, or ask for it — and `logic` and `aggregation` are precisely what replaces code in a declared screen.
- fix(sdk/mcp): `list_extension_points` reported `implKindsAvailableToThirdParties: [script, widget, workflow]`, and the name asserted the opposite of the contract — a third-party package MAY ship `code`; validation does not refuse it, it just does not execute until an administrator trusts the source. A model reading the old name concluded it could not ship a view at all, and nothing contradicted it. Now `implKindsThatRunWithoutReview`, with the note that says what `code` really costs.
- feat(sdk/authoring): `AGENTS.md` gained the ladder of least power — what each rung costs, permanently — and the rule that a view is not a page until a contribution names its key, which is the failure with no symptom: the package validates, the extension installs, the screen is not there.
- feat(sdk/node): `transpileScriptSource` is re-exported from `@microteia/sdk/node`. A `Script` travels with both `sourceTs` and `compiledJs` and nothing filled the second in, so `scripts` was a package field an outside author had no supported way to write. It goes on the tool entry, not the barrel: it drags `sucrase`, and `@microteia/sdk` carries nothing beyond `expr-eval`.

#### [9.6.2] — 2026-08-23

- fix(nav): every path to a dynamic screen now asks whether the viewer can READ its collection.
  `sidebarScreens` went to the menu unfiltered while every contributed nav item passed through
  `visibleNavItems`, so a Form Design screen was offered to everyone: the tab opened, the Security
  Rules denied every read, and the person got a permanently empty list with nothing saying why. Four
  doors were open and are closed by one predicate — the sidebar, the `⌘K`
  `DynamicRecordCommandProvider`, the child tabs of a parent record (`useChildScreenTabs`), and
  `useOpenScreenList`, which the curated host API hands to extensions and which is now as silent for
  an unreadable collection as it already was for one no installed screen describes.
  `screenReadPermission` in `domain/services/screenDataCollection.ts` is the single point that names
  the permission — the read of the screen's DATA collection, so a bound screen (`dataCollection`)
  asks for the target rather than for a collection named after the tab.
- fix(records): `RecordListViewModel` answers `canRead`, and `DynamicRecordList` renders
  `screen.no-read-permission` in place of the list. Hiding the screen from the menu does not unopen a
  saved tab or a pasted link, and the empty list those still reached explained nothing; the notice now
  distinguishes "the screen is gone" from "the screen is not yours". The other three CRUD answers move
  from inlined `${collection}.create` template strings to `collectionPermissionId`.
- fix(access): `AuthorizationStore` derives the screen resource id through `screenDataCollection`
  instead of `definition.dataCollection ?? definition.id`. A whitespace-only `dataCollection` made
  the catalog emit a permission under `''` while every reader resolved the screen key, and the new
  menu filter would have hidden such a screen from everyone, owner included.
- chore(locale-pt-br): package `1.21.2`, carrying the pt-BR entry for the new
  `core.records/screen.no-read-permission` key and the catalog fingerprint it forces.

#### [9.6.1] — 2026-08-23

- fix(settings): `SettingsJsonParse.syntaxError` is a `SettingsValueIssue` instead of a string. It
  carried a ready-made Portuguese sentence for the not-an-object case, straight from the domain to the
  screen without passing through a catalogue — so anyone without the translation installed read
  Portuguese in the middle of an English interface. The validation also runs on the backend, which has
  no locale, which is why every other issue in this file was already a reference. The JSON engine's own
  text stays untranslated on purpose, but as a `detail` parameter rather than the whole message.
- test(settings): the shape is pinned — a syntax problem must look like a message key, never a
  sentence. The old literal only ever surfaced when someone pasted a malformed document, which is why
  it lived there for so long.

#### [9.6.0] — 2026-08-23

- feat(access): new extension point `access.requirement` (KERNEL 2.1.0), the additive way to add a
  dependency to a permission you do not own. `access.permission` refuses a second declaration of the
  same id — and must, because declaring also names — so two extensions that patch the same screen had
  no way to say, both of them, what reading that screen now depends on. The target may be derived: a
  screen collection's four permissions are, and that was the case with no path at all. Several packages
  add to the same id and the closure is the union.
- feat(access): an unresolvable addition is **dropped** with a diagnostic instead of failing closed,
  and one that would close a cycle is refused before it enters the graph. Both are the opposite of what
  `closureOf` does for a declarer, and the difference is whose mistake it is: failing closed on a third
  party's addition would let one extension lock another one's screen by being installed. Dropping is
  safe by construction — an addition only widens, so removing it only narrows.
- feat(access): additions are merged in both catalogs, browser and backend. Merging only in
  `AuthorizationStore` would give the screen that offers what the rule refuses, which is the exact
  divergence `PermissionCatalogCache` exists to prevent.
- feat(settings): `SettingsSection` accepts `requiredPermissions`, the last UI contribution without it.
  It gates VISIBILITY only: the catalog stays whole, because it is where each property's declared
  default comes from, and hiding a section from whoever cannot configure it must not change the
  behaviour it configures. JSON-mode validation still runs over the full catalog.
- fix(extensions): `MicroteiaCommandContext` promised `tenantRole`, which RBAC removed from the runtime,
  and did not declare `can`, which replaced it. Anyone writing against the autocomplete compared a
  profile that arrived `undefined`, and the comparison simply read false. `hostApiTypeDefs.test.ts` now
  compares the declared fields against `CommandPaletteAppContext` — declared must exist in the runtime,
  never the reverse, because the palette still carries fields no extension should reach.
- fix(sdk/authoring): §8 of `AUTHORING.md` taught `accessPermission`, a symbol the SDK has never
  exported; whoever followed the manual did not compile. Every `@microteia/sdk` import the generated
  guide shows is now checked against the barrel — the text is a string, so no kernel test covered it.
- feat(sdk/workspace): `sync` reports when `extensions/CLAUDE.md` states a kernel contract version,
  which means it is a copy of an AGENTS.md from before the two were split. The file is seeded, so
  nothing rewrites it, and it went on describing a platform the installation no longer has — inside the
  file an assistant reads as instruction. It is the organization's file to fix; it is ours to mention.

#### [9.5.0] — 2026-08-23

- feat(package): the kernel package now carries `KERNEL-VERSIONS.md` — this file — and `microteia pack`
  **refuses** to build a version it has no entry for. The check runs before the quality gate and the
  three builds, because an entry that is missing takes a minute to write and ten to discover. A
  changelog kept by discipline alone stops at the first hurried release, which is the one anyone will
  later need to date.
- docs(repo): every commit that raises `version` writes two entries — one for whoever uses the
  application, in the team's own language, and this one, in English, for whoever maintains or
  integrates an installation. The package travels; so must the record of what changed in it.

The Console puts this file next to your `microteia.yaml` from `2.6.0` on — see `CONSOLE-VERSIONS.md`.
