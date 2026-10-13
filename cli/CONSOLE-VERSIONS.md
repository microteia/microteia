# Microteia Console — changelog

> Technical history of the Console — the command that installs, upgrades and publishes Microteia in a
> Firebase project. Newest first, one entry per `CLI_VERSION`.
>
> The Console is versioned and distributed **separately** from the platform: `CLI_VERSION` does not
> follow the package's `version`, and a package states the oldest Console it can be installed by
> (`minimumCliVersion`). So the two histories are two files. The platform's is `KERNEL-VERSIONS.md`,
> beside this one.
>
> **This file travels with the Console**, and `microteia unpack` replaces the copy next to your
> `microteia.yaml` on every run. Do not edit that copy.
>
> Semver on the TOOL's side: major when a command changes contract, minor when it gains a capability,
> patch when what it writes changes without the package coming to depend on it.

<!-- A new entry goes here, above the previous ones, in this format:

#### [9.9.9] — YYYY-MM-DD

- feat(command): what the command now does.
- fix(command): what was broken, and what it did to whoever hit it.
-->

#### [2.27.0] — 2026-10-13

- feat(examples): the Console ships `document-example` as authoring source — a `document.template` contribution (Markdown, with `{{#each}}`/`{{#if}}` and a child-record `dataset`) over two screens addressed by `sourceId`.

#### [2.26.1] — 2026-10-12

- fix(connect): the "enable the Firestore TTL policy on auditLogs.expiresAt" prerequisite is gone from `connect` and from `MICROTEIA.md`. The policy is declared — `"ttl": true` in a `fieldOverride` of `firestore.indexes.json` — and the `firebase deploy --only firestore:indexes` that `deploy` runs applies it; the step asked the organization to redo by hand what the deploy had already done. The same holds for every TTL the kernel declares (`workflow_trigger_marks.expiresAt` too).

#### [2.26.0] — 2026-10-09

- feat(plugin-init): the organization's namespace is required — `--namespace com.acme`, or asked for when there is a terminal — validated before anything is written, and recorded in the seed `package.json` under `microteia.namespace`. `--force` reuses the one already recorded. The SDK derives every extension id in the directory from it.

#### [2.25.0] — 2026-10-07

- feat(examples): the Console ships `record-tab-example` as authoring source — a tab inside another screen's record, as code and as Widget DSL, and a list locked to the open record.

#### [2.24.0] — 2026-10-07

- feat(export-catalog): each screen in `installed-catalog.json` now carries its `sourceId`. The snapshot only had the installed key, which may have been disambiguated on install, so an extension that adds a tab to another's record detail (`record:<sourceId>`) could not be checked against the installation. Older snapshots simply lack the field.

#### [2.23.0] — 2026-10-07

- fix(provision): `microteia provision` run on its own now probes the deployed stamps itself instead of concluding that nothing changed. It could only compare stamps with the map `deploy` hands it, and running alone — the path of anyone who has just swapped kernels with `unpack` — there was no map: `outdatedByStamp` drew no conclusion, the function stayed out of the queue, and the record said "applied" because it genuinely was running, from the previous package. An office upgraded this way kept serving an extension's old Cloud Function with nothing anywhere saying so; the symptom surfaced in the client, not in the Console. The queue is now everything the installed extensions claim, and `deployFunctionsThatChanged` — the same probe `deploy` uses — decides what actually goes up: one reference function per stamp, and the rest left alone when it comes back unchanged. What the probe skips counts as satisfied, or a complete installation would stay "pending" forever.

#### [2.22.1] — 2026-09-19

- fix(cli/publish): the release notes now carry every changelog entry since the last PUBLISHED version,
  not only the one being packaged. A version can be packaged and never published — the catalog is what
  says what went up, and the package being published contains all of them. Publishing 9.66.0 over a
  catalog whose newest entry was 9.64.0 created a release that carries 9.65.0 and did not quote a line
  of it, and a release is immutable: no later release goes back to tell what those versions changed.
  The cut now starts at `publishedBefore(index, version)`, so it happens after the catalog is read
  rather than while the package is; the first publish, which has no interval, still cuts its own entry
  alone. The command prints which versions the notes carry, in the dry run too.

