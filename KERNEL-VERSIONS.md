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
