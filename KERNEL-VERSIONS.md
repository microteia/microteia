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
