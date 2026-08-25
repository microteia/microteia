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
