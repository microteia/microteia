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