#### [2.22.0] — 2026-09-10

- feat(deploy): the reachability check now covers HTTP endpoints, not only callables.
  `callableFunctionNames` matches `onRequest` as well, because the list means "what the outside world
  calls" and an HTTP endpoint depends on public invocation even more than a callable does — a blocked
  invoker grant answers 403 with no CORS header, and the client reports a connection error. Without
  this, the platform's first `onRequest` would have gone up unverified.
- fix(deploy): the `functions-invoker` prerequisite no longer promises that every reachable function
  rejects a caller with no signed-in user. That is true of a callable and false of an endpoint that
  authenticates by token, and the sentence was about to be read by whoever installs the agent access.

#### [2.21.0] — 2026-09-09

- fix(cli/pack): reading-only examples are left out of the first-party backend accounting.
  `extension-templates/` holds two kinds of package with the same shape and different owners — the
  first-party extensions, whose Cloud Functions this kernel compiles and deploys, and the examples,
  whose backend belongs to whoever installs them. The pack derives its baseline as
  `all functions − claimed`, so the first example to teach Cloud Functions would have aborted every
  publish by claiming a name that is not here, and a name that WAS here would have been taken out of
  the kernel baseline by a mere template. `firstPartyTemplates` is now the single door onto that
  directory, and `READING_ONLY_EXAMPLES` is derived from where an example's source lives rather than
  kept as a second list.
- feat(cli/vendor): `stageExamples` carries `functions/` and `scripts/` beside `views/`, and an
  example whose source is a DIRECTORY takes `plugin.ts` as its entry. Without both, an example could
  not teach a Cloud Function or a sandbox script — the two files simply would not travel.
- fix(cli/vendor): `rewriteImports` sends the node-only modules to `@microteia/sdk/node` instead of to
  the isomorphic barrel, which is where `transpileScriptSource` deliberately is not. The symptom
  would have been in the office of whoever installed, not here.
- fix(cli/vendor): the `MICROTEIA.md` it writes derives its build command from the examples actually
  present. It named `examples/pessoa`, which left the repository with the office extensions — a
  generated document telling the reader to compile something that is not there.

#### [2.20.0] — 2026-09-01

- feat(cli/export-catalog): the snapshot carries what each installed extension declares in `manifest.exports` — the artifacts another extension may reference as `<extension-id>/<source-id>`. Whoever authors outside the office knew an extension was installed and had no way to learn the name of anything inside it, so the reference could be written by hand and never discovered. Each entry carries the id, the artifact's name, and its `kind`, which is the part that decides where the reference fits: a script goes in `scriptId`, an automation in `targetWorkflowId`. What the artifact DOES still never travels — the steps and the code are behaviour, and the snapshot is shape.
- feat(cli/export-catalog): a declared export that matches no artifact in the package travels as `unknown` rather than being dropped. The install gate checks the LIST, so a reference to it would be accepted there and fail only on the step's first run; saying it is better than hiding it.
- feat(cli/export-catalog): `exports` is written for every extension, empty list included. A present-and-empty list is the answer "this extension exports nothing"; an absent key is the silence of a Console older than the field, and the kernel tells the two apart instead of reading absence as a claim.

#### [2.19.0] — 2026-08-28

- fix(cli/deploy): the installation gate is charged against the functions that are GOING UP, not against every source found on disk. It lived in `functionProblems` — the door that answers "can this set be assembled?" — and that door reads every `extensions/<x>/functions/` directory that exists, including one left behind by an extension that was uninstalled and removed. The result was `microteia deploy` refusing in full — hosting, rules and indexes with it — over a callable no command would have deployed. `gateProblems` now carries the function's name, and `gateProblemsFor` filters by what is being deployed.
- fix(cli/provision): a gated function that fails the check leaves the deploy queue instead of taking the command down with it. Everything else provisions, `--prune` still removes the orphan, and the command ends in an error naming the function that was held back.
- feat(cli/provision): orphan functions are found in the PROJECT, not only in the record. `backend.functions` in `microteia.yaml` was the single source of truth about what had been deployed, and it is a truth that gets lost — a redone `init`, a restored backup, a Console older than the field. Lost it, and the Cloud Function of an extension nobody has stayed in the air with no command mentioning it. `straysInProject` crosses `firebase functions:list` with what the installation can justify; only a name this installation knows how to produce can become an orphan, and what it does not know is reported and never touched.
- feat(cli/provision): an orphan found that way enters the record when it is not removed, so it stays known from the next run on even if its source leaves the disk.
- fix(cli/provision): `functions:list` is asked on every run. It was skipped when there was nothing applied to check — the exact case that needed it, since an installation with no extensions left is where the departed extension's function sits. When the listing cannot be read, the command says so instead of letting silence read as "nothing left over".

