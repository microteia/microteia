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
