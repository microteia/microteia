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
