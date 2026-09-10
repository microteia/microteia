import type { KernelManifest } from '../kernel/manifest.js';

/**
 * Os dois documentos que ficam ao lado do `microteia.yaml`.
 *
 * Eram um `README.md` DENTRO do pacote, em `.microteia/install/`. Estava no lugar errado por duas razões:
 * ninguém abre um diretório que se anuncia como descartável para ler documentação, e o que ele explicava
 * — onde escrever function, onde ficam as configurações — apontava para caminhos de dentro dele mesmo,
 * que é justamente o que não se deve editar.
 *
 * A divisão entre os dois é sobre QUEM ESCREVE:
 *
 * - `README.md` é do escritório. Nasce se não existir e nunca é reescrito — ele vai renomear coisas,
 *   acrescentar o contexto do negócio dele, apagar o que não usa. Por isso só contém o que não muda.
 * - `MICROTEIA.md` é nosso. É SOBREPOSTO a cada `unpack`, e é onde vai o detalhe que acompanha a versão:
 *   a lista de comandos, os números do pacote, os caminhos. Um documento que promete estar atualizado
 *   não pode ser editável, e um documento que a pessoa edita não pode prometer isso.
 *
 * Ao lado deles ficam os dois históricos técnicos, que seguem a política do `MICROTEIA.md` e moram em
 * `changelogs.ts` — cada um viaja no artefato que descreve, e não neste módulo.
 */

export const INSTALLATION_README = 'README.md';
export const INSTALLATION_GUIDE = 'MICROTEIA.md';

/**
 * O README do escritório. Escrito UMA vez, e daí em diante é dele.
 *
 * Deliberadamente sem número de versão, sem contagem de function e sem nada que envelheça: o que
 * envelhece vive no `MICROTEIA.md`, que é reescrito. Um README com um dado velho ensina a desconfiar do
 * arquivo inteiro.
 */
export const installationReadme = (officeName: string): string => `# ${officeName}

This directory is a **Microteia** installation: a multi-tenant business platform where the applications
are built by *declaration* — screens, automations, actions and pages arrive as extensions, and the
platform itself is never modified.

It is yours. Rename it, describe your business in it, delete what you do not use. Nothing rewrites this
file. The reference that has to stay current lives in **[MICROTEIA.md](./MICROTEIA.md)**, which is
replaced on every \`microteia unpack\` — read that one for commands, paths and version detail. Beside it,
**[KERNEL-VERSIONS.md](./KERNEL-VERSIONS.md)** and **[CONSOLE-VERSIONS.md](./CONSOLE-VERSIONS.md)** say
what changed in each version of the platform and of the Console.

## The shape of this directory

    microteia.yaml         this installation: name, Firebase project, region, kernel version
    .env.<projectId>       your backend settings. Credentials — gitignored
    KERNEL-VERSIONS.md     what changed in each version of the platform
    CONSOLE-VERSIONS.md    what changed in each version of the Console that installs it
    extensions/            the extensions you write
    functions/             Cloud Functions shared by more than one extension
    .microteia/            the unpacked platform. DISPOSABLE — nothing of yours lives here

The line that explains the rest: **nothing you write lives in \`.microteia/\`.** That directory is
replaced whole on every upgrade. Everything of yours sits beside this file.

## Day to day

    microteia unpack --version latest   # take the newest published platform version
    microteia deploy                    # publish it — or --only hosting, --only functions
    microteia provision                 # apply what installed extensions need

\`unpack --version\` reads the published catalog, downloads the version and checks its sha256 before
touching what is installed here. On a machine that cannot reach the catalog, name a file instead:
\`microteia unpack --kernel <package>.tgz\`. And \`microteia --version\` says when a newer one is out.

## Building your own extensions

An extension is a declaration the platform installs — a screen with its fields, an automation, a page.
You write it in TypeScript and a compiler produces the \`.json\` that gets installed:

    cd extensions
    npx microteia-plugin create        # guided: asks what the extension should carry
    npx microteia-plugin check <folder>/plugin.ts
    npx microteia-plugin build <folder>/plugin.ts

\`extensions/examples/\` holds every extension that ships with Microteia, in source form — the best
reference there is. \`extensions/AUTHORING.md\` is the contract: extension points, the API a page may
use, translation rules, size limits.

## Working with an AI assistant

\`extensions/\` registers an MCP server (\`.mcp.json\`), so an assistant in your editor can ask **this**
installation what it offers — the extension points it has, what a page may import, and whether what it
just wrote would be accepted — instead of guessing from documentation. \`extensions/AGENTS.md\` holds the
rules it should follow.

The point of that is not novelty: it is that the assistant's answer can be *checked* before anything is
installed, by the same validation the platform runs.
`;

