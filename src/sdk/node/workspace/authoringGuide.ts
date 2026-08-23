import { UI_EXTENSION_POINTS } from '../../../domain/schema/ui/uiExtensionPoints';
import { DATA_EXTENSION_POINTS } from '../../../domain/schema/dataExtensionPoints';
import { I18N_EXTENSION_POINTS } from '../../../domain/schema/i18n/extensionPoints';
import { THEME_EXTENSION_POINTS } from '../../../domain/schema/theme/extensionPoints';
import { ACCESS_EXTENSION_POINTS } from '../../../domain/schema/access';
import type { ExtensionPointDefinition } from '../../../domain/schema/plugin/extensionPoint';

/**
 * `AUTHORING.md` — o manual de quem escreve extensão, e o contraponto do `ARCHITECTURE.md`: aquele
 * explica o kernel a quem o altera, este explica o CONTRATO a quem nunca vai vê-lo.
 *
 * Em inglês, e não por preferência: é superfície de produto, entregue a escritórios em qualquer lugar.
 * A regra de idioma do repositório é exatamente essa — o produto fala inglês porque tem de poder falar
 * qualquer idioma; o português é a nossa comunicação interna.
 *
 * Mora no SDK, e não no Console, porque é aqui que estão os pontos de extensão que ele descreve: a
 * tabela da §4 sai dos MESMOS arrays que o kernel valida contra, e não de uma cópia deles. Enquanto
 * morava no Console, o texto podia falar de um contrato e a instalação ter outro — as duas ferramentas
 * são versionadas e distribuídas em separado.
 */

const ALL_POINTS: ExtensionPointDefinition[] = [
  ...UI_EXTENSION_POINTS,
  ...DATA_EXTENSION_POINTS,
  ...I18N_EXTENSION_POINTS,
  ...THEME_EXTENSION_POINTS,
  ...ACCESS_EXTENSION_POINTS,
];

const kib = (bytes: number): string => `${Math.round(bytes / 1024)} KiB`;

const pointsTable = (points: ExtensionPointDefinition[]): string => [
  '| Point | API | Accepts | Many? |',
  '|---|---|---|---|',
  ...points.map((point) => `| \`${point.id}\` | ${point.apiVersion} | ${
    point.allowedImplKinds.length === 0 ? '_declaration only_' : point.allowedImplKinds.map((kind) => `\`${kind}\``).join(', ')
  } | ${point.multiple ? 'yes' : 'no'} |`),
].join('\n');

export interface AuthoringGuideInput {
  kernelVersion: string;
  hostModules: string[];
  advisoryBytes: number;
  maxBytes: number;
}

export const authoringGuide = (input: AuthoringGuideInput): string => `# Authoring Microteia extensions

Kernel contract **${input.kernelVersion}**. Everything here describes the platform installed next to this
directory, not a general idea of it.

## 1. What an extension is

A declaration. A single JSON document that says *what should exist* — screens, automations, actions,
scripts, pages, translations, a theme — which the platform reads and installs. The platform has no
knowledge of your extension: it only knows the points you contribute to.

Two consequences you should take seriously:

- **You never modify the platform.** There is no patch, no hook into internals, no override. If
  something seems to require changing the kernel, you are looking at the wrong extension point.
- **Uninstalling has to be clean.** Anything your extension declares can be withdrawn. That is why
  option lists travel as *declarations* and not as data: the options belong to the organization, and
  removing your extension must not delete them.

## 2. The loop

    npx microteia-plugin new com.example.hello    # scaffold
    npx tsc --noEmit                              # types
    npx microteia-plugin check hello/plugin.ts    # the gate
    npx microteia-plugin build hello/plugin.ts    # writes the .json