#### [2.18.0] — 2026-08-28

- feat(console/functionGate): an extension's callable without `requireInstalledExtension` is refused, and a guard naming another extension's id is rejected the way a misgated trigger is. The refusal exists because the deploy makes every callable publicly invocable — this Console's own `callableAccess.ts` is there to confirm that grant went through — so the callable answers any signed-in user of the project, from any organization, whether or not they installed the extension, with the organization arriving in the payload.
- feat(console/functionGate): the scope of this check is the FILE, like the per-office loop and unlike the trigger guard. The guard runs inside the handler because it needs the `request`, and the authoring guide asks authors to keep the handler thin with the decision in a file beside it — demanding the call inside the parentheses would refuse exactly the code the guide asks for.
- feat(console/functionGate): the SHARED callable is left out, and it is recorded rather than silently skipped: `requireInstalledExtension` takes one id and a shared function serves several. The "any of the ones I serve" guard exists for a trigger (`forAnyInstalledExtension`), not for a callable.

#### [2.17.0] — 2026-08-28

- feat(console/customFunctions): `microteia.serves` in `functions/package.json` — function name to the extension ids it serves. It closes the widest and quietest gap in the whole withdrawal mechanism. A function in `functions/` has no owner by construction (no extension may claim it), so it sat outside the mechanism ENTIRELY: never recorded as applied, never classified as an orphan, never reported, and out of `--prune`'s reach. It stayed deployed forever, put up by every deploy, with every extension it served long uninstalled — and the authoring guide was the thing telling authors to put shared functions there.
- feat(console/provision): a shared function that declares who it serves is deployed while ANY of them is installed anywhere in the project, and becomes an orphan when none is. The question is asked against every active installation and not against the claims: an extension with no `manifest.backend` never becomes a claim, and could well be one of the served ones — deciding from the claim list would delete the function of somebody who has it installed. The applied record keeps the declared list rather than electing one owner, because that is what explains, months later, why the function was there and why it stopped being.
- feat(console/deploy): a shared function that declares who it serves leaves the unconditional deploy list. Putting it up here anyway would have `--prune` delete it and the next deploy restore it, indefinitely — the same loop the claim refusal avoids. One with NO declaration goes up exactly as before: keeping that is what stops this version from taking a function out of an installation that already works.
- feat(console/functionGate): a declared shared trigger without a guard is refused, and so is a guard naming an extension the function does not declare serving. The two lists answer the same question — `serves` decides the withdrawal, the guard decides the execution — and one of them being wrong makes the function act where it can no longer be withdrawn. Guarding by one of the declared extensions is accepted: the list is the ceiling, not the floor. A shared function with no `serves` is not asked for a guard, because without ids there would be no guard to ask for.
- feat(console/provision): shared functions with no `serves` are listed on every run. They keep working as before and nothing withdraws them — what changes is that they stop being invisible, which was the defect: whoever inherited an installation had no way to know those functions were outside the mechanism, and the only way to find out was a trigger firing years after the last extension that used it had gone.
- fix(console/provision): a parameter declared in `functions/` now marks the served shared functions as stale. They used to go up on every deploy, which masked the question; moving them to provisioning would have left one running with the old value, which is the defect that mechanism exists to close. The granularity is the directory, not the function, because `functions/` declares its `defineString` calls in one set without saying which function reads which.

#### [2.16.0] — 2026-08-28

