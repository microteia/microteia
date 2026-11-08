# Microteia

[![CI](https://github.com/microteia/microteia/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/microteia/microteia/actions/workflows/ci.yml)
[![Security Rules](https://github.com/microteia/microteia/actions/workflows/rules.yml/badge.svg?branch=main)](https://github.com/microteia/microteia/actions/workflows/rules.yml)
[![Kernel](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fmicroteia.github.io%2Freleases%2Fkernel%2Findex.json&query=%24.channels.stable&label=kernel&prefix=v&color=blue)](https://github.com/microteia/releases/releases)
[![Console](https://img.shields.io/npm/v/%40microteia%2Fconsole?label=console&color=blue)](https://www.npmjs.com/package/@microteia/console)
[![License: AGPL v3+](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](./LICENSE)

Multi-tenant platform for **building business applications declaratively**. The kernel knows no
domain at all: entities, screens, automations and translations come in as **plugins and
extensions**, and that is what lets it serve a law office and a store without changing the kernel.

Each organization (tenant) runs in isolation: its data lives in dedicated Firestore subcollections
(`tenants/{tenantId}/{collection}/{docId}`). A user can belong to several tenants and switch between
them after signing in.

Microteia is **free software**, licensed under the [GNU Affero General Public License v3.0 or later](./LICENSE),
with the additional terms in [NOTICE](./NOTICE). Extensions you write for it are yours, under the license you choose.

📖 **Official documentation: [doc.microteia.com](https://doc.microteia.com)**

📦 **Official Latest Build Release: [microteia/releases](https://github.com/microteia/releases/releases/latest)**

## Technologies

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Styled Components — color, font and spacing **always** come from the theme; the theme is a plugin contribution (the kernel ships `dark` and `light`; the others come from the catalog)
- **Backend:** Firebase (Auth + Firestore + Storage + Functions)
- **Routing:** React Router v7
- **Architecture:** Clean Architecture + MVVM, on top of a plugin kernel

## Prerequisites

- Node.js 22 — it is the Cloud Functions runtime; use the same version locally so you don't drift from what runs in the cloud
- npm
- A Firebase account with a configured project

## Setup

1. Clone the repository:
```bash
git clone https://github.com/microteia/microteia.git
cd microteia
```

2. Install the dependencies:
```bash
npm install
```

3. Configure the environment variables. **There is no `.env` at the root, and that is on purpose:**
each environment has its own, so that a missing variable fails loudly instead of silently falling back
to the other project's configuration.

```bash
cp .env.example .env.dev     # development -> microteia-dev project
cp .env.example .env.prod    # production  -> curatino project
```

4. Fill in each environment's Firebase credentials (obtained with
   `npx firebase apps:sdkconfig web --project <alias>`):

```env
VITE_API_KEY=your_api_key
VITE_AUTH_DOMAIN=your_auth_domain
VITE_PROJECT_ID=your_project_id
VITE_STORAGE_BUCKET=your_storage_bucket
VITE_MESSAGING_SENDER_ID=your_sender_id
VITE_APP_ID=your_app_id
VITE_MEASUREMENT_ID=your_measurement_id
```

The `TARGET` variable selects, at the same time, the environment file and the target Firebase
project — `dev` is the default for every command.

## Running the project

```bash
# Development
npm run dev          # http://localhost:5173 (uses .env.dev)

# Quality gate (mandatory before committing)
npm run verify       # typecheck (tsc -b --force) + eslint --max-warnings 0
                     # + generated schemas + extensions + message catalogs
npm test             # vitest

# Changed functions/? The root gate does NOT use the backend's (stricter) tsconfig:
npx tsc -b functions

# Build
npm run build              # TARGET=dev by default
TARGET=prod npm run build
```

## Deploy (our environments)

Two Firebase projects: `microteia-dev` (development, the default) and `curatino` (production).
Production is **never** implicit — it requires `TARGET=prod`.

```bash
npm run deploy:hosting          # build + hosting          -> microteia-dev
npm run deploy:rules            # Firestore/Storage rules
npm run deploy:indexes          # composite indexes
npm run deploy:functions        # every Cloud Function
npm run deploy:functions:individual   # one at a time (the batch exceeds the CPU quota)

TARGET=prod npm run deploy:hosting    # -> curatino
npm run deploy:prod                   # everything, in production
```

Rules and indexes are **versioned code** (`firestore.rules`, `storage.rules`,
`firestore.indexes.json`): never edit them in the Console — the next deploy overwrites the rule and
deletes any undeclared index.

Installing Microteia in a customer's Firebase takes a different path — see the next section.

## Distribution — building the package and installing it in the office's Firebase

The deploy above publishes to **our** Firebase (`microteia-dev` or `curatino`). This section is the
other path: Microteia installed in the office's **own** Firebase project, maintained by the office.

There are two sides, and no command crosses the boundary between them:

| Microteia side (this repository) | Office side (the installer's machine) |
|---|---|
| `microteia pack` → versioned, **compiled** package | `npm i -g @microteia/console` → the installer |
| `microteia publish` → release + catalog + npm | `microteia init` → creates the installation |
| never sees the customer's `projectId` | `microteia connect` → links it to their Firebase |
| | `microteia unpack --version latest` → downloads and verifies |
| | `microteia deploy` → installs/updates |

`firebase login` always belongs to the office: the Console implements no authentication of its own and
stores nobody's credentials.

### The Console (CLI)

The Console is the repository's 4th TypeScript project (`cli/`), compiled to `cli/lib` — which is
generated, not versioned. After `npm install`:

```bash
npm run build:cli            # compiles cli/ -> cli/lib
npx microteia --help         # or: node cli/lib/index.js --help
```

| Command | Side | Purpose |
|---|---|---|
| `microteia pack [--output <dir>] [--skip-verify]` | Microteia | builds the installable kernel package |
| `microteia pack-console [--output <dir>]` | Microteia | builds the Console itself to run outside the repository |
| `microteia publish [--kernel-only\|--console-only] [--repo <owner/name>] [--dry-run]` | Microteia | publishes what the two above produced |
| `microteia init [--name <office>] [--id <env>] [--force]` | office | creates the installation in the current directory |
| `microteia connect --project <projectId> [--no-create-web-app]` | office | links the installation to their Firebase |
| `microteia unpack --version <latest\|x.y.z>` | office | downloads the version from the catalog, verifies its `sha256` and puts it in place, without publishing anything |
| `microteia unpack --kernel <package.tgz>` | office | the same, from a local file — for those who cannot reach the catalog |
| `microteia deploy [--only rules,indexes,functions,hosting] [--delay <s>] [--prune] [--all]` | office | publishes the package that is in place |
| `microteia provision [--prune] [--delay <s>] [--all]` | office | gives installed extensions the functions and indexes they require |
| `microteia export-catalog --tenant <tenantId> [--output <path>]` | office | writes what an office has — screens, lists, extensions — for the authoring tools to read |
| `microteia plugin-init --namespace <com.acme> [--dir <path>] [--force]` | office | prepares `extensions/`, for writing extensions in TypeScript, under the office's namespace |

On the installer's machine it comes from npm, not from here:

```bash
npm i -g @microteia/console     # or: npx @microteia/console --help
```

To build the folder that gets published — another machine, a network without public npm, a test before
uploading:

```bash
npm run pack:console     # -> distributions/console/<Console version>/
```

The folder has `lib/`, a `package.json`, a README and `CONSOLE-VERSIONS.md`, weighs ~500 KB and
**installs nothing**: the Console uses only Node built-in modules. It runs as is (`node lib/index.js
--help`) and is exactly what `publish` sends to the registry.

The `package.json` is why there is a command instead of a `cp -R`: the compiled output is ESM, and
without `type: module` Node only loads it by guessing the syntax — which exists from 22.7 on and fails
before that. And `CONSOLE-VERSIONS.md` is in `files` for a reason that is not documentation: `unpack`
reads that file NEXT TO the running binary, to place it at the root of the installation.

In that copy, the office commands work; `pack`, `pack-console` and `publish` refuse with a clear
message, because building and publishing require the repository.

### 1. Building a package version (Microteia side)

The package version **is** the `version` in `package.json`. So, before packing, bump it and add the
matching entry to `VERSIONS.md` — the same step as any commit.

```bash
npm run pack:kernel
```

It compiles the Console and runs, in order: `npm run verify`, the frontend build with `TARGET=dist`,
the Cloud Functions build, the bundle audit, the assembly and the tarball.

```
distributions/kernel/<version>/
├── manifest.json                      # readable without unpacking; carries the tarball's sha256
└── microteia-kernel-<version>.tgz     # ~7 MB
```

The OUTER `manifest.json` is the only one that carries `tarball: { name, bytes, sha256 }`; the one
inside the tarball does not — a manifest cannot describe the file that contains it. That is the only
difference between the two copies, and it is what makes it possible to verify what was downloaded.

Two things `pack` guarantees, and which are the reason it exists instead of a hand-rolled `tar`:

- **No Firebase project inside the bundle.** The distribution build uses `TARGET=dist`, for which
  **there is no** `.env.dist` — nothing is inlined, and `cli/src/vendor/bundleAudit.ts` aborts the
  packing if it finds a credential in the artifact.
- **Only compiled code travels.** No `src/` (neither the frontend's nor the functions') and no `.js.map`.

The `manifest.json` is derived from the code, not handwritten: functions, callables, backend
parameters (`defineString`), region, kernel contract version and the manual prerequisites.

`--skip-verify` skips only the quality gate (useful while iterating); `--output <dir>` changes the
destination.

#### 1.1 Publishing

```bash
npm run pack:console          # the Console version that goes along
microteia publish --dry-run   # says what would be uploaded, and what the catalog would look like
microteia publish
```

It **does not build** — the quality gate is run by `pack`. What it does is upload the assets to the
releases repository (`gh`), publish the Console to npm, and write the `kernel/index.json` catalog
**last**: an index pointing to a file that was not uploaded breaks the installation of everyone who
asks for `latest`, while a file the index does not mention yet breaks nothing. An already-published
version is a refusal — a release is never rewritten. Details, and why the catalog lives at a URL of
ours: the "O canal de distribuição" section of [ARCHITECTURE.md](./ARCHITECTURE.md).

### 2. Preparing the office's Firebase project

On the installer's machine: Node.js **22 or newer**, `firebase-tools` authenticated (`firebase login`)
and `gcloud` authenticated (`gcloud auth login`) — it is used in the App Engine step and, later, for
`provision` to read which extensions the office installed.

> On a machine with Node newer than 22, the functions' `npm install` warns `EBADENGINE`. That is
> **expected**: the package's `engines.node` describes the Cloud Functions runtime (pinned to 22, it is
> what Firebase uses to choose where the function runs), not the installer's machine. The deprecation
> notices that show up alongside come from Firebase's own dependencies. Neither prevents the deploy, and
> `deploy` warns about this before running npm.

In the Firebase project, the steps below are done in the console: **no command does them**, and
`connect` prints the whole list with the reason for each one (it lives in the manifest, in
`MANUAL_PREREQUISITES`, and travels with the package because the installer does not have this
repository).

In the same order `connect` prints them:

| Step | Why it cannot be automated |
|---|---|
| **Blaze** plan, before anything else | 2nd-generation Cloud Functions do not exist on the free tier, and without billing neither App Engine nor the Storage bucket can be created |
| `gcloud app create --region=southamerica-east1 --project=<projectId>` | without it the deploy fails with a 404 that does not mention App Engine — and the region is set once and for all |
| **Firestore** in the same region as the functions | the location is permanent; a different region makes triggers never fire |
| **Cloud Storage** started from the console | enabling the API is not enough: the default bucket does not exist and no CLI command creates it |
| **Authentication → Google** enabled | without it nobody can sign in |
| Callable invocation by `allUsers` — *only if the organization blocks it* | the deploy grants it and then verifies; an organization policy may refuse it |
| Whatever an installed extension asks for (third-party credential, Pub/Sub topic) | `provision` itself prints the list, per extension; credentials are never shared between installations |

Firestore **TTL** policies (`auditLogs.expiresAt`, `workflow_trigger_marks.expiresAt`) are not on this
list because they are not a console step: they are declared with `"ttl": true` in
`firestore.indexes.json`, and the index deploy writes them.

### 3. Installing (office side)

```bash
npm i -g @microteia/console

mkdir acme && cd acme

microteia init --name "Acme Office"
microteia connect --project acme-microteia
microteia unpack --version latest
microteia deploy
```

`unpack --version` reads the published catalog, downloads, checks `bytes` and `sha256`, and **only
then** replaces what is in place — a refusal (for example, a package that requires a newer Console)
leaves the previous version intact. On a machine with no access to the catalog, name the file:
`microteia unpack --kernel /path/to/microteia-kernel-<version>.tgz`. The download is kept in
`~/.microteia/cache`, outside the installation, because `.microteia/` is wiped on every kernel change.

What ends up in the directory:

```
microteia.yaml              # the installation: name, environment, projectId, region, kernel version
.env.<projectId>            # YOUR backend settings — credentials, gitignored
.gitignore                  # created alongside: this directory tends to become a repository of yours
README.md                   # YOURS: created if missing, and never rewritten
MICROTEIA.md                # OURS: overwritten on every `unpack`, stamped from the installed package
KERNEL-VERSIONS.md          # the kernel's technical history — ships inside the package
CONSOLE-VERSIONS.md         # the Console's technical history — ships with the binary
functions/                  # optional: the Cloud Functions you write (see §5)
extensions/                 # optional: the extensions you write (see §6)
.microteia/                 # DISPOSABLE: rebuilt from the package + `connect`. Nothing of yours lives here
├── firebase-config.json    # web config read from the office's project (by `connect`)
└── install/                # the unpacked package — this is where the deploy runs from
```

**`unpack` and `deploy` are separate on purpose.** Changing kernels does not force you to publish
everything: if only the frontend changed in that version, `microteia deploy --only hosting` is enough.
And between the two there is the moment to fill in a setting the new package started asking for —
which is exactly when you find out it exists.

`unpack` replaces the package and writes the missing settings to the root `.env.<projectId>`,
**appending** and never overwriting. `deploy` stamps `hosting/firebase-config.js` with the office's
project, copies `.env.<projectId>` to where `firebase-functions` reads it, and publishes in order:
rules → indexes → functions → hosting. Functions go up **one at a time** (in a batch they exceed the
project's CPU quota), with a second pass for trigger functions, which on a fresh installation fail
because of service identity propagation. At the end it checks, through the same path the browser uses,
whether the callables respond — and, if the invocation permission was refused, it prints the exact
command for each one.

What goes up here is the **baseline**: what every installation needs. Functions and indexes that belong
to an extension are left out until the extension is installed — see the next step.

### 3.1. Extensions that need server resources

Some extensions require from the Firebase project what no screen declares: a Cloud Function, a
composite index, a credential. One that receives e-mail, talks to a third-party API or queries by two
fields at once is the case — that lives on the server.

An extension can bring its own Cloud Functions (in `extensions/<plugin>/functions/`) or claim one that
the platform package already ships. In both cases the declaration is the same, and so is the effect:
the artifact only exists in the project of the office that installed the extension.

Installing one of these from the application is not enough: it shows up on the Extensions screen with
the **"Backend pending"** notice and does **not** enter the menu. Whoever runs the project applies
what is missing:

```bash
microteia provision
```

It reads what the offices installed, creates the indexes, deploys the missing functions, warns about
parameters still empty in `.env.<projectId>` and prints the manual steps each extension declares —
creating an OAuth client, a Pub/Sub topic, whatever it is. Reload the application and the extension is
live.

This requires `gcloud` authenticated (`gcloud auth login`): it is how the Console reads what is
installed. It stores no credentials — it asks for the token on every run.

**Filled in (or changed) a value in `.env.<projectId>`? Run `microteia provision` again.**
A Cloud Function only sees the value of the deploy that stamped it: filling in the file afterwards
reaches none of them, and the feature only fails when it is used. `provision` compares the file with
what was already applied and redeploys exactly the functions that carry the changed parameter — neither
the whole baseline nor anything beyond them. You don't need to remember what changed or pass a flag: it
finds out.

When you uninstall an extension, `microteia provision` **reports** what was left orphaned without
deleting anything. `microteia provision --prune` deletes the orphaned functions; an index is never
deleted automatically, only listed with the command (a deploy does not remove indexes, and deleting the
wrong one costs a query in production).

### 4. Updating an installation

```bash
microteia --version              # says whether a newer version is published
microteia unpack --version latest
microteia deploy                 # or --only hosting, --only functions, ...
```

And the Console, which has its own version: `npm i -g @microteia/console` again, or `npm outdated -g`.
A package that requires a newer Console is refused by `unpack` **before** anything is replaced.

The kernel is replaced entirely, and what belongs to the office is preserved. Inside `.microteia/`,
only `functions/node_modules` survives the swap — and it is a cache. **Everything of yours lives
OUTSIDE `.microteia/`** — `.env.<projectId>`, `functions/` and `extensions/` sit next to
`microteia.yaml`, and that is what makes them immune to `unpack`.

### 4.1. Backend settings

Some extensions ask for a server-side credential or identifier. These live in **`.env.<projectId>`,
next to `microteia.yaml`** — never inside `.microteia/`:

```bash
# .env.acme-microteia
GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

`unpack` discovers these names from two sources: the platform package's `defineString`s and those of
the Cloud Functions the office wrote itself. The line must exist even if empty — `firebase-functions`
validates parameters globally, so one of them without a value refuses the deploy of **every** function
in the project, including the ones that have nothing to do with it.

`unpack` creates the file and appends whatever a new package started asking for, without touching what
you already filled in. `init` creates the `.gitignore` that covers it — these are credentials.

**After changing a value, run `microteia provision`.** The value is stamped into each Cloud Function on
ITS deploy, so a function already live keeps the previous value until it goes up again; `provision`
detects the change (through a fingerprint in `microteia.yaml`) and re-queues exactly the functions that
carry that parameter.

### 5. The office's own Cloud Functions

The kernel is immutable and is extended by addition — and their source lives **outside**
`.microteia/`, in two places that answer two different questions:

| Where | When | Goes up with |
|---|---|---|
| `functions/` (next to `microteia.yaml`) | the function is SHARED by several | `microteia deploy` |
| `extensions/<plugin>/functions/` | the function belongs to THAT extension | `microteia provision` |

Each directory is read through its `index.ts`, and declares in the `package.json` beside it the npm
dependencies it needs. `deploy` assembles `.microteia/install/functions/custom/src/` from both,
generates the barrel, and the `predeploy` compiles **only** `custom/`; the entrypoint merges kernel and
custom with flat names. Two directories exporting the same name, or a name that collides with a kernel
function, is a **refusal**: custom functions are spread after the kernel's, so the duplicate would
silently replace it — and a replaced kernel trigger does not fail, it simply stops happening.

At this stage the office writes against `firebase-functions` and `firebase-admin`, not against the
kernel's internal APIs.

### 6. Extensions written by the office itself, in TypeScript

The system installs extensions from a `.json`, but nobody needs to write `.json`: the package ships an
SDK, and with it the office writes the extension in TypeScript, in VSCode, with types and
autocomplete — without needing the kernel's source code (what travels is compiled code plus `.d.ts`).

```bash
microteia plugin-init --namespace com.acme   # creates "extensions/" next to microteia.yaml
cd extensions
npx microteia-plugin create hello             # becomes com.acme.hello
npx tsc --noEmit                              # types
npx microteia-plugin check hello/plugin.ts    # the gate
npx microteia-plugin build hello/plugin.ts    # generates hello/com.acme.hello.json
```

The generated `.json` is imported on the **Extensions** screen. Fine-tuning it directly still works:
it is the final output.

Two things are worth knowing before you start:

- **`check` is not an approximation of the platform's validation — it is that validation.** The same
  function, the same messages. If `check` passes, the package installs.
- **An extension that brings code (`views`/`startup`) installs inert.** An administrator opens the
  source, reads it and trusts it; the trust is bound to that exact code, by hash. Changing a single
  character requires trusting it again.

`extensions/` sits **outside** `.microteia/` — it belongs to the office, and upgrades don't touch it,
just like the root `functions/`. Keeping it up to date is `unpack`'s job: when the directory exists, it
calls `microteia-plugin sync` on its own, and a failure there warns without bringing down the kernel
swap.

The directory comes with the manual (`AUTHORING.md`), the operating rules (`AGENTS.md` — plus a
`CLAUDE.md` that is created once and becomes yours), the first-party extensions as SOURCE in
`examples/`, and a `.mcp.json` that registers an MCP server: an AI in the editor queries the extension
points, the available API and the validation of **this** installation, instead of a snapshot of the
documentation.

Three policies coexist there, and the difference is who owns the file: `AGENTS.md`, `AUTHORING.md` and
`examples/` are overwritten (our prose); `CLAUDE.md` and `README.md` are created once and are yours;
and `tsconfig.json`, `.mcp.json`, `.gitignore` and `package.json` are **reconciled** — `sync` adds the
missing requirement, never changes what you wrote, and warns when the two diverge.

The reason behind each decision above: the **"Distribuição — a Microteia instalável no Firebase do
cliente"** section of [ARCHITECTURE.md](./ARCHITECTURE.md).

## Project Structure

```
src/
├── kernel/          # The plugin runtime: PluginHost and registries. Knows NO domain at all
├── plugins/         # The kernel plugins (core.*), the themes and the marketplace catalog
├── sdk/             # The extension authoring SDK — depends only on domain/
├── domain/          # Entities, repository interfaces, use cases and the shared schemas
├── data/            # Firebase implementations of the repositories
├── infrastructure/  # Firebase config, DIContainer, events, deeplink
├── stores/          # Global React contexts (Auth, Tenant, Data, Theme…)
├── presentation/    # Pages and components (MVVM-per-folder pattern)
├── routes/          # Route protection
└── shared/          # Global types and styles

functions/           # Cloud Functions (the backend kernel is GENERATED by sync-schemas)
cli/                 # The Console: pack, init, connect, deploy
scripts/             # Build/deploy automation and the gate's checkers
```

The dependency hierarchy is `domain ← data ← infrastructure ← stores ← presentation`, and never the
other way around.

For architecture details, code patterns and Firestore rules, see [ARCHITECTURE.md](./ARCHITECTURE.md).
For the platform's user and authoring documentation, see [doc.microteia.com](https://doc.microteia.com).

## What belongs to the kernel and what is an extension

The kernel delivers **generic capabilities** — no business domain:

| Capability | What it is |
|---|---|
| **Screen builder** | Creates entities, fields, lists and forms without writing code |
| **Automations** | Workflows with triggers, steps, per-field expressions and sandboxed Scripts |
| **Marketplace** | Installs, updates and removes extensions per tenant |
| **Office** | The tenant's members, roles, integrations and settings |
| **Audit** | Change trail with TTL-based expiration |
| **Languages and themes** | Both as contributions: English is the source language, everything else is a package |

Domains come from the catalog, as extensions — and the proof that the kernel does not depend on them
is that most of them are no longer in this repository: the seven law-office extensions (People,
Contracts, Cases, Deadlines, Financials, Court Pushes and Case Kanban) are maintained outside it, by the
office, and nothing here names them. The business-agnostic ones remained as authoring examples: News,
Calendar, Dashboard, Brazil data and the pt-BR translation.

## Multi-tenant

- On first sign-in, a default tenant `[displayName]([email])` is created automatically, and the user is its `ownerId` — with no role seeded. The name is built only from what the user brought. The FIRST user of the system is born `SYSTEM`.
- The active tenant lives in `useTenant().currentTenant`; every data store only loads when it is not `null`.
- **There are no per-office roles built in.** The office creates its own roles (`tenants/{id}/roles`) and members receive them in `roleIds`; all code asks for a PERMISSION (`can('screens.manage')`), never for a role. The two exceptions are not roles: the global `SYSTEM` role (administrator of every office) and the office owner (wildcard `*`, read from `Tenant.ownerId`).
- Global role: `SYSTEM` | `USER` — the only closed union left.
- The last chosen tenant is saved in `localStorage` under the key `microteia:lastTenantId`.

## Authentication

Firebase Authentication with Google Sign-In.

## Contributing

Contributions are welcome — read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.
The short version: the kernel never learns a business name, every change passes `npm run verify`, and
every commit bumps the version and the changelogs.

## License

Copyright © Alexnaldo Carvalho dos Santos and the Microteia contributors.

Microteia is free software: you can redistribute it and/or modify it under the terms of the
**GNU Affero General Public License** as published by the Free Software Foundation, either
**version 3** of the License, or (at your option) **any later version** — supplemented by the additional
terms and the extension exception in [NOTICE](./NOTICE), under section 7 of the license.

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without
even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
[GNU Affero General Public License](./LICENSE) for more details.

### The platform: changes stay open, and the origin stays visible

| You may | Provided that |
|---|---|
| run Microteia for any purpose, commercial included | — |
| study and change the source code | — |
| distribute it, changed or not — the compiled package included | it carries this same license, `LICENSE`, `NOTICE` and the complete corresponding source code |
| offer a changed version to users **over a network**, as a service | those users can get the complete source code of the version they use — the AGPL closes the SaaS gap the GPL leaves open |

And every copy, changed or not, must:

- **keep the attribution** *“Based on Microteia — https://github.com/microteia/microteia”*, with the
  copyright notice, on the application's Terms page and in its README;
- **be marked as modified**, and never present itself as the original Microteia;
- **not use the Microteia name or logo** beyond that attribution — the license grants no trademark
  rights.

### Extensions: yours, under the license you choose

The **Microteia Extension Exception** (in [NOTICE](./NOTICE)) means that a plugin, module, theme,
language package, script or Cloud Function written for Microteia, and that talks to it only through the
published interfaces — the package format, the `@microteia/sdk` authoring SDK, the curated host API, the
sandbox and the office functions API — **is not covered by the AGPL**. Its author picks the license:
proprietary, permissive or copyleft, and may sell it. Code copied from the SDK's authoring examples may
go into it under the same freedom.

What the exception does **not** cover is a change to Microteia itself — the kernel, a first-party plugin
or the SDK. That is a modification of the platform, and it stays under the AGPL.

**The license covers the software, not your data.** The records, files and configuration an
organization keeps in its installation belong to that organization.

`LICENSE` and `NOTICE` also ship inside every package: the kernel tarball, the Console on npm and the
authoring SDK.