\`check\` is not an approximation of the platform's validation — it *is* the platform's validation, the
same function, the same messages. If \`check\` passes, the package installs.

Then import the \`.json\` on the **Extensions** screen.

## 3. The package

\`\`\`ts
import type { AuthoredPlugin } from '@microteia/sdk';

export default {
  manifest: { id, version, kernel, name, publisher, contributes, /* dependencies, backend, ... */ },
  summary: 'One line, shown in the Extensions list.',
  workflows: [],       // required, may be empty
  screens: [],         // entities, with their fields
  screenPatches: [],   // fields added to a screen that already exists
  lookups: [], tagLists: [],
  actions: [], scripts: [],
  views: [],           // pages delivered as code
  startup: '',         // code that runs once when the extension loads
  migrations: [],      // converting data an earlier version of YOURS wrote
  overview: {},        // a rich description, in Widget DSL
} satisfies AuthoredPlugin;
\`\`\`

Every field except \`manifest\`, \`summary\` and \`workflows\` is optional, and a package may be any
subset — a single automation is a legitimate extension.

**Two types, one letter apart, and it matters.** \`AuthoredPlugin\` is what you write — it lets a view
point at a file with \`sourceFile\`. \`MarketplacePlugin\` is what the platform installs, where every
view carries its \`source\` inline. The compiler turns the first into the second. Write against
\`AuthoredPlugin\`; reach for \`MarketplacePlugin\` only when you are reading a built \`.json\` back.

### Identity and versions

\`manifest.id\` is reverse-DNS and permanent: it is how an update recognises the thing it updates. Use
a domain you control. \`manifest.version\` is semver. \`manifest.kernel\` is the range of platform
contracts you work against — \`^${input.kernelVersion}\` for what is installed here.

Every change to an extension raises \`manifest.version\`, and records itself as one entry at the top of
that extension's \`VERSIONS.md\` — the file \`create\` generates next to \`plugin.ts\`. The entry is
written for whoever *uses* the extension: what they will notice, in one plain sentence, never the file
or the field you touched. An extension changed without a new version is an extension that never reaches
the organizations that already have it: the version is the whole of how an update is recognised.

### References between your own artifacts

Inside the package, artifacts point at each other by \`templateId\` (automations, actions, scripts) or
\`key\` (screens), never by real id — the real ids are generated at install time and differ per
organization. \`check\` refuses a reference that leads nowhere.

To point at something *another* extension installs, declare it:

\`\`\`ts
dependencies: { 'com.example.projects': { version: '^2.0.0', collections: ['projects'] } }
\`\`\`

## 4. Extension points

${pointsTable(ALL_POINTS)}

The \`Accepts\` column is the important one. Four kinds of implementation exist:

| Kind | What it is | Who may use it |
|---|---|---|
| \`widget\` | a declarative tree the platform renders (Widget DSL) | anyone |
| \`workflow\` | one of the automations in your package | anyone |
| \`script\` | code in the server-side sandbox | anyone |
| \`code\` | a React component, delivered as source | anyone — **but see §6** |

Prefer \`widget\` when it is enough. A declarative page needs no review, cannot break, and survives
platform upgrades without you touching it.

## 5. Text — the rule that has no exception

Every label a person reads is a **reference**, resolved at render:

\`\`\`ts
const label = (key: string) => \\\`@com.example.hello/\\\${key}\\\`;

fields: [{ key: 'title', label: label('field.title'), type: 'text', order: 0 }]
\`\`\`

and the words themselves are a contribution:

\`\`\`ts
import { messageBundleContribution } from '@microteia/sdk';

contributes: [
  messageBundleContribution({ locale: 'en', namespace: 'com.example.hello', messages: EN }),
  messageBundleContribution({ locale: 'pt-BR', namespace: 'com.example.hello', messages: PT_BR }),
]
\`\`\`

Ship \`en\` always — it is the source language, and what someone sees when no translation for their
locale is installed. **The platform does not translate your vocabulary.** "Document type" is the
platform's concept; *Power of attorney* and *Petition* are yours, and only you can answer for them.

A key with no translation renders as the key itself. Ugly, diagnosable, and never a blank screen.

What the organization *typed* — a screen they named, a list option they added — is their data. It
passes through untranslated, always.

## 6. Code trust - why a human has to say yes

A \`view\` travels as **source**. The browser compiles it and evaluates it against a fixed allowlist of
modules:

${input.hostModules.map((name) => `- \`${name}\``).join('\n')}