- feat(console/functionGate): an extension's function whose event carries no `{tenantId}` — `onSchedule`, `onMessagePublished`, `onRequest`, the Storage object triggers, the login-blocking ones — is refused unless it loops with `forEachInstalledOffice`. The refusal only became honest once there was an answer to point at: before it, both of the author's options were wrong, and the worse one passed every check. A loop naming another extension's id is rejected the same way a misgated trigger is, and the report names WHICH guard got the wrong id, because the fix is in one string and the author should not have to guess which.
- feat(console/functionGate): the scope of this check is the FILE, not the call's parentheses. A document trigger's guard wraps that handler, so it has to be there; the loop runs inside the handler and may sit a couple of calls deeper, in a helper the author wrote. Demanding it in the parentheses would refuse correct code, and the price is stated: two scheduled functions in one file, one looping and one not, both pass.
- feat(console/functionGate): the list of constructors is explicit rather than "everything that is not a document trigger". RTDB is deliberately left out — its path HAS parameters, so a `{tenantId}` there is possible, and the platform uses no RTDB anywhere. What is not known is not refused.

#### [2.15.0] — 2026-08-28

- feat(console/backendResidue): provisioning writes what it found back to the database, at `backend_state/current`. It is the one place in the system that can say "this Cloud Function has no owner any more" — the answer needs a scan of every office in the project compared against the applied record — and it said so in the terminal and kept the conclusion in `microteia.yaml`, a file on one operator's machine. The application never learned anything, so the whole mechanism depended on somebody remembering. This is not a new path: the Console already writes to the database over REST, which is how `backendState` is stamped.
- feat(console/backendResidue): the document is written on EVERY run, empty included. Writing only when there are orphans would leave the banner up after `--prune` had already dealt with them, and a banner that never goes away is one people learn to ignore — the empty list is what clears the previous one. The list is the one left AFTER pruning: what it deleted is gone, what it could not delete stays, which is the state of the project now rather than the state at the start of the run. `tenants` and `extensions` travel with it, because "nobody needs it any more" is a claim about every office in the project and whoever reads the banner deserves to check it instead of believing it.
- fix(console/provision): failing to record the leftovers does not fail the command. The functions and indexes were already applied; what was left to do was a REPORT, and refusing the whole run would send whoever installs to repeat a command that finished its work. The failure is said out loud, though — staying quiet would leave a silent screen looking like "there is no residue", which is the opposite claim.
- feat(console/firestoreRest): `asInteger`, `asArray`, `asMap` and `patchFields`. The mask lists every field written, deliberately: without it a PATCH behaves differently depending on whether the document exists, and what is wanted here is convergence — since all fields are written every time, the complete mask is also what erases what stopped being true.

#### [2.14.0] — 2026-08-28

- feat(console/provision): claiming a function that lives in `functions/` — the directory for a function SEVERAL extensions share — is refused. `baselineClaimProblems` already guarded the same defect against the platform's own functions, and the sentence is identical: the deploy puts it up regardless, so the claim changes nothing while the extension is installed, and the day it is uninstalled `--prune` deletes a function other extensions depended on. This case adds one turn of the screw — the next deploy puts it back, because the source is still sitting in `functions/` — so the symptom is an outage that closes by itself, repeating on every `provision --prune`, with nothing in the tree to suggest what happened. Rejecting the extension puts the name in `unresolved`, which is what keeps `--prune` off the shared function while the wrong declaration stands.

#### [2.13.0] — 2026-08-28

