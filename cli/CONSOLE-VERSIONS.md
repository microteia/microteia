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
