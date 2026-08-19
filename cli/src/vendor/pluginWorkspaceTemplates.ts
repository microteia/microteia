/**
 * O que é GERADO dentro de `extensions/` — o diretório em que o escritório escreve extensão.
 *
 * Mesma regra de `functions/custom/`: fica FORA de `.microteia/`, é do escritório, e o upgrade não o
 * toca. O que o upgrade troca é o SDK dentro do pacote; um `npm install` depois dele traz a versão
 * nova, e é por isso que o caminho do tarball não leva número de versão.
 *
 * Tudo aqui é escrito em inglês. O `ARCHITECTURE.md` e o `CLAUDE.md` deste repositório são em
 * português porque são comunicação nossa; isto é SUPERFÍCIE DE PRODUTO, entregue a um escritório que
 * pode estar em qualquer lugar — a mesma razão por que o idioma-fonte do produto é o inglês.
 */

export const SDK_TARBALL = 'microteia-sdk.tgz';

export const workspacePackageJson = (
  officeName: string,
  sdkPath: string,
  version: string,
): string => JSON.stringify({
  name: `${officeName}-extensions`,
  version: '0.0.0',
  private: true,
  description: 'Microteia extensions authored by this organization.',
  scripts: {
    // `create` é o guia: pergunta o que a extensão vai ser e gera só o que ela precisa.
    create: 'microteia-plugin create',
    'create:function': 'microteia-plugin create function',
    check: 'microteia-plugin check',
    build: 'microteia-plugin build',
    typecheck: 'tsc --noEmit',
    test: 'vitest run',
  },
  dependencies: {
    // Caminho SEM versão de propósito: depois de "microteia deploy" trazer um kernel novo, um
    // `npm install` aqui pega o SDK novo sem ninguém editar este arquivo.
    '@microteia/sdk': `file:${sdkPath}`,
  },
  devDependencies: {
    '@types/node': '^24.0.0',
    typescript: '^5.9.0',
    vitest: '^4.0.0',
  },
  microteia: { kernelVersion: version },
}, null, 2) + '\n';

/**
 * O `paths` é o que faz uma view `.tsx` ser checada de verdade: os módulos `@microteia/*` não existem
 * em `node_modules` — eles são resolvidos pelo RUNTIME do browser contra a API curada —, então sem
 * este mapeamento o `tsc` diria "cannot find module" no import mais importante do arquivo.
 */
export const workspaceTsconfig = (): string => JSON.stringify({
  compilerOptions: {
    target: 'es2022',
    lib: ['ES2022', 'DOM'],
    module: 'esnext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    types: ['node'],
    strict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noFallthroughCasesInSwitch: true,
    noEmit: true,
    skipLibCheck: true,
    // A ORDEM importa: `@microteia/sdk` e `@microteia/sdk/node` vêm antes do curinga, senão ele os
    // engole e o `tsc` acusa "não é um módulo" no import do compilador.
    paths: {
      '@microteia/sdk': ['./node_modules/@microteia/sdk/lib/sdk/index.d.ts'],
      '@microteia/sdk/node': ['./node_modules/@microteia/sdk/lib/sdk/node/compile.d.ts'],
      '@microteia/*': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
      react: ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
      'react/jsx-runtime': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
      'styled-components': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
    },
  },
  include: ['**/*.ts', '**/*.tsx'],
  // `*/functions/` é compilado pelo PACOTE no deploy, contra `firebase-functions` — que não é dependência
  // deste projeto por padrão. Quem escreve function instala os tipos (`npm i -D firebase-functions
  // firebase-admin`) e tira a linha abaixo; até lá, incluí-los daria "cannot find module" no import mais
  // óbvio do arquivo.
  exclude: ['node_modules', '**/functions/**', 'examples/**'],
}, null, 2) + '\n';

/**
 * O `.json` de uma extensão é ARTEFATO — sai do `build` e não se versiona. A configuração e o lock,
 * sim: sem o lock, dois computadores do mesmo escritório instalam versões diferentes do SDK.
 */
export const workspaceGitignore = (): string => `node_modules/
*.json
!package.json
!package-lock.json
!tsconfig.json
!.mcp.json
`;

/**
 * Registra o servidor MCP para o editor. É o que liga a IA do VSCode à verdade desta instalação.
 *
 * Aponta para o arquivo, não para `npx microteia-plugin`: com `npx`, um `node_modules` ainda não
 * instalado faz a chamada ir ao registry público e voltar com "404 Not Found" — como se a ferramenta
 * nunca tivesse existido, em vez de dizer que falta um `npm install`.
 */
export const workspaceMcpJson = (): string => JSON.stringify({
  mcpServers: {
    microteia: {
      command: 'node',
      args: ['node_modules/@microteia/sdk/lib/sdk/node/cli.js', 'mcp'],
    },
  },
}, null, 2) + '\n';