- feat(console/functionGate): an extension's Firestore trigger without `forInstalledExtension` is refused. The guard is the half of the withdrawal that acts at the moment somebody clicks Uninstall — `--prune` cannot reach the office that uninstalled while another still has the extension — and nothing cobbled it: `create function` wrote it into the scaffold, and no check in packing, deploying or provisioning ever read the source again. An ungated trigger went up and stayed up, and its symptom is not a failure: it is the code of an extension nobody has any more running over the data of offices that never asked for it, with no error anywhere.
- feat(console/provision): a guard that names ANOTHER extension's id rejects the extension that claims the function. It is what a copied function leaves behind, and its symptom is the opposite of the ungated one — the trigger deploys, fires on every write, and the handler never runs, because the gate asks about an extension nobody installed. Only provisioning can ask this: the claim comes from the office's database, and the deploy does not have it. The owner is rejected by identity and not by substring, because the message names two ids and matching on text would also reject the extension whose id was copied.
- feat(console/provision): an ungated trigger already deployed is REPORTED rather than refused. Refusing here would lock `--prune` — the one command that removes the orphan — behind a source it does not need to read. The refusal belongs where the source enters the package, and there it blocks nobody's way out.
- fix(console/functionGate): comments are stripped before the source is read, and strings are not. The scaffold's own JSDoc cites `forInstalledExtension` to explain it, so deleting the call and keeping the explanation would have passed the check — which is exactly what an author produces while editing generated code. A guard declared in an identifier beside the trigger is accepted, because that is correct code and a check that refuses correct code is the one that teaches the next person to switch it off.

#### [2.12.0] — 2026-08-27

- feat(pack): the packaged `functions/package.json` gains an `exports` map and `custom/tsconfig.json` a `paths` entry, which is what lets a Cloud Function written by the organization import `microteia-functions/office` — the platform surface that keeps an extension's trigger from running in organizations that do not have it. No new dependency, so the packaged lockfile stays valid.

#### [2.11.0] — 2026-08-27

- fix(provision): orphan Cloud Functions are reported even when no installed extension asks for a backend at all — the case that mattered most, and the only one the previous shortcut skipped.
- fix(provision --prune): a function claimed by an extension that is still installed, and one the platform deploys itself, are never deleted. Both were reachable before.
- feat(provision): the record of applied functions carries the plugin that owns each one, and the orphan report names it along with how many offices were read to reach the conclusion.

#### [2.10.0] — 2026-08-27

- feat(export-catalog): a new command writes what an office HAS — its screens with their fields, its
  lists of options, its tag lists and its installed extensions — into `extensions/installed-catalog.json`,
  for the authoring tools to read. The MCP server's catalog knew only the `plugin.ts` files in that
  directory plus the platform's own entities, so a screen built in the Form Design and an extension
  already installed were invisible to it, and the check that catches a field belonging to another
  entity could not fire against the entities that matter most. Closing it by giving the SDK a
  credential was the wrong trade: `microteia-plugin` is offline by design. The Console already holds
  the gcloud token, so the Console exports and the SDK only reads a file.
- feat(export-catalog): `--tenant` is required, and without it the command LISTS the offices in the
  project instead of guessing one. A Firebase project can hold several, and exporting the wrong one
  would put another office's vocabulary inside somebody's extension work.
- feat(export-catalog): the file is written beside `microteia.yaml`, in `extensions/` — never in
  `.microteia/`, which `unpack` deletes whole on every kernel change. A snapshot that disappears on
  upgrade is a snapshot nothing can depend on. `--output` overrides the path; without `extensions/`
  the command refuses and names `microteia plugin-init`.
- feat(export-catalog): it exports SHAPE, not content. Records, the values inside a list of options or
  a tag list, members, permissions, workflows, scripts, actions, secrets and settings never leave the
  office. A disabled screen is left out too: nothing draws it, and carrying it would assert that the
  entity exists.
- refactor(provision): reading what an office installed moved to `installedExtensions.ts`, and
  `provision` now goes through it. Two paths to the same document are two chances to disagree about
  what counts as installed.

#### [2.9.0] — 2026-08-26

- feat(deploy): `login.extensions` in `microteia.yaml` lists compiled extension packages that `deploy`
  stamps into `hosting/microteia-extensions.js`, loaded before the bundle like `firebase-config.js`.
  It is how a corporate SSO reaches the sign-in screen: that screen runs above the organization, so
  nothing an organization installed can reach it, and until now the only way in was a commit in the
  kernel.
- feat(deploy): the stamp is written on EVERY deploy, empty list included. Skipping the write would
  leave the previous deploy's stamp live, so removing a package from the list would not remove it from
  the screen.
- feat(deploy): a package that contributes to none of the points that work before sign-in is REFUSED,
  not stamped. It would load with no effect, and whoever stamped it would believe it was live. The list
  of those points comes from `preLoginPoints` in the installed package's manifest, never from a copy
  here: the Console is versioned separately, and a copy would silently describe another version's
  contract.
