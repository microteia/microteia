import { UI_EXTENSION_POINTS } from '../../../domain/schema/ui/uiExtensionPoints';
import { DATA_EXTENSION_POINTS } from '../../../domain/schema/dataExtensionPoints';
import { I18N_EXTENSION_POINTS } from '../../../domain/schema/i18n/extensionPoints';
import { THEME_EXTENSION_POINTS } from '../../../domain/schema/theme/extensionPoints';
import { ACCESS_EXTENSION_POINTS } from '../../../domain/schema/access';
import type { ExtensionPointDefinition } from '../../../domain/schema/plugin/extensionPoint';
import { CUSTOM_FIELD_TYPES } from '../../../domain/schema/fieldRules';
import type { CustomFieldType } from '../../../domain/schema/fieldRules';
import { WIDGET_NODE_TYPES } from '../../../domain/schema/ui/widgetSpec';
import type { WidgetNodeType } from '../../../domain/schema/ui/widgetSpec';
import { STEP_TYPES } from '../../../domain/entities/Workflow';
import type { StepType } from '../../../domain/entities/Workflow';
import { FIELD_EXPRESSION_FUNCTION_NAMES } from '../../../domain/schema/fieldExpression';

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
 *
 * O que ele ENSINA é o vocabulário declarativo, e é essa a razão das tabelas abaixo serem `Record`
 * fechados por tipo em vez de prosa: o `.d.ts` que viaja no SDK é emitido com `removeComments`, então
 * quem escreve extensão vê a FORMA de `TemplateField` e de `WidgetSpec` sem uma linha explicando o
 * que cada propriedade quer dizer. Este arquivo é a única documentação daquele vocabulário que chega
 * ao escritório — e um `Record<CustomFieldType, …>` reprova na compilação no dia em que o kernel
 * ganha um tipo de campo novo, que é o que impede o manual de envelhecer em silêncio.
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

/**
 * O que cada tipo de campo é, e o que ele exige junto. Fechado por `CustomFieldType`: um tipo novo no
 * kernel não compila até ganhar a linha dele aqui.
 */
const FIELD_TYPES: Record<CustomFieldType, string> = {
  text: 'One line of text.',
  textarea: 'Several lines of plain text.',
  number: 'A number. `rules.validate` can bound it.',
  currency: 'A number shown and typed as money, in the locale of whoever is looking.',
  date: 'A day, stored as `YYYY-MM-DD` — never a timestamp, so the day that goes in is the day that comes out.',
  time: 'A time of day, stored as `HH:mm`.',
  checkbox: 'True or false.',
  select: 'One option — or several with `multi: true`. The options come from `options` (yours, fixed) or from `lookupCollection` (a list the organization owns and edits).',
  masked: 'Text shaped by a named PRESET: `mask` carries the preset\'s key, never a template. '
    + 'Declare your own with `fieldRulePresetContribution` — its `templates` use `#` for a digit, `A` for '
    + 'a letter, `*` for either, and anything else literally (`###.###.###-##`); several templates in one '
    + 'preset alternate by length.',
  reference: 'Points at a record of another screen. `refEntity` is the target — a `key` of a screen in your own package, or a collection that already exists.',
  markdown: 'Rich text, written and rendered as Markdown.',
  file: 'One upload. The value stored is the download URL, so the field stays scalar; `file` restricts extension and size.',
};

/** O que cada nó do Widget DSL desenha, e com que propriedades. Fechado por `WidgetNodeType`. */
const WIDGET_NODES: Record<WidgetNodeType, string> = {
  stack: 'A vertical stack. `gap?: \'sm\' \\| \'md\' \\| \'lg\'`, `children`.',
  grid: 'A responsive grid. `columns?: number`, `children`.',
  heading: 'A section title. `text`.',
  text: 'A paragraph. `text`, `muted?: boolean`.',
  markdown: 'A block of Markdown. `content`.',
  metric: 'A big number with a caption. `label`, `value`.',
  keyValue: 'A list of label/value rows. `items: { label, value }[]`.',
  banner: 'A notice. `message`, `variant?: \'info\' \\| \'warning\'`.',
  divider: 'A rule between blocks. No properties.',
};