Any other import throws. This is an import allowlist, not a sandbox: the code runs in the page, so it
can reach \`fetch\` and the DOM like any script. The real containment is **provenance**.

So: a package carrying \`views\` or \`startup\` installs **inert**. An administrator of the organization
opens the source, reads it, and trusts it. The trust is bound to that exact code by content hash —
change one character and it must be trusted again. Nothing you can put in the package changes this,
and you should not design as though it might.

Author views as real files:

\`\`\`ts
views: [{ key: 'summary', title: label('page.summary'), icon: 'chart', sourceFile: './views/Summary.view.tsx' }]
\`\`\`

\`sourceFile\` is an authoring field: the compiler replaces it with the file's contents. Keeping the
code in a real \`.tsx\` is what lets \`tsc\` and your editor check the part of the extension most likely
to be wrong.

A view does not have to be one file. \`sourceFile\` also takes a list, merged in the order given:

\`\`\`ts
views: [{
  key: 'summary',
  title: label('page.summary'),
  icon: 'chart',
  sourceFile: ['./views/Summary.view.tsx', './views/Summary.viewmodel.tsx', './views/Summary.styles.tsx'],
}]
\`\`\`

The package still carries one source per view — the runtime evaluates one module per view, and its
\`require\` resolves nothing but the curated API. The list is an authoring convenience, and it changes
three things you have to know:

- **Import across the listed files normally.** The relative import is what makes \`tsc\` and your editor
  connect them; the compiler erases it, because after the merge the names are already in scope. A
  relative import pointing outside the list is refused at build time — the runtime could never resolve it.
- **The merged module has one scope.** A top-level name declared in two of the files collides, and the
  build says which name and which files. Importing the same thing from the same module in several files
  is not a collision: those imports fold into one.
- **Exactly one of the files exports \`default\`** — it is the view's component.

\`startupFile\` takes a list for the same reason, and so do \`source\` and \`startup\` when the code
reaches the package as text rather than as a path (a \`?raw\` import). There the merge cannot check a
path, so it checks names: every name a relative import brings has to be declared by one of the merged
sources, which is what catches merging the view and forgetting its view model.

\`startup\` receives a \`host\` and may return a teardown function:

\`\`\`ts
export default function startup(host: ExtensionHost) {
  host.commands.register({ /* ... */ });
  return () => { /* undone when the extension is disabled */ };
}
\`\`\`

## 7. Data your extension owns

A \`screen\` declares an entity: a collection, its fields, its title. The platform draws the list, the
detail, the form, the filters and the search. You write no UI for any of it.

- **Fields the organization adds** to your screen are theirs. An update of your extension preserves them.
- **Option lists** (\`lookups\`) travel as a declaration plus optional *seed* options. Seeds are written
  only when the collection is empty; after that the options are the organization's, and neither an
  update nor uninstalling touches them.
- **\`screenPatches\`** add fields to a screen that already exists — someone else's, or the platform's.
  They are added, never substituted, and uninstalling removes only yours.

### Changing the shape of data you already wrote

That needs a \`migration\`: code that runs once per organization, in the server sandbox, converting
what an earlier version of *your* extension wrote. Never hard-code a collection name — read it from
\`input.collections\`, because the name can differ. Write it to be safely re-runnable: it may resume.

## 8. Access — declare capabilities, never roles

Your extension declares what people can *do*; the organization decides *who* does it. You never see
a role, and that is the point: the profiles of the organization that installs you are theirs to
invent, and your code keeps working when they invent another one.

Every screen collection you install gets four permissions for free:
\`<collection>.read\`, \`.create\`, \`.update\`, \`.delete\` — and the three writing ones already depend on
\`read\`. Declare a permission only for a capability that is not one of those, or to add a dependency:

\`\`\`ts
import { accessPermission } from '@microteia/sdk';

contributes: [
  accessPermission({
    id: 'invoices.approve',
    name: label('perm.approve'),
    description: label('perm.approve.description'),
    requires: ['invoices.update', 'people.read'],
  }),
]
\`\`\`

\`requires\` is the whole trick. When an administrator ticks *Approve*, the platform resolves the
closure and grants what it needs — they never learn the dependency exists. Change the list in a later
version and every profile follows, because a profile stores only what was ticked.

**Asking.** In a screen you wrote, \`useCan()\` from \`@microteia/data\`:

\`\`\`tsx
const can = useCan();
{can('invoices.approve') && <Button onClick={approve}>{t('approve')}</Button>}
\`\`\`

In anything declarative — an action's *Hide when*, a field's *Disable when*, a step condition, a
script — the expression function:

| Pattern | Matches |
|---|---|
| \`hasPermission("invoices.approve")\` | that exact permission |
| \`hasPermission("<entity>.delete")\` | the delete of the screen the expression is being evaluated in |
| \`hasPermission("*.delete")\` | the delete of any resource |
| \`hasPermission("invoices.*")\` | any action on \`invoices\` |
| \`hasPermission("invoice%.read")\` | the read of every resource starting with \`invoice\` |

Prefer \`<entity>\`: it is what lets one action serve every screen instead of naming one.

**What the answer is for.** Drawing. Show the button to whoever can press it. What actually blocks a
write is the server rule, and it is not negotiable from your side — an extension that decided access
by this answer would be deciding in the wrong place.

## 9. When your extension needs the server

\`manifest.backend\` declares what the organization's Firebase project must provide — Cloud Functions,
composite indexes, configuration parameters, manual prerequisites. The extension stays **pending**,
and does not load, until an administrator runs \`microteia provision\`. Failing closed is deliberate: a
menu whose backend is missing produces the most expensive kind of defect, where the app opens and
every call fails looking like something else entirely.

### You can write those functions yourself

Put them in \`<folder>/functions/\`, read through its \`index.ts\`, and name each one in
\`manifest.backend.functions\`. Then they behave exactly like the platform's own: deployed only where
the extension is installed, removed by \`microteia provision --prune\` when nothing needs them.

    npx microteia-plugin create function --plugin <folder>

| What it needs | Where you declare it |
|---|---|
| an npm package the platform does not carry | \`dependencies\` in \`<folder>/functions/package.json\` |
| a credential or setting | \`defineString('NAME')\`, and \`'NAME'\` in \`manifest.backend.parameters\` |
| something a person must do by hand first | \`manifest.backend.prerequisites\` |

Two rules follow from how a Firebase project works, and both are refusals rather than warnings:

- **A \`defineString\` with no value refuses the deploy of *every* function in the project**, not just
  yours — \`firebase-functions\` validates parameters globally. The Console lists every one it finds in
  \`.env.<projectId>\`, empty, so filling it in is the only step left.
- **One installation, one \`node_modules\`.** Two extensions asking for different ranges of the same
  package is refused, because nothing decides between them. A range the platform already pins is kept:
  the runtime is the platform's choice, and one extension may not move it for the others.

A function shared by several extensions goes in \`../functions/\` instead, next to \`microteia.yaml\`.
Nobody owns it, so nothing can claim it, and it is deployed with every \`microteia deploy\`.

## 10. Size

| | |
|---|---|
| Warning | ${kib(input.advisoryBytes)} |
| Refused | ${kib(input.maxBytes)} |

A package is stored as a single document. If you are near the limit, the usual cause is code that
should be several extensions, or a seed list that should be data.

## 11. Testing

\`validatePluginPackage\` is exported from \`@microteia/sdk\` — the same function \`check\` calls. Keeping
it in a test means a broken package fails in a second, on your machine:

\`\`\`ts
import { validatePluginPackage } from '@microteia/sdk';
import plugin from './plugin';

it('installs cleanly', () => { expect(validatePluginPackage(plugin)).toEqual([]); });
\`\`\`

Read \`examples/\` for first-party extensions that exercise every mechanism described above.
`;