- feat(deploy): the stamp is capped — a warning past 256 KiB, a refusal past 1 MiB. The file blocks the
  page on every visit, including visits by people who never sign in.
- feat(deploy): a duplicated package id is refused. The Kernel would ignore the second one, so the file
  would say something the installation does not do. A missing path, broken JSON and a file that is not a
  package each name themselves.
- feat(deploy): a stamped package that ships views gets a warning saying its code does not run before
  sign-in — stamping is not trusting, and that is what allows stamping without a code review.

#### [2.8.0] — 2026-08-25

- feat(console/functionsUpToDate): new module. It reconstructs the skip that `firebase deploy` performs in bulk and that `--only functions:<name>` disables, WITHOUT reimplementing the hash: functions are grouped by the `firebase-functions-hash` label they carry, one member of each group is deployed, and the stamp it comes back with is the stamp of the current code. The probe being a MEMBER of its group is what makes the conclusion carry to the others — two functions with the same old stamp share source, environment and secret set, the three parcels of the hash. Absent, non-`ACTIVE`, unstamped or wrong-region always deploys: not knowing never becomes skipping.
- feat(console/deploy): asks the project once (`functions:list --json`) and feeds both decisions from that one answer — the region orphan check and the up-to-date check. Two questions could disagree, and then the decision depends on which answer the code happened to read.
- feat(console/provision): `outdatedByStamp` requeues an applied extension function that carries a stamp older than what this package builds, or that is missing from the project. The stamp comes from the probes the `deploy` step just ran — extension functions live in the same codebase, so it is their stamp too. Called on its own, provisioning decides as it always did: probing there would cost a deploy on every extension install to answer a question that is almost always "nothing".
- feat(console): `--all` on `deploy` and `provision` deploys every function without asking the project what it runs.
- fix(console/regionOrphans): `listDeployedFunctions` keeps `hash`, `state` and `platform` instead of discarding everything but id and region; `clearRegionOrphans` accepts an already-fetched listing.

#### [2.7.2] — 2026-08-25

- feat(vendor/exampleSources): stages `automation-example` alongside the others, so the workspace ships a complete automation to read. Every example that travelled carried `workflows: []`, and automation was the one mechanism an author had only prose for.

#### [2.7.1] — 2026-08-24

- fix(unpack): the default catalog URL is `https://microteia.github.io/releases/kernel/index.json`.
  `2.7.0` shipped pointing at a domain that was never registered, so `--version` on it fails with
  "Could not read the Microteia catalog" and only `--kernel <package>.tgz` works. The choice of host is
  not the point; where the INDEX lives is, because that one URL is the only address a Console knows by
  heart — every other URL is data inside the catalog. A `github.io` address is free, exists today, and
  is forward compatible: adding a custom domain to the Pages site later makes GitHub redirect the old
  address to it, and `fetch` follows redirects, so a Console installed now keeps working. Starting at a
  domain would have required owning it first and offered no way back.
- fix(publish): a repository with no commits at all is the FIRST publish, not a failure. The contents
  API answers `404 Not Found` when the file is missing and `404 This repository is empty` when there is
  no commit — and the second is the state of a releases repository just created, which is exactly when
  the first publish happens. Matching on the message refused it. A 404 now asks one more question, about
  the repository itself, which separates "the catalog is not there yet" (go on) from "the repository is
  not there" (stop) instead of guessing from prose.
- fix(publish): a releases repository with no commits is seeded before the release is created. GitHub
  refuses to create a release or a tag in an empty repository with `422 Repository is empty`, and it
  refuses it AFTER the package has been verified — the worst moment to find out. The first publish now
  writes the repository's `README.md`, which is a write the command was going to make three steps later
  anyway, and which the repository should carry regardless. It is written once and never overwritten:
  what promises to be current is the catalog.

#### [2.7.0] — 2026-08-24

