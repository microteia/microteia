# Contributing to Microteia

Thank you for considering a contribution. Microteia is free software, licensed under the
[GNU Affero General Public License v3.0 or later](./LICENSE), with the additional terms in
[NOTICE](./NOTICE), and it is built in the open.

## Before you start

Read [ARCHITECTURE.md](./ARCHITECTURE.md) — it is the source of truth for every decision in this
repository — and [CLAUDE.md](./CLAUDE.md), the short operating manual that applies to every change.
Both are written in Portuguese; the code, the user-facing text and the package changelogs are in
English.

For anything larger than a fix, open an issue first and describe the problem you want to solve. It is
much cheaper to agree on the approach before the code exists.

## The one rule that is not negotiable

**The kernel never learns a business name.** Microteia builds business applications declaratively:
entities, screens, automations and translations come in as plugins and extensions. When something in
the kernel *seems* to need the name of a business collection, the question is not which name to write,
but which declarative capability is missing. A pull request that ties the kernel to a domain will not be
merged, however useful the feature is — propose it as an extension instead.

## The quality gate

Every change must pass the full gate before it is committed:

```bash
npm run verify
npm test
```

Changed `functions/`? Also run `npx tsc -b functions`. Changed `firestore.rules` or `storage.rules`?
Also run `npm run test:rules` (it needs a JDK).

`eslint --max-warnings 0` is part of the gate on purpose: warnings block. Never silence a rule for a
whole file; a justified, single-line `eslint-disable-next-line` is the only accepted exception.

## Every commit carries its version

1. Bump `version` in `package.json` (SemVer).
2. Add an entry at the top of `VERSIONS.md` — in Portuguese, written for the end user, describing the
   benefit, never the implementation.
3. Add the technical entry at the top of `KERNEL-VERSIONS.md` — in English. If you touched `cli/`, bump
   `CLI_VERSION` and add the entry to `cli/CONSOLE-VERSIONS.md` as well.

Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`…), in Portuguese.

## User-facing text

No literal sentence reaches the screen. Every new string is a key in the English catalog
(`src/plugins/messages/`) **and** gets its pt-BR translation (`src/plugins/marketplace/localePtBr/`) in
the same commit. Text that cannot be translated does not go in.

## Licensing of contributions

By submitting a contribution you agree that it is licensed under the same terms as the project — the
GNU Affero General Public License, version 3 or (at your option) any later version, together with the
additional terms and the Microteia Extension Exception in `NOTICE` — and you confirm that you have the
right to license it that way. Do not submit code copied from sources whose license is not compatible
with the AGPL.

Writing an extension is not contributing to the platform: an extension that uses only the published
interfaces is yours, under the license you choose (see `NOTICE`). It only becomes a contribution if you
propose it for this repository.

## Reporting a security issue

Do not open a public issue for a vulnerability. Write to the maintainer at
alexnaldo.santos@gmail.com with the details, and allow time for a fix before disclosing it.