const commandRows = (): string => [
  '| Command | What it does |',
  '|---|---|',
  '| `microteia unpack --version <latest\\|x.y.z>` | Downloads a platform version, verifies it, and puts it in place. Touches no Firebase — safe any time |',
  '| `microteia unpack --kernel <pkg>.tgz` | The same, from a file you already have — for a machine with no access to the catalog |',
  '| `microteia deploy [--only …] [--prune] [--all]` | Publishes what is in place: `rules`, `indexes`, `functions`, `hosting`. A Cloud Function the project already runs with this exact code is not deployed again; `--all` deploys every one of them anyway. `--prune` also deletes functions left behind in a region this version no longer uses |',
  '| `microteia provision [--prune] [--all]` | Gives installed extensions the functions and indexes they ask for |',
  '| `microteia connect --project <id>` | Binds this installation to a Firebase project you own |',
  '| `microteia plugin-init` | Prepares `extensions/` for authoring in TypeScript |',
  '| `microteia export-catalog --tenant <id>` | Writes what an office has — screens, lists, installed extensions — into `extensions/`, so the authoring tools can see it. Reads only; with no `--tenant` it lists the offices. The file is a snapshot and is git-ignored: it carries names the office typed |',
].join('\n');

/**
 * O documento técnico. SOBREPOSTO a cada `unpack`, e por isso é onde o detalhe que acompanha a versão
 * pode viver — carimbado com os números do pacote que está instalado, não com uma cópia deles.
 */