export const workspaceAgentsMd = (version: string): string => `# Working in this directory

You are authoring **Microteia extensions**. Read this before writing or changing anything here.

## The one rule that explains all the others

An extension is a **declaration**, not a patch. You never modify the platform; you declare what you
want, and the platform installs it. Everything below follows from that.

## The gate — non-negotiable

Nothing is finished until both of these pass:

    npx tsc --noEmit
    npx microteia-plugin check <folder>/plugin.ts

\`check\` runs the *exact* validation the platform runs on install. If it passes, the package installs;
if it fails, the package would be refused. Do not hand over work that has not passed it.

## What you may and may not touch

| Path | |
|---|---|
| \`<folder>/plugin.ts\` and its files | yours — this is the source |
| \`<folder>/<id>.json\` | **generated.** Never hand-edit it; run \`build\` |
| \`<folder>/functions/\` | that extension's own Cloud Functions |
| \`../functions/\` | Cloud Functions shared by several extensions |
| \`examples/\` | first-party extensions, as reference. Read them; do not edit them |
| \`node_modules/@microteia/sdk\` | the SDK. Read it, never change it |
| \`../.microteia/\` | the installation. Never touch it — it is replaced on every upgrade |

## Creating one

    npm run create              # guided; asks what the extension should carry
    npm run create:function     # adds a Cloud Function to an existing extension

Use it rather than copying a folder by hand: it generates only what was asked for, and what it generates
already passes the gate.

## Text

Every label a person reads is a **message reference**, never a literal:

    label: '@com.example.hello/field.title'      // right
    label: 'Title'                                // wrong

The references resolve against the bundles the extension declares in \`manifest.contributes\`, via
\`messageBundleContribution\`. Ship \`en\` always; add other locales as extra bundles. The platform does
not translate an extension's vocabulary — the extension that declares a word answers for it.

What the organization *typed* (a screen name, a field label they created) is data, not product text,
and is never translated.

## Code

A view or \`startup\` may import **only** from the curated API: \`@microteia/ui\`, \`@microteia/data\`,
\`@microteia/format\`, \`@microteia/i18n\`, \`@microteia/theme\`, \`@microteia/settings\`,
\`@microteia/functions\`, \`react\` and \`styled-components\`. Any other import throws at runtime. Ask the
MCP server (\`describe_host_module\`) rather than guessing what a module exports.

Write views as real \`.tsx\` files and point at them with \`sourceFile\`. Never paste code into a string:
a string is not type-checked, and that is where mistakes hide.

**Code does not run until a human trusts it.** A package carrying \`views\` or \`startup\` installs
inert; an administrator opens the source, reads it and trusts it, and the trust is bound to that exact
code by hash. Changing one character un-trusts it. This is deliberate — do not look for a way around it.

## Before you write

Ask the MCP server. It answers from this installation, not from a snapshot of documentation:

- \`read_authoring_guide\` — the manual (\`AUTHORING.md\`)
- \`list_extension_points\` — every point, its API version, and which impl kinds it accepts
- \`describe_host_module\` — what a curated module actually exports
- \`validate_plugin\` — after every edit; this is the short feedback loop
- \`workspace_info\` — what this workspace is bound to

## Limits worth knowing before designing

- A package must stay under **800 KiB** (it is stored as one document). A warning starts at 400 KiB.
- Every reference out of the package must be **in** the package or covered by a declared
  \`dependency\`. \`check\` refuses a dangling one.
- Changing the **shape of data already written** by an earlier version of your extension requires a
  \`migration\` — see the guide.

Kernel contract: ${version}.
`;

export const workspaceReadme = (officeName: string, version: string): string =>
  `# Extensions — ${officeName}

The extensions this organization writes. Each one is a folder.

    npm run create                               # guided: asks what the extension should carry
    npx tsc --noEmit                             # types
    npx microteia-plugin check <folder>/plugin.ts    # the gate
    npx microteia-plugin build <folder>/plugin.ts    # writes <folder>/<id>.json

Then import the \`.json\` on the **Extensions** screen of your Microteia.

## Why TypeScript, when the platform reads JSON

The \`.json\` is the artifact; this directory is the source. Writing the source in TypeScript is what
gives you types, autocomplete and unit tests — and it lets an AI assistant do the work and be *checked*
before anything is installed. Hand-editing a generated \`.json\` still works: it is the final result.

## One folder per extension

    <folder>/
      plugin.ts        the declaration — this is the source
      messages.ts      every label it shows, so all of them can be translated
      plugin.test.ts   runs the platform's own validation against the built package
      views/*.tsx      its pages, as real files the compiler checks
      functions/       its own Cloud Functions (optional)
      <id>.json        GENERATED by build. Do not hand-edit; do not commit

## Cloud Functions

A function that belongs to one extension goes in \`<folder>/functions/\`. One shared by several goes in
\`../functions/\`, next to \`microteia.yaml\`. Either way, \`microteia deploy\` gathers them, and the
directory is read through its \`index.ts\`.

    npm run create:function        # adds one to an extension that already exists

They are excluded from this project's \`tsconfig.json\`, because they compile against
\`firebase-functions\` — which is not installed here by default. For types while you write them:

    npm i -D firebase-functions firebase-admin

then drop \`'**/functions/**'\` from \`exclude\` in \`tsconfig.json\`.

## examples/

Every extension that ships with Microteia, in **source** form — one folder each, exactly as you would
write your own. This is the most useful reference here: build any of them and you get the same \`.json\`
the platform installs.

    npx microteia-plugin build examples/pessoa/plugin.ts

Read them for the mechanism you need: \`pessoa\` for a plain entity, \`prazo\` for widgets and automations,
\`push\` for backend requirements, \`locale-pt-br\` for a translation-only package, \`kanban-processos\` for
a page written entirely in code.

## Files

    AUTHORING.md    the contract: package anatomy, extension points, the curated API, code trust
    AGENTS.md       the operating rules, for you and for an AI assistant
    CLAUDE.md       the same rules, where Claude Code looks for them
    .mcp.json       registers the MCP server, so an assistant can query this installation

Extension contract: ${version}. After every \`microteia unpack\`, run \`npm install\` here so
\`@microteia/sdk\` matches the platform version you just took.
`;