- feat(unpack): `--version latest` and `--version <x.y.z>` take a platform version from the published
  catalog — read it, download it, verify its size and sha256, and cache it under `~/.microteia/cache`,
  outside the installation because `.microteia/` is deleted whole on every kernel swap. `--kernel
  <package>.tgz` is unchanged and is not legacy: while installing depends on a download, a machine with
  no access to the catalog cannot install anything, and the installation already depends on enough that
  is not ours. A cache entry whose digest does not match is deleted and fetched again, so there is no
  flag to bypass it — the person who would need one is the one who would not think to pass it.
- fix(unpack): the refusal by `minimumCliVersion` happens BEFORE the previous install is touched.
  Extracting and swapping were one step, and the swap came before the manifest was read: a package
  demanding a newer Console deleted the `install/` of the version that worked and only then refused,
  leaving the installation with no kernel at all — because of a check that exists precisely so that
  nothing would happen. It is now extract, verify, then commit, and a refusal removes the staging it
  opened.
- feat(publish): releases what `pack` and `pack-console` built — assets to a releases-only repository
  through `gh`, the Console to npm, and the catalog last. That order is the decision: a catalog pointing
  at a file that did not upload breaks every installation asking for `latest`, while a file the catalog
  does not yet mention breaks nothing. An interrupted publish is resumed rather than refused, since
  refusing would leave deleting the release by hand as the only way out. It does not build — `pack` is
  what runs the quality gate — it re-derives the tarball's sha256 instead of trusting the manifest
  beside it, and it refuses a version already in the catalog: a released version is never rewritten.
- feat(pack-console): the packed folder is publishable as `@microteia/console`, so an office installs
  the Console with `npm i -g @microteia/console` or runs it with `npx`. This closes a chicken-and-egg:
  while the Console itself had to be downloaded from somewhere, someone had to download the downloader,
  and the first step of installing was a folder received by e-mail and an `ln -s` written by hand. The
  registry already provides the versioned URL, the lockfile fingerprint, the CDN and `npm outdated` that
  a channel would have had to reimplement. `CONSOLE-VERSIONS.md` is in `files` for a reason that is not
  documentation: `unpack` reads it beside the running binary, and outside `files` it does not exist in a
  global install.
- feat(--version): says when a newer kernel is published, and the lookup is injected rather than called
  from the report. `--version` is the first command run when something is odd and the answer people paste
  into a request for help; it answers about the installation, so on a machine with no network it answers
  the same.
- feat(publish): `--otp <code>` reaches `npm publish`, and a refused publish prints what the registry
  requires. The registry accepts neither a plain `npm login` token nor an account without 2FA, so
  without a way through the command it was unusable: it called `npm publish`, got a 403, and the only
  way out was running `npm` by hand — which skips the changelog check this command exists to make. The
  note is printed on ANY failure and does not claim the cause: `npm`'s output goes straight to the
  terminal, so what reaches the catch is "Command failed (exit 1)" and nothing else. A first version
  looked for "2fa" in that text and never once printed.
- fix(connect): the last line printed `microteia deploy --kernel <pkg>.tgz`. That flag left `deploy` in
  `2.0.0`, so the line had been sending whoever just connected straight into a refusal — on the command
  right after the one that worked. It now prints `unpack --version latest` and `deploy`.

#### [2.6.0] — 2026-08-23

- feat(unpack): writes `KERNEL-VERSIONS.md` and `CONSOLE-VERSIONS.md` into the installation root, and
  replaces both on every run. The first is copied out of the unpacked package, the second comes from
  the Console binary that is running — each history written by the artifact it belongs to, which is
  the only way neither can describe a version that is not there.
- feat(pack-console): the packed folder carries `CONSOLE-VERSIONS.md`, and packaging refuses a
  `CLI_VERSION` this file has no entry for.
- docs(unpack): the generated `MICROTEIA.md` and the seeded `README.md` list both changelogs in the
  directory map, so the files are found without being looked for.
- docs(readme): the packed README no longer tells you to run `microteia deploy --kernel <pkg>.tgz`.
  That flag was removed in `2.0.0` — the package arrives through `unpack` — and the line had been
  sending whoever installed to a refusal ever since.

Entries before `2.6.0` are in the `CLI_VERSION` block of `cli/src/shared/paths.ts`, in the language of
the team that wrote them. They stay there; this file is where the history continues.