/** O que cada tipo de passo faz. Fechado por `StepType`. */
const STEP_KINDS: Record<StepType, string> = {
  Action: 'Runs one entry of the platform\'s step catalog, named by `stepDefinitionId`. Its inputs are `configuration`.',
  Condition: 'A control node: `condition` decides which of `branches.whenTrue` / `branches.whenFalse` runs, and the flow converges after. `stepDefinitionId` is empty.',
  Delay: 'Waits before the steps that follow.',
  Loop: 'A control node: `loop: { source, itemName, outputName, body }` runs `body` once per item and publishes the collected outputs under `outputName`. `stepDefinitionId` is empty.',
  Script: 'Runs one of your `scripts`, named by `configuration.scriptId` as a `Literal` — the `templateId`, which `check` resolves.',
  SubWorkflow: 'Calls another workflow, named by `configuration.targetWorkflowId` as a `Literal` — again a `templateId`.',
};

const describedTable = (header: string, entries: readonly string[], described: Record<string, string>): string => [
  `| ${header} | |`,
  '|---|---|',
  ...entries.map((entry) => `| \`${entry}\` | ${described[entry]} |`),
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

The types travel with the SDK, but they travel *stripped of their comments*: \`tsc\` will tell you that
\`TemplateField\` has an \`autoValue\`, and only this document will tell you what one is for. So the shape
comes from your editor, the meaning comes from here, and the exact declaration of anything named below
comes from the MCP server — \`describe_sdk_type\` for the declarative side, \`describe_host_module\` for
what a view may import.

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

### Reach for the least powerful thing that works

The order is not a style preference — each rung costs strictly more than the one above it, forever:

| Rung | What it costs |
|---|---|
| A **screen**, its fields, its rules and its expressions | nothing. The platform draws the list, the detail, the form, the filters, the search |
| A **Widget DSL** page, tab or widget | nothing. It cannot break, needs no review, and survives platform upgrades untouched |
| A **workflow**, **action** or **script** | runs in the platform's own engine and sandbox; no review, but now there is logic to keep right |
| A **view** or **startup** — real React | an administrator must read the source and trust it, again on every change (§7), and you own that code across upgrades |
| A **Cloud Function** — \`manifest.backend\` | the extension stays inert until someone provisions the organization's Firebase project (§12) |

Most of what looks like it needs the fourth rung needs the first. A field that computes itself, a
button that hides for the wrong person, a list filtered by who is looking — all of those are
declarations.

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
| \`widget\` | a declarative tree the platform renders (Widget DSL, §6) | anyone |
| \`workflow\` | one of the automations in your package | anyone |
| \`script\` | code in the server-side sandbox | anyone |
| \`code\` | a React component, delivered as source | anyone — **but see §7** |

Prefer \`widget\` when it is enough. A declarative page needs no review, cannot break, and survives
platform upgrades without you touching it.

### How you contribute to one

A contribution is one entry of \`manifest.contributes\`. Use the constructor for the point instead of
assembling the object: it stamps the API version and derives a **stable id** from your key, and that
id is the whole of how an update recognises the same contribution across versions.

| Constructor | Point | What it delivers |
|---|---|---|
| \`nav(metadata)\` | \`ui.nav\` | a menu entry — \`key\`, \`label\`, \`icon\`, \`order\`, optional \`badge\` |
| \`page(metadata, viewKey)\` | \`ui.page\` | a workspace screen drawn by one of your \`views\` (§7) |
| \`widgetPage(metadata, spec)\` | \`ui.page\` | a workspace screen declared in Widget DSL — no code, no review |
| \`surfaceTab(metadata, viewKey)\` · \`surfaceTabSpec(metadata, spec)\` | \`ui.tab\` | a tab on a surface, as code or as Widget DSL |
| \`surfaceWidget(metadata, viewKey)\` · \`surfaceWidgetSpec(metadata, spec)\` | \`ui.widget\` | a widget on a surface, as code or as Widget DSL |
| \`recordAction(metadata, viewKey)\` | \`ui.record.action\` | a gesture over one record, next to the platform's own |
| \`command(id, metadata, viewKey)\` | \`ui.command\` | an entry in the command palette |
| \`settingsSection(section)\` | \`ui.settings\` | a section of the Settings screen — the properties *are* the contribution |
| \`messageBundleContribution({ locale, namespace, messages })\` | \`i18n.messages\` | the words, one bundle per locale (§5) |
| \`themeTokensContribution(spec)\` | \`theme.tokens\` | colour and typography tokens |
| \`accessPermissionContribution\` · \`accessRequirementContribution\` · \`accessResourceContribution\` | \`access.*\` | what people can do (§11) |
| \`lookupProviderContribution\` · \`fieldRulePresetContribution\` | \`data.*\` | an external source of options; a reusable field rule |
| \`pointContribution(point, id, metadata, apiVersion)\` | any | a point published by *another* extension, which cannot have a constructor here |

Two fields every contribution accepts, and both are easy to miss:

- **\`when\`** — an expression. The contribution exists only while it is true.
- **\`priority\`** — who wins when several contributions land on the same single-valued point.

Metadata for a screen, a tab or a widget also takes **\`requiredPermissions\`**: a list, and **one** of
them is enough. Absent, the contribution shows for every member. This is what keeps a menu entry from
leading someone to a screen they cannot read.

## 5. Text — the rule that has no exception

Every label a person reads is a **reference**, resolved at render:

\`\`\`ts
const label = (key: string) => \`@com.example.hello/\${key}\`;

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

Everything declarative takes a reference: a field's \`label\` and \`placeholder\`, a lookup's \`label\`, a
screen's \`titleSingular\` and \`titlePlural\`, a nav entry's \`label\`, an action's \`title\` and
\`confirmMessage\`, a migration's \`name\`, \`summary\`, and every string in an \`overview\`. Inside a *view*
the equivalent is \`useT\` from \`@microteia/i18n\`, reading the same bundles.

## 6. Widget DSL — interface with no code

A tree of nodes the platform renders with its own components. It carries no JavaScript, so nothing
about it needs reviewing, nothing about it can break the page, and it keeps working across platform
upgrades without you republishing anything.

It is used in four places: \`overview\` (the extension's own description in the Extensions screen),
\`widgetPage\`, \`surfaceTabSpec\` and \`surfaceWidgetSpec\`.

${describedTable('Node', WIDGET_NODE_TYPES, WIDGET_NODES)}

\`\`\`ts
widgetPage({ key: 'hello', title: label('page.hello'), icon: 'star' }, {
  type: 'stack',
  gap: 'lg',
  children: [
    { type: 'heading', text: label('page.hello') },
    { type: 'markdown', content: label('page.hello.body') },
    { type: 'keyValue', items: [{ label: label('kv.owner'), value: label('kv.owner.value') }] },
    { type: 'banner', message: label('page.hello.note'), variant: 'info' },
  ],
})
\`\`\`

Every string in a spec is a message reference, exactly as everywhere else. The DSL is **static**: it
has no data binding and no expressions. When a page has to show live records, that is either a screen
(§8) or a view (§7) — do not try to reach data from here.

## 7. Code trust - why a human has to say yes

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

### A view is not a page until something points at it

\`views\` is a registry, not a menu. The entry sits there, keyed, until a contribution names that key:

\`\`\`ts
contributes: [
  nav({ key: 'summary', label: label('nav.summary'), icon: 'chart', order: 50 }),
  page({ key: 'summary', title: label('page.summary'), icon: 'chart' }, 'summary'),
  //     ^ the workspace tab                                            ^ views[].key
]
\`\`\`

\`nav\` puts it in the menu; \`page\` is what actually resolves the view. Declaring the view and
forgetting the \`page\` is the most common mistake there is, and nothing fails — the extension installs
and the screen simply is not there.

Two things follow from the same wiring:

- **A page opened per record** uses \`keyPrefix\` instead of \`key\`: \`page({ key: '', keyPrefix:
  'invoice-read:', title, icon }, 'invoice-read')\` matches every tab whose key starts with that
  prefix, and a screen's \`recordTabPrefix\` is what sends a record there instead of to the form.
- **\`nav().badge\`** counts records without any code: \`badge: { collection: 'invoices', when: 'status
  == "open"' }\`. The expression sees each record's fields plus \`user\` (§9), which is what lets a badge
  count what *this* person has not dealt with.

### Several files, one module

\`sourceFile\` also takes a list, merged in the order given:

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

It is how an extension gets into the command palette and into mentions — the things that have to
exist before anyone opens its screen. Ask \`describe_host_module\` for what \`host\` offers; do not guess.

## 8. Screens — the data your extension owns

A \`screen\` declares an entity: a collection, its fields, its title. The platform draws the list, the
detail, the form, the filters and the search. You write no UI for any of it.

\`\`\`ts
screens: [{
  key: 'invoices',                       // referenced by other artifacts in THIS package
  sourceId: 'com.example.billing:invoice',   // universal identity — how an update recognises it
  titleSingular: label('screen.singular'),
  titlePlural: label('screen.plural'),
  icon: 'receipt',
  titleFieldKey: 'number',
  subtitleFieldKey: 'client',
  fields: FIELDS,
  hasNotes: true, hasDocuments: true, hasTags: true, tagCollection: 'invoiceTags',
  listActions: ['copyLink', 'manageTags', 'delete'],
  sidebarOrder: 60,
}]
\`\`\`

\`key\` is what your own artifacts use. \`sourceId\` is what *updates* use: it is universal, so the same
screen arriving from a new version — or from a second extension — is recognised instead of duplicated.
Declare it, and never change it.

### Fields

${describedTable('Type', CUSTOM_FIELD_TYPES, FIELD_TYPES)}

Beyond \`key\`, \`label\`, \`type\`, \`order\` and \`required\`, the properties that decide how a field behaves:

| | |
|---|---|
| \`section\` | groups fields under a heading in the form. A reference, like every label |
| \`placeholder\`, \`mask\` | what the empty field says; what it accepts |
| \`options\`, \`optionsAllowUserAdd\`, \`optionsColored\`, \`multi\` | a \`select\`'s choices — fixed by you, or extendable by the organization |
| \`lookupCollection\` | the \`select\` reads a list the organization owns. Declare the list in \`lookups\` |
| \`refEntity\`, \`refDenormKey\` | a \`reference\`'s target, and the name expressions navigate it by |
| \`defaultValue\` | what a new record is born with. Seeds only — the person can still change it |
| \`autoValue: { pattern }\` | a generated code: \`A\` letter, \`0\` digit, \`*\` either, anything else literal (\`AA-0000\`). Unique among the records already loaded, and still editable |
| \`logic\` | the expressions: \`compute\`, \`validate\`, \`hiddenWhen\`, \`disabledWhen\`, \`onChange\` (§9) |
| \`aggregation: { from, via, op, field?, filter? }\` | the value is a sum/count/avg/min/max over CHILD records. Declared, not inferred, so the engine knows exactly when to recompute |
| \`rules\` | \`validate\` and \`format\` presets — bounds, required-if, formatting |
| \`showInList\`, \`listLabel\`, \`listIcon\`, \`listOrder\` | whether and how the field appears on the list card |
| \`filterable\` | the field becomes a filter on the list |
| \`hiddenInForm\` | keeps a field out of the form without deleting it |
| \`file: { extensions, maxBytes }\` | what a \`file\` field accepts |

**Fields the organization adds** to your screen are theirs. An update of your extension preserves
them, and uninstalling removes only yours.

### Relationships, and where a screen shows up

| | |
|---|---|
| \`parentEntity\`, \`parentFieldKey\` | this screen is a CHILD: which screen, and the \`reference\` field that points at it |
| \`parentRelation: 'owned' \\| 'related'\` | \`owned\` — it exists because of the parent, and deleting the parent deletes it. \`related\` — it merely points at the parent, and the gesture that fits is unlinking |
| \`hideFromParentTabs\` | the child does not become a tab of the parent |
| \`hideFromSidebar\`, \`sidebarOrder\` | whether a top-level screen gets its own menu entry, and where. Hide it when you declare the entry yourself with \`nav()\` — that is how a menu entry gets a badge |
| \`recordTabPrefix\` | opening a record from outside (audit log, a mention, the command palette) lands on YOUR view instead of the form (§7) |
| \`dataCollection\` | install the screen over a collection that already exists, instead of creating one. \`fields\` is still the complete schema of it |
| \`eventPrefix\` | the prefix of the events this collection emits, which is what workflows subscribe to (§10) |
| \`listActions\`, \`viewActionIds\`, \`cardActionIds\` | the platform's own record gestures by key; your \`actions\` by \`templateId\` |
| \`memberWritableFields\` | fields ANY member may write on a record someone else created — the door for per-person state (read, liked, saved) that the default permission would close |
| \`authorCanDelete\` | whoever created the record deletes it, without an administrator |
| \`auditActions\` | which actions are audited. Absent = all. Declare it when a machine writes the collection, or the audit log drowns in one entry per ingested document |

### Option lists

\`lookups\` declare a list the organization owns, with optional *seed* options:

\`\`\`ts
lookups: [{ collection: 'invoiceStatuses', label: label('lookup.statuses'), options: [
  { key: 'OPEN', label: label('status.open') },
  { key: 'PAID', label: label('status.paid') },
] }]
\`\`\`

Seeds are written **only when the collection is empty**. After that the options are the
organization's: neither an update nor uninstalling touches them. Keep the option \`key\` stable in
English — it is what every record already stores. \`tagLists\` works the same way for tag collections.

### Adding to somebody else's screen

\`screenPatches\` add fields to a screen that already exists — another extension's, or the platform's:

\`\`\`ts
screenPatches: [{ target: 'persons', targetKind: 'collection', fields: EXTRA_FIELDS }]
\`\`\`

\`targetKind: 'collection'\` names a collection directly, which works because that name is universal.
\`targetKind: 'sourceId'\` names another extension's screen by its \`sourceId\`, which is the only stable
handle you have — the installed key differs per organization. The structure of the screen, its owner
and its configuration are untouched; you own only the fields you added, and uninstalling removes only
those. \`cardActionIds\` and \`viewActionIds\` let you hang your own actions on it; they are **added** to
what the organization configured, never substituted.

### Changing the shape of data you already wrote

That needs a \`migration\`: code that runs once per organization, in the server sandbox (§10),
converting what an earlier version of *your* extension wrote.

\`\`\`ts
migrations: [{
  id: 'fill-invoice-number',       // permanent identity — this, not the version, is what is recorded as applied
  version: '1.2.0',
  name: label('migration.fill-number'),
  sourceTs: MIGRATION_SOURCE,      // TypeScript with no import/export/require
  phase: 'after',                  // 'before' only when the old field must still exist
  runOnInstall: false,
  required: true,
}]
\`\`\`

Never hard-code a collection name — read it from \`input.collections\`, because the name can differ per
organization. Write it to be safely re-runnable: it may resume. \`phase: 'before'\` exists for the one
case that cannot work otherwise — copying an old field to a new one has to happen while both still
exist, because after the package converges the old one is no longer writable.

## 9. Expressions — the small language that shows up everywhere

One language, evaluated everywhere a declaration needs a decision. It is an expression, not a script:
no statements, no assignment, no side effects.

| Where | What it decides |
|---|---|
| \`field.logic.compute\` | the field's value, derived from the record |
| \`field.logic.validate\` | whether the value is acceptable |
| \`field.logic.hiddenWhen\`, \`disabledWhen\` | whether the field is shown, and whether it can be edited |
| \`field.logic.onChange\` | an object merged into the form when this field changes — seeds values the person can still edit |
| \`field.aggregation.filter\` | which child records enter the aggregate |
| \`action.hiddenWhen\`, \`disabledWhen\`, \`activeWhen\` | whether a button appears, is pressable, or reads as ON |
| \`nav().badge.when\` | which records the menu badge counts |
| \`contribution.when\` | whether the contribution exists at all |
| workflow \`condition\` of \`kind: 'Expression'\`, and any \`{ kind: 'Expression' }\` input mapping | whether the automation runs, and what a step receives |

**The scope is what changes between them, and it is the thing that trips people up:**

| Slot | What is in scope |
|---|---|
| \`compute\`, \`validate\` | the record's fields at the root, plus \`value\` (= \`self\`) — the field's own value. These two run on the client AND on the server, so they must not depend on anything else |
| \`hiddenWhen\`, \`disabledWhen\`, \`onChange\` of a field | the above, plus \`isNew\` and \`isDirty\`. Client only |
| an action's expressions | the form's current values at the root, plus \`record\` (as stored, \`{}\` when new), \`isNew\`, \`isDirty\`, \`permissions\`, \`surface\` (\`detail\` / \`list\` / \`parentTab\`), \`relation\` (\`none\` / \`owned\` / \`related\`), \`user\` |
| \`badge.when\` | each record's fields at the root, plus \`user\` |
| a workflow | \`event.*\` (the payload), the outputs of earlier steps, and the workflow's variables |

\`user\` is \`{ id, name, permissions }\`. A reserved name wins over a field of the same key — a field
called \`record\` is still reachable as \`record.record\`.

### Asking about permission

\`hasPermission("...")\` is the one function that answers about who is looking, and it takes patterns:

| Pattern | Matches |
|---|---|
| \`hasPermission("invoices.approve")\` | that exact permission |
| \`hasPermission("<entity>.delete")\` | the delete of the screen the expression is being evaluated in |
| \`hasPermission("*.delete")\` | the delete of any resource |
| \`hasPermission("invoices.*")\` | any action on \`invoices\` |
| \`hasPermission("invoice%.read")\` | the read of every resource starting with \`invoice\` |

Prefer \`<entity>\`: it is what lets one action serve every screen instead of naming one.

**What the answer is for: drawing.** Show the button to whoever can press it. What actually blocks a
write is the server rule, and it is not negotiable from your side — an extension that decided access
by this answer would be deciding in the wrong place.

### The functions

Operators are the usual ones — \`+ - * / % ^\`, \`== != > >= < <=\`, \`and or not\`, \`? :\`, \`in\`, and \`!\` is
logical negation. On top of them:

| Group | |
|---|---|
| Logic | \`if(cond, a, b)\`, \`coalesce(...)\`, \`isEmpty(v)\`, \`isNull(v)\`, \`isNotNull(v)\` |
| Text | \`concat(...)\`, \`lower\`, \`upper\`, \`trim\`, \`length\`, \`contains(v, s)\`, \`startsWith\`, \`endsWith\`, \`indexOf\`, \`substring(v, start, end)\`, \`replace(v, s, r)\`, \`split(v, sep)\`, \`join(a, sep)\`, \`interpolate(template, ...)\` |
| Numbers | \`round(v, decimals)\`, \`sum(a)\`, \`avg(a)\`, \`min\`, \`max\`, \`abs\`, \`ceil\`, \`floor\`, \`sqrt\` |
| Dates | \`today()\`, \`now()\`, \`addDays(v, n)\`, \`formatDate(v, fmt)\`, \`dateDiff(a, b, unit)\`, \`dayOfWeek\`, \`isWeekend\`, \`year\`, \`month\`, \`day\` |
| Lists | \`first(a)\`, \`last(a)\`, \`map(a, path, compact)\`, \`contains(a, item)\`, \`length(a)\` |
| Brazil, and formatting | \`isCPF\`, \`isCNPJ\`, \`isEmail\`, \`onlyNumber\`, \`formatCPF\`, \`formatCNPJ\`, \`formatMoney(v, locale)\` |
| Objects | \`object(k, v, ...)\`, \`delete(key, target)\` |
| Access | \`hasPermission(pattern)\` |

The complete set the installed platform resolves, derived from it rather than from this table:

${FIELD_EXPRESSION_FUNCTION_NAMES.map((name) => `\`${name}\``).join(', ')}