export const installationGuide = (
  officeName: string,
  manifest: KernelManifest,
  examples: string[],
): string => {
  const baseline = (manifest.baselineFunctions ?? manifest.functions).length;
  const claimed = manifest.functions.length - baseline;

  return `# Microteia — installation reference

> Generated by \`microteia unpack\`. **Replaced on every unpack** — do not edit it; put your own notes in
> [README.md](./README.md), which is never rewritten.

| | |
|---|---|
| Installation | ${officeName} |
| Platform version | ${manifest.version} |
| Extension contract | ${manifest.kernelVersion} |
| Console required | ${manifest.minimumCliVersion} or newer |
| Functions region | ${manifest.requires.functionsRegion} |
| Cloud Functions | ${baseline} baseline, ${claimed} claimed by extensions |
${manifest.sdk === undefined ? '' : `| Authoring SDK | ${manifest.sdk.version} |\n`}
## 1. What lives where, and why

    microteia.yaml              the installation record. Written by the commands; readable by you
    .env.<projectId>            YOUR backend settings — credentials
    .gitignore                  covers the two above
    README.md                   yours, never rewritten
    MICROTEIA.md                this file, replaced on every unpack
    KERNEL-VERSIONS.md          the platform's technical history, replaced on every unpack
    CONSOLE-VERSIONS.md         the Console's own, replaced on every unpack
    extensions/                 the extensions you write
      <plugin>/plugin.ts        the source of one extension
      <plugin>/views/*.tsx      its pages, as real type-checked files
      <plugin>/functions/       its own Cloud Functions
      <plugin>/<id>.json        the built artifact — generated, do not hand-edit
      examples/                 every first-party extension, in source form
      AUTHORING.md              the authoring contract
    functions/                  Cloud Functions shared by more than one extension
    .microteia/                 DISPOSABLE
      install/                  the unpacked platform. Replaced whole on every unpack
      firebase-config.json      resolved from your Firebase project by \`connect\`

**Nothing you write belongs in \`.microteia/\`.** \`unpack\` deletes that directory and replaces it; only
\`functions/node_modules\` survives, and only because it is a cache. This is not a convention to respect —
it is what makes an upgrade trustworthy, and the reason your files are elsewhere.

## 2. Commands

${commandRows()}

### Signing in before there is an organization

The sign-in screen runs above the organization: there is no tenant there, so nothing an organization
installed can reach it. That is why \`login.extensions\` in \`microteia.yaml\` exists — it lists compiled
extension packages that \`deploy\` stamps into the site itself, and it is how a corporate SSO, or your own
mark on the sign-in screen, gets there.

Two things follow, and both are deliberate:

- **Nothing stamped runs JavaScript.** The packages load untrusted, so only declarations apply. That is
  what lets you put an SSO live without anyone reviewing code.
- **Stamping is not installing.** A stamped package applies before sign-in only; inside the organization
  what applies is what the organization installed, from the Extensions screen. To have both, do both.

\`deploy\` refuses a package that contributes to nothing which works before sign-in, rather than stamping
it: it would load with no effect, and you would believe it was live.

\`unpack\` and \`deploy\` are separate so that taking a new version does not oblige you to publish
everything, and so that there is a moment between the two to fill in a setting the new version asks for.

Between the two, \`microteia.yaml\` says both: \`kernel.version\` is what is in place, \`kernel.deployed\`
is what the project runs. \`microteia --version\` prints them next to the Console's own. What changed between
two versions is in \`KERNEL-VERSIONS.md\` and \`CONSOLE-VERSIONS.md\`. Each is written by the artifact it
describes — the first travels inside the package, the second with the Console — which is what keeps
either from describing a version that is not installed here. Both are replaced on every unpack, so put
nothing of yours in them.

\`unpack\` replaces \`.microteia/install/\` whole, and a package carries only the platform's own composite
indexes — an index an extension asks for is not in it, so that it does not travel to installations that
never install that extension. So \`unpack\` puts back what this installation had already declared, from
\`backend.indexes\` in \`microteia.yaml\`. Without that, publishing indexes after an upgrade would find
indexes in the project that the file no longer declares, and **offer to delete them** — for extensions
that are merely turned off, and whose indexes are the reason their screens are fast.

An index of an extension you removed stays declared and is reported on every \`provision\`. It costs only
writes on the collection it covers. \`microteia provision --prune\` lets it go: it drops out of this
installation, and the next \`microteia deploy --only indexes\` offers to delete it from the project —
deliberately, because you asked.

## 3. Backend settings

They live in \`.env.<projectId>\`, next to \`microteia.yaml\`. \`unpack\` creates the file and adds any
setting a new version introduces, **never overwriting what you filled in**.

After changing a value, run \`microteia provision\`. The value is stamped into each Cloud Function at
*its* deploy, so a function already running keeps the previous one until it is deployed again; provision
notices the change (by a salted digest in \`microteia.yaml\`) and requeues exactly the functions that
carry that setting.

An empty line means "not configured". A feature that needs it stays off rather than failing halfway.

## 3.1 Why a deploy is usually much faster than the first one

Firebase stamps every Cloud Function with what it was built from — the whole source directory, the
resolved environment variables, and the secret versions. \`microteia deploy\` reads those stamps, deploys
one reference function, and compares: a function whose stamp comes back unchanged is byte-for-byte what
the project already runs, and is left alone. It is the same comparison \`firebase deploy\` makes when it
deploys in bulk, which is why a version that only changed the application's screens finishes in minutes
instead of publishing every function again.

What the stamp does not see is configuration changed **outside** this installation — memory, timeout,
concurrency or invoker policy edited in the Google console. \`microteia deploy --all\` deploys everything
regardless, and is the answer for that.

## 4. Your own Cloud Functions

Two places, answering two different questions:

| Where | When |
|---|---|
| \`extensions/<plugin>/functions/\` | the function belongs to that extension |
| \`functions/\` | the function is shared by more than one |

Each directory is read through its \`index.ts\` — export from there what should be deployed.
\`microteia deploy\` gathers them into the package, generates the entry point, and refuses the deploy if
two of them export the same name, or if one collides with a platform function. That refusal matters: the
entry point spreads yours *after* the platform's, so a repeated name would replace a platform trigger
silently, and a trigger that was replaced does not fail — it simply stops happening.

A function that belongs to an extension should also be declared in its
\`manifest.backend.functions\`. That is what makes the installation deploy it only where the extension is
installed, instead of everywhere.

Functions are pinned to **${manifest.requires.functionsRegion}**. One in another region receives no
Firestore trigger from this project, and the deploy reports nothing.

## 5. Writing extensions

    cd extensions
    npx microteia-plugin create                 # guided
    npx microteia-plugin create function        # adds a Cloud Function to an existing extension
    npx tsc --noEmit                            # types
    npx microteia-plugin check <folder>/plugin.ts
    npx microteia-plugin build <folder>/plugin.ts

\`check\` is not an approximation of the platform's validation — it *is* it, the same function and the
same messages. If \`check\` passes, the package installs.

**A package that carries code installs inert.** An administrator opens the source, reads it, and trusts
it; the trust is bound to that exact code by hash. Changing one character requires trusting it again.

### Examples included with this version

${examples.length === 0 ? '_None in this package._' : examples.map((id) => `- \`extensions/examples/${id}/\``).join('\n')}

Each is the real source of an extension that ships with Microteia. Build any of them and you get the
same \`.json\` the platform installs:

    npx microteia-plugin build examples/${examples[0] ?? '<example>'}/plugin.ts

## 6. An AI assistant in this directory

\`extensions/.mcp.json\` registers an MCP server that answers from **this** installation: the extension
points it has, what a page may import, the authoring guide, and whether a package would be accepted.
\`extensions/AGENTS.md\` (and \`CLAUDE.md\`, the same content) holds the rules.

The validation tool is the part that matters — it closes the loop between what an assistant proposes and
what the platform would do with it, before anything is installed.

## 7. Manual prerequisites

Things no command can do for you, in the Firebase or Google Cloud console:

${manifest.manualPrerequisites.map((prerequisite) => `- **${prerequisite.title}**${prerequisite.optional ? ' _(optional)_' : ''}\n  ${prerequisite.detail}`).join('\n')}
`;
};