## 10. Automation — workflows, actions and scripts

Three artifacts, and the distinction is what starts them:

| | Starts when | Runs |
|---|---|---|
| **workflow** | a record changes, a list changes, or another workflow calls it | on the server |
| **action** | a person presses a button on a record | fires a workflow, or a platform command |
| **script** | a workflow step runs it | in the server sandbox |

### Workflows

\`\`\`ts
workflows: [{
  templateId: 'wf-welcome',           // how actions and other workflows reference it
  name: label('workflow.welcome'),
  description: label('workflow.welcome.description'),
  eventName: 'invoices.saved',
  version: 1,
  condition: {
    kind: 'FieldComparison',
    fieldPath: 'event.payload.changeType',   // ABSOLUTE path, over the whole context
    operator: '==',
    value: 'created',
    valueType: 'literal',
  },
  steps: [{
    id: 'audit',
    stepDefinitionId: 'register-audit',
    type: 'Action',
    order: 0,
    enabled: true,
    configuration: {
      title: { kind: 'Literal', value: label('workflow.welcome.title') },
      message: { kind: 'Expression', expression: 'concat("Welcome, ", event.name, "!")' },
      entityId: { kind: 'Event', path: 'id' },     // path RELATIVE to event.payload
    },
  }],
}]
\`\`\`

**\`eventName\`** is \`<collection>.saved\` or \`<collection>.deleted\` — for your own screens, for a screen
the organization designed, for a collection that already exists. Also \`lookup.saved\` / \`lookup.deleted\`
(with \`lookupCollection\` naming which list), \`<parent>.note.saved\` / \`.deleted\`, the same for
\`document\`, and \`workflow.called\` for a workflow that only exists to be invoked — that one declares
\`parameters\`, which become the \`event.\` it receives.

**\`condition\`** is evaluated once, before any step: \`AlwaysTrue\`, \`FieldComparison\`, \`LogicalAnd\`,
\`LogicalOr\`, \`Not\`, or \`Expression\`.

**Every step input is an \`InputMapping\`**, and the five kinds are the whole of how data moves:

| | |
|---|---|
| \`{ kind: 'Literal', value }\` | a constant |
| \`{ kind: 'Event', path }\` | a path **inside \`event.payload\`** — relative |
| \`{ kind: 'Expression', expression }\` | an expression over the whole context (§9) — \`event.\` here is absolute |
| \`{ kind: 'Output', stepId, outputId }\` | what an earlier step produced |
| \`{ kind: 'Variable', name }\` | a workflow variable |

${describedTable('Step type', STEP_TYPES, STEP_KINDS)}

\`stepDefinitionId\` names an entry of the platform's **step catalog**, which lives on the server and
grows with the platform. It is the one part of a workflow you cannot enumerate from here: read it in
the Automations screen of a running installation, or build the workflow there once and export it.

### Actions

An action is a button on a record — on the list card, in the detail header, or inside a parent's tab.

\`\`\`ts
actions: [{
  templateId: 'act-approve',
  key: 'approve',
  title: label('action.approve'),
  icon: 'check',
  workflowId: 'wf-approve',                       // a templateId in THIS package
  hiddenWhen: 'not hasPermission("<entity>.update")',
  disabledWhen: 'status == "PAID"',
  confirmMessage: label('action.approve.confirm'),
}]
\`\`\`

\`command\` instead of \`workflowId\` runs one of the platform's own record gestures (\`copyLink\`, \`clone\`,
\`manageTags\`, \`delete\`, \`unlink\`, or anything contributed to \`ui.record.action\`) — present, it wins.
\`activeWhen\` turns the button into a switch that shows the record's current state.
\`promptParameters\` opens the workflow's parameter form before firing, and \`parameterDefaults\` maps
each parameter to an expression, for when the field name on screen is not the parameter name in the
flow. A screen offers the action by putting its \`templateId\` in \`cardActionIds\` or \`viewActionIds\`.

### Scripts

A script is TypeScript with **no \`import\`, \`export\` or \`require\`**, running in a QuickJS sandbox on
the server. The convention is a \`main\` that returns the outputs:

\`\`\`ts
async function main() {
  const open = await query({
    table: 'invoices',
    where: [{ path: 'status', op: '==', value: 'OPEN' }],
    orderBy: [{ path: 'dueDate', dir: 'asc' }],
    limit: 50,
    projections: ['id', 'total'],
  });
  await upsert({ table: 'invoices', id: open[0].id, data: { status: 'PAID' } });
  log('closed', open.length);
  return { closed: open.length };
}

main();
\`\`\`

In scope: \`input\` (the declared \`inputParams\`), \`query\`, \`upsert\`, \`remove\`, \`fn.*\` (the expression
functions of §9), \`log\` and \`console\`. Nothing else — no \`fetch\`, no \`require\`, no filesystem. The
budget per run is **25 queries, 25 mutations and 10 seconds**; a script that needs more than that is a
Cloud Function (§12), not a script.

**A script travels with both \`sourceTs\` and \`compiledJs\`,** and the compiler does not fill the second
in for you: the sandbox never transpiles, on purpose. Produce it with the same transpiler the platform
uses — \`sucrase\` is already a devDependency of this workspace:

\`\`\`ts
import { transpileScriptSource } from '@microteia/sdk/node';

const source = /* your script, from a \`?raw\` import or a real file */;
const compiled = transpileScriptSource(source);
if ('error' in compiled) throw new Error(compiled.error);

scripts: [{
  templateId: 'scr-close-invoices',
  name: label('script.close'),
  sourceTs: source,
  compiledJs: compiled.compiledJs,
  inputParams: [], outputParams: [{ key: 'closed', label: label('script.closed'), type: 'Number' }],
}]
\`\`\`

Declaring \`outputParams\` is what lets later steps read the result by name.

## 11. Access — declare capabilities, never roles

Your extension declares what people can *do*; the organization decides *who* does it. You never see
a role, and that is the point: the profiles of the organization that installs you are theirs to
invent, and your code keeps working when they invent another one.

Every screen collection you install gets four permissions for free:
\`<collection>.read\`, \`.create\`, \`.update\`, \`.delete\` — and the three writing ones already depend on
\`read\`. Declare a permission only for a capability that is not one of those, or to add a dependency:

\`\`\`ts
import { accessPermissionContribution } from '@microteia/sdk';

contributes: [
  accessPermissionContribution({
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

**Adding a dependency to someone else's permission.** Declaring a permission also names it, so only
one package may declare a given id — the second is refused. That leaves out the common case: you
\`screenPatch\` a screen another extension installed, and the field you added cannot be read without
reading the collection it points at. The permission you would have to change is not yours, and it was
probably never declared at all — a screen collection's four permissions are derived.

\`accessRequirementContribution\` is the additive form. It carries no name, replaces nothing, reaches a derived
permission, and several packages may add to the same id — the closure is the union:

\`\`\`ts
import { accessRequirementContribution } from '@microteia/sdk';

contributes: [
  // whoever can read the calendar can now read the case the patched field points at
  accessRequirementContribution({ id: 'calendar.read', requires: ['cases.read'] }),
]
\`\`\`

An addition that cannot be resolved — the target does not exist, the dependency does not exist, or it
would close a cycle — is **dropped**, with a diagnostic, and the permission goes on working as it did
before you were installed. That is deliberate: an addition only ever widens what is granted, so
dropping one can only narrow, and no extension can lock another one's screen by being installed.

**Asking.** In a screen you wrote, \`useCan()\` from \`@microteia/data\`:

\`\`\`tsx
const can = useCan();
{can('invoices.approve') && <Button onClick={approve}>{t('approve')}</Button>}
\`\`\`

In anything declarative, \`hasPermission(...)\` — the patterns are in §9.

## 12. When your extension needs the server

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
| a composite index your queries need | \`manifest.backend.indexes\` |

A view calls one through \`@microteia/functions\`; ask \`describe_host_module\` for the shape.

Two rules follow from how a Firebase project works, and both are refusals rather than warnings:

- **A \`defineString\` with no value refuses the deploy of *every* function in the project**, not just
  yours — \`firebase-functions\` validates parameters globally. The Console lists every one it finds in
  \`.env.<projectId>\`, empty, so filling it in is the only step left.
- **One installation, one \`node_modules\`.** Two extensions asking for different ranges of the same
  package is refused, because nothing decides between them. A range the platform already pins is kept:
  the runtime is the platform's choice, and one extension may not move it for the others.

A function shared by several extensions goes in \`../functions/\` instead, next to \`microteia.yaml\`.
Nobody owns it, so nothing can claim it, and it is deployed with every \`microteia deploy\`.

## 13. Size

| | |
|---|---|
| Warning | ${kib(input.advisoryBytes)} |
| Refused | ${kib(input.maxBytes)} |

A package is stored as a single document. If you are near the limit, the usual cause is code that
should be several extensions, or a seed list that should be data.

## 14. Testing, and asking the installation

\`validatePluginPackage\` is exported from \`@microteia/sdk\` — the same function \`check\` calls. Keeping
it in a test means a broken package fails in a second, on your machine:

\`\`\`ts
import { validatePluginPackage } from '@microteia/sdk';
import plugin from './plugin';

it('installs cleanly', () => { expect(validatePluginPackage(plugin)).toEqual([]); });
\`\`\`

It validates the BUILT package, so compile first when views use \`sourceFile\` — \`buildPlugin\` from
\`@microteia/sdk/node\` does exactly what \`build\` does.

The MCP server answers from **this installation** rather than from a snapshot of documentation, which
is why it is worth asking before writing:

| | |
|---|---|
| \`list_extension_points\` | every point, its API version, the impl kinds it accepts |
| \`describe_sdk_type\` | the exact declaration of any authoring type — \`TemplateField\`, \`WidgetSpec\`, \`WorkflowStep\`, \`PluginManifest\`, \`AuthoredPlugin\` |
| \`describe_host_module\` | what a curated module really exports, for a view or a \`startup\` |
| \`list_expression_functions\` | the expression functions the installed platform resolves |
| \`validate_plugin\` | the platform's verdict, after every edit |
| \`build_plugin\` | the \`.json\`, without writing it |
| \`read_authoring_guide\` | this document, by section |
| \`workspace_info\` | what this workspace is bound to |

Read \`examples/\` for first-party extensions in source form — they are the very source that produces
the \`.json\` the platform installs, so nothing in them is a simplification. What they cover well is
screens, fields, lookups, patches, views wired to pages, \`startup\`, translation and themes. What they
do not cover is automation: none of them carries a workflow, an action or a script, so for those this
document is what you have, plus \`describe_sdk_type\` for the exact shape.
`;
