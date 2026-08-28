import { UI_EXTENSION_POINTS, USER_MENU_SURFACE, WORKSPACE_SLOT_SURFACES } from '../../../domain/schema/ui/uiExtensionPoints';
import { DATA_EXTENSION_POINTS } from '../../../domain/schema/dataExtensionPoints';
import { I18N_EXTENSION_POINTS } from '../../../domain/schema/i18n/extensionPoints';
import { THEME_EXTENSION_POINTS } from '../../../domain/schema/theme/extensionPoints';
import { ACCESS_EXTENSION_POINTS } from '../../../domain/schema/access';
import { AUTH_EXTENSION_POINTS, AUTH_PROVIDER_KINDS } from '../../../domain/schema/auth';
import type { ExtensionPointDefinition } from '../../../domain/schema/plugin/extensionPoint';
import { CUSTOM_FIELD_TYPES } from '../../../domain/schema/fieldRules';
import type { CustomFieldType } from '../../../domain/schema/fieldRules';
import { WIDGET_NODE_TYPES } from '../../../domain/schema/ui/widgetSpec';
import type { WidgetNodeType } from '../../../domain/schema/ui/widgetSpec';
import { STEP_TYPES } from '../../../domain/entities/Workflow';
import type { WorkflowStepMetadata } from '../../../domain/schema/workflowStepCatalog';
import type { StepType } from '../../../domain/entities/Workflow';
import { FIELD_EXPRESSION_FUNCTION_NAMES } from '../../../domain/schema/fieldExpression';
import {
  A_STATE_IS_A_KEY,
  BEHAVIOR_MECHANISMS,
  DESCRIPTION_REQUIRED_BECAUSE,
  EMBEDDED_STRATEGY,
  RULE_LEDGER_FILE,
  SCREEN_IS_NOT_AN_ENTITY_MODEL,
  SCREEN_PLAN_HUMAN_DECISIONS,
  SCREEN_SOURCE_ID_PRECEDENCE,
  SCREEN_PLAN_RULES,
  STORAGE_MECHANISMS,
  coverageGaps,
  coverageSummary,
  detectorList,
  mechanismCoverage,
} from '../../domain';
import {
  INSTALLED_CATALOG_FILE,
  INSTALLED_CATALOG_OMITS,
  INSTALLED_CATALOG_STALE_DAYS,
} from '../installedCatalog';

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

/**
 * A tabela de armazenamento de relacionamento, DERIVADA de `STORAGE_MECHANISMS`. Um armazenamento novo
 * aparece aqui sozinho — e um que sumisse não deixaria uma linha de prosa afirmando que ele existe.
 */
const STORAGE_TABLE = STORAGE_MECHANISMS
  .map((one) => `| \`${one.storage}\` | ${one.cardinalities.join(', ')} | ${one.declaration} | ${one.storedAs} |`)
  .join('\n');

/**
 * A tabela de COMPORTAMENTO, derivada de `BEHAVIOR_MECHANISMS`. A coluna da recusa sai do próprio
 * `supported`: no dia em que o kernel ganhar um gatilho de relógio, a linha deixa de dizer que ele
 * não existe sem ninguém reescrever nada — que é o oposto de uma frase de documentação verdadeira
 * até alguém acrescentar o mecanismo.
 */
const BEHAVIOR_TABLE = BEHAVIOR_MECHANISMS
  .map((one) => `| \`${one.declares}\` | ${one.concern} | ${one.supported ? one.mechanism : `**NONE.** ${one.mechanism}`} | ${one.declaredAs} |`)
  .join('\n');

/** Idem para os detectores do modelo de domínio: a lista sai do registro, nunca de uma cópia. */
const DETECTOR_TABLE = detectorList()
  .map((one) => `| \`${one.code}\` | ${one.severity} | ${one.summary} |`)
  .join('\n');

/**
 * A tabela do plano de TELAS, derivada de `SCREEN_PLAN_RULES`. Uma regra nova entra aqui sozinha, e —
 * mais importante — o que o plano NÃO decide sai de `SCREEN_PLAN_HUMAN_DECISIONS`: a lista do que fica
 * para a pessoa é a mesma que o plano devolve, e não uma segunda redação dela.
 */
const SCREEN_PLAN_TABLE = SCREEN_PLAN_RULES
  .map((one) => `| ${one.subject} | ${one.decides} | ${one.declaredAs} |`)
  .join('\n');

const HUMAN_DECISIONS = SCREEN_PLAN_HUMAN_DECISIONS.map((one) => `- ${one}`).join('\n');
const SOURCE_ID_PRECEDENCE = SCREEN_SOURCE_ID_PRECEDENCE.map((one) => `1. ${one}`).join('\n');

/**
 * As lacunas de mecanismo, contadas e resumidas do próprio relatório. Um número escrito à mão aqui
 * envelheceria na primeira lacuna fechada — e afirmar que a lista está completa é exatamente o defeito
 * que o relatório existe para não repetir.
 */
const COVERAGE_TABLE = coverageSummary()
  .filter((one) => one.gaps > 0)
  .map((one) => `| ${one.surface} | ${one.total} | ${one.gaps} |`)
  .join('\n');

const ALL_POINTS: ExtensionPointDefinition[] = [
  ...UI_EXTENSION_POINTS,
  ...DATA_EXTENSION_POINTS,
  ...I18N_EXTENSION_POINTS,
  ...THEME_EXTENSION_POINTS,
  ...ACCESS_EXTENSION_POINTS,
  ...AUTH_EXTENSION_POINTS,
];

const kib = (bytes: number): string => `${Math.round(bytes / 1024)} KiB`;

/**
 * As regiões do shell, DERIVADAS da constante. Escritas à mão aqui, uma região nova no kernel deixaria
 * o guia incompleto sem reprovar em nada — e quem lê o guia é justamente quem não tem como descobrir
 * o nome de outro jeito.
 */
const shellSurfaces = (): string =>
  Object.values(WORKSPACE_SLOT_SURFACES).map((surface) => `\`${surface}\``).join(' · ');

/** As espécies de provedor, DERIVADAS da união — uma nova no kernel entra no guia sozinha. */
const providerKinds = (): string =>
  AUTH_PROVIDER_KINDS.map((kind) => `\`${kind}\``).join(' · ');

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
  Delay: '**Not implemented in this version.** It is in the union for compatibility, and a step declared with it stops the flow at that point — `validate_plugin` refuses it. To wait, schedule the work instead: a Cloud Function on a timer (§12) that fires a `workflow.called` flow.',
  Loop: 'A control node: `loop: { source, itemName, outputName, body }` runs `body` once per item and publishes the collected outputs under `outputName`. `stepDefinitionId` is empty.',
  Script: 'Runs one of your `scripts`, named by `configuration.scriptId` as a `Literal` — the `templateId`, which `check` resolves.',
  SubWorkflow: 'Calls another workflow, named by `configuration.targetWorkflowId` as a `Literal` — again a `templateId`.',
};

const describedTable = (header: string, entries: readonly string[], described: Record<string, string>): string => [
  `| ${header} | |`,
  '|---|---|',
  ...entries.map((entry) => `| \`${entry}\` | ${described[entry]} |`),
].join('\n');

/**
 * A tabela do catálogo de passos, DERIVADA. Era um parágrafo dizendo que o catálogo "não pode ser
 * enumerado a partir daqui" — a única capacidade grande do kernel sobre a qual este documento escrevia
 * prosa em vez de tabela, e não por acaso a que os autores mais erravam.
 */
/** Uma lista de nomes em `code`, para prosa gerada. */
const codeList = (names: readonly string[]): string => names.map((name) => `\`${name}\``).join(', ');

const stepCatalogTable = (steps: readonly WorkflowStepMetadata[]): string => [
  '| `stepDefinitionId` | What it does | Takes | Publishes |',
  '|---|---|---|---|',
  ...steps.map((step) => {
    const takes = step.inputs.length === 0
      ? '—'
      : step.inputs.map((input) => `\`${input.id}${input.required ? '' : '?'}\`: ${input.type}`).join(', ');
    const publishes = step.outputDefinitions.length === 0
      ? (step.dynamicOutputs === undefined ? '—' : '_(named at runtime)_')
      : step.outputDefinitions.map((output) => `\`${output.id}\``).join(', ');
    return `| \`${step.id}\` | ${STEP_CATALOG_NOTES[step.id] ?? ''} | ${takes} | ${publishes} |`;
  }),
].join('\n');

/**
 * O que cada passo do catálogo faz, em uma linha. Fechado por `CORE_STEP_DEFINITION_IDS`: um passo
 * novo no kernel sem a linha aqui reprova em `authoringGuideSteps.test.ts`, e é isso que impede a
 * tabela de voltar a ficar incompleta em silêncio.
 */
const STEP_CATALOG_NOTES: Record<string, string> = {
  notify: 'Shows a message to whoever is looking.',
  'register-audit': 'Writes an entry in the audit trail. `severity` defaults to `LOW`.',
  'set-variable': 'Names a value for the rest of the flow. Read it back with `{ kind: \'Variable\' }`.',
  map: 'Assembles an object from other values — what a write step then writes.',
  'validate-object': 'Checks an object against a screen\'s rules before anything is written.',
  exit: 'Ends the flow here, successfully. Takes nothing.',
  'call-workflow': 'Runs another workflow of this package. `waitForResult` decides whether this flow waits. The target may be a `Literal` id or come from an earlier output; `params` carries the parameters in bulk.',
  script: 'Runs one of your `scripts` in the server sandbox.',
  'ai-detect-workflow': 'Asks a model which callable workflow fits a free text, reading their descriptions. No match is a success with `found` false.',
  'ai-extract-parameters': 'Asks a model to fill the parameters of a target workflow from a free text. Publishes `params`, plus `params.<key>` when the target is a `Literal`.',
  query: 'Asks the database. Publishes `count`, `results`, `first`, plus `first.<projection>`.',
  upsert: 'Writes one record. An `id` in the object means update, no `id` means insert.',
  remove: 'Deletes one record.',
};

export interface AuthoringGuideInput {
  kernelVersion: string;
  hostModules: string[];
  advisoryBytes: number;
  maxBytes: number;
  /** O catálogo de passos. Vem por parâmetro, como tudo mais aqui, para que o guia não importe kernel. */
  steps: readonly WorkflowStepMetadata[];
  /** Os gestos de registro. Eram PROSA aqui — uma extensão nova de distância de ficar incompletos. */
  recordCommands: readonly string[];
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

Two loops, and the outer one comes first.

**Model the domain, then generate.** ${SCREEN_IS_NOT_AN_ENTITY_MODEL} A business request describes what
someone will SEE, and the fastest reading of it produces one entity holding everybody else's data —
a sale carrying the customer's name, e-mail and phone, three numbered product slots, and no way to
total anything. That package validates, installs and runs; nothing else here will refuse it. So the
refusal happens earlier:

    microteia://entities          # resource: what already exists here
    validate_domain_model         # the gate: a model with an ERROR goes no further
    generate_artifact_plan        # what must exist, reconciled against what is already here

The model has two halves and one gate. The entities are the first; the second is \`behavior\` — the states a
record moves through, what moves it, and who may (§8.0.1). Do not wait to be asked for "the automation": the
lifecycle arrived in the same sentence as the structure.

Read \`catalogSources\` in those answers before trusting the list of entities: without an exported
snapshot of the installation, what the organization itself built is invisible to them (§14).

Those three are MCP tools (§14). The model's shape is the resource \`microteia://domain-model/schema\`,
and every check it runs is \`microteia://domain-model/rules\` — both derived from this installation.
§8.0 below is the short version.

**Then the package loop:**

    npx microteia-plugin create                   # scaffold, guided
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

### Making the shell your own

Two points let an installation look like itself rather than like the platform, and neither asks for
code. \`ui.slot\` puts content into a named region of the shell — ${shellSurfaces()} — and
\`ui.menu\` adds an entry to a menu, today \`${USER_MENU_SURFACE}\`.

A menu entry declares what it does through \`action\`: \`{ kind: 'openTab', tabKey }\` opens one of your
screens, \`{ kind: 'url', href, newTab }\` opens an address. Nothing else runs — which is why the menu
is open to a package that ships no JavaScript at all.

Both are toggled and ordered by the organization, from Settings, under the region's own key
(\`<surface>.slots\`, \`<surface>.items\`). Declare \`order\` and \`defaultEnabled\` and you have said
where it starts; where it ends up is theirs to decide.

### Signing in — including your own SSO

\`auth.provider\` declares a way of signing in, and it takes no implementation at all. The protocol
is already configured in the project's Firebase Authentication; what your package adds is the NAME of
it. Kinds: ${providerKinds()}.

\`oidc\` and \`saml\` are the two where you choose the provider, and both require \`providerId\` — the
id as configured in Firebase (\`oidc.acme\`, \`saml.acme\`). Miss it and the contribution is dropped
rather than drawn: a button that does not know whom to talk to locks out whoever clicks it.

\`flow: 'redirect'\` leaves the page and comes back, instead of opening a window. Use it wherever the
window is blocked — a hardened corporate browser, an iframe, an embedded app.

\`password\` is the platform's own e-mail-and-password form, declared through the same point. An
installation that requires single sign-on simply does not declare it, and the form, the sign-up link
and the password reset all disappear — the three together, because the three only exist for whoever
has a password here.

The sign-in screen runs ABOVE the organization: there is no tenant, no settings document and no
permission there. So sign-in methods are decided by what is DECLARED, never by a setting — and the
regions it hosts (\`login.header\`, \`login.footer\`) drop any slot that asks for a permission.

**Which means installing your package is not enough.** An installed extension is read from the
organization, and before sign-in there is no organization to read it from. A package that contributes
before sign-in has to be STAMPED into the installation: list its built \`.json\` in \`login.extensions\`
in \`microteia.yaml\`, and \`microteia deploy\` puts it in the site itself.

Stamped packages load UNTRUSTED — only declarations apply, and \`views\` do not run. That is not a
restriction to work around; it is what lets an installation put your SSO live without anyone reviewing
your code. And stamping is not installing: to also work inside the organization, the package has to be
installed there too.

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
| \`surfaceSlot(metadata, viewKey)\` · \`surfaceSlotSpec(metadata, spec)\` | \`ui.slot\` | content in a named region of the shell, as code or as Widget DSL |
| \`menuItem(metadata)\` | \`ui.menu\` | an entry in a menu — the \`action\` *is* the contribution, so no code is involved |
| \`authProvider(metadata)\` | \`auth.provider\` | a way of signing in, corporate SSO included — declaration only |
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

It is used in five places: \`overview\` (the extension's own description in the Extensions screen),
\`manifest.license\` (your licence terms — see below), \`widgetPage\`, \`surfaceTabSpec\` and
\`surfaceWidgetSpec\`.

### \`manifest.license\` — the terms you set

\`\`\`ts
manifest: {
  // ...
  license: {
    type: 'stack',
    gap: 'md',
    children: [
      { type: 'markdown', content: label('license.body') },
      { type: 'banner', message: label('license.warranty'), variant: 'warning' },
    ],
  },
}
\`\`\`

Optional, and it reaches the reader in two places: behind the licence icon on the extension's card in
the **Extensions** screen — where anyone can read it *before* installing — and, once the extension is
installed and active, reproduced in full on the organization's **Terms** page, under the Microteia
Terms of Use. Uninstalling or deactivating it takes the terms off that page, because they stop
applying.

Write it with references, like every other string: a licence the organization cannot read in its own
language is the one document in the package where that matters most.

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

The first-party extensions in \`examples/\` are written this way, and it is worth knowing why they look
slightly different from what you write: they travel inside the platform's own bundle, so their parts
arrive as TEXT and the plugin merges them itself with \`mergeViewSources\`. You have the compiler, so
you declare the list of paths and it does the merging. The split is the same; only the door differs.
Two of them are worth reading side by side — \`calendar\` and \`news\` are four files each, and
\`dashboard\` is one file, because a view that only renders what a hook returned has nothing to split.

\`startup\` receives a \`host\` and may return a teardown function:

\`\`\`ts
export default function startup(host: ExtensionHost) {
  host.commands.register({ /* ... */ });
  return () => { /* undone when the extension is disabled */ };
}
\`\`\`

It is how an extension gets into the command palette and into mentions — the things that have to
exist before anyone opens its screen. Ask \`describe_host_module\` for what \`host\` offers; do not guess.

### Writing the code, once you are sure you need it

Everything else in a package is checked before anyone sees it: a screen is validated, a workflow is
validated, an expression is validated. A view is a program, and the only thing between it and the
organization is you. So write it in the shape the platform writes its own — three files, one view:

| File | What it holds | What it may not hold |
|---|---|---|
| \`Summary.view.tsx\` | JSX, and nothing else: it renders what the view model returned | state, effects, computation, a \`ref.current\` read |
| \`Summary.viewmodel.tsx\` | the state, the effects, the handlers and the derived values, returned as one plain object | JSX |
| \`Summary.styles.tsx\` | the styled-components | anything a test would want to call |

\`\`\`ts
sourceFile: ['./views/Summary.view.tsx', './views/Summary.viewmodel.tsx', './views/Summary.styles.tsx']
\`\`\`

One file is enough while a view only renders what a hook already returned — do not split a component
that has nothing to split. Split it the first time it keeps state of its own, derives a value, or grows
a second screenful of styles. The reason is not tidiness: a component holding all three can only be read
by reading all of it, and what is wrong is almost always the middle part.

**Take what can be wrong out of React.** A sort order, a total, a window of dates, the decision about
which records count — those are functions of their arguments, not of a component. Give each a file of
its own, named in the list like the others, importing nothing, and a test beside it:

\`\`\`ts
// views/Summary.rules.ts — imports nothing, which is what makes it callable
export const upcoming = (items: Item[], limit: number): Item[] => /* ... */;

// views/Summary.rules.test.ts — runs in "npm test", in a second
it('puts the earliest due date first', () => expect(upcoming(items, 3)).toEqual(/* ... */));
\`\`\`

A rule that lives inside a component can only be exercised by rendering the component, which here means
installing the extension in an organization and looking at it. That distance is the whole reason to move
the rule out — not the file count.

**Style through the theme, never through a literal.** \`styled-components\` is curated, and the \`theme\`
it hands you is the organization's, as it is at that moment:

\`\`\`ts
const Card = styled.div\`
  padding: \${({ theme }) => theme.spacing.md};
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.lg};
\`;
\`\`\`

\`colors\`, \`fonts\`, \`fontSizes\`, \`spacing\`, \`borderRadius\`, \`transitions\` and \`highlights\` are the
groups; \`describe_host_module\` gives the exact token names, and a token that does not exist fails to
compile.

**Colour is the part with no exceptions.** A hex or an \`rgba(...)\` written into a view stops matching the
day the office switches theme — and every office eventually switches to the dark one, which is where a
literal turns from wrong-ish into unreadable. Diluting a token colour with an alpha suffix
(\`theme.colors.primary + '18'\`) is allowed and is not the same thing: it keeps the hue the office chose.
Inline \`style={{ }}\` is checked by nothing, so it is the last place a colour should be.

Spacing, type and radius come from a token **whenever a token means the same thing** — a 16px gap is
\`spacing.md\`, and writing it out is how two screens drift apart. A genuinely one-off geometric value
(a 34px circle, a 3px scrollbar, a 1px hairline) has no token, and inventing one nobody else shares is
worse than writing it where it is used.

Colour that **is** data is the other side of the same rule: the colour someone picked for an option, a
phase or a tag arrives as a value, so pass it in as a \`$\`-prefixed prop and apply it as given —
\`getConfigColor\` from \`@microteia/theme\` resolves it against the theme when the option carries only a
name.

And §5 still has no exception, least of all here: no string a person reads is written in a view.

## 8. Screens — the data your extension owns

### 8.0 Model before you declare

A screen is a VIEW of entities, never the shape of them. Decide the entities first, then let the
platform draw them.

| Storage | Cardinality | What you declare | What is stored |
|---|---|---|---|
${STORAGE_TABLE}

A relationship is declared from the side that STORES the link, so \`sourceField\` belongs to
\`sourceEntity\`. The one exception is \`one-to-many\`, written from the "one" side because that is how
the business sentence arrives ("a sale has many items"); it is inverted before anything reads it.

Two things the platform does NOT have, and no declaration will fake:

- **No cascade and no referential restriction between business entities.** Deleting a record removes
  its own notes and documents, and nothing else. Children are left pointing at an id that no longer
  resolves. When they really must go, that is a workflow on \`<collection>.deleted\` with a \`query\` step
  and a \`remove\` step — declarable today, and it is what \`validate_domain_model\` will tell you.
- **No nested object field, and no dotted field key.** An embedded value object is stored flat, with
  the object's name as a prefix and a \`section\` grouping the leaves in the form (strategy
  \`${EMBEDDED_STRATEGY}\`). That keeps them reachable from \`compute\`, \`validate\` and the list filter,
  which a separate 1:1 child screen would not.

**Duplication is allowed; silent duplication is not.** The rule is not "never duplicate data" — it is
that data which is a source of truth stays normalized *unless there is an explicit semantic reason* to
materialise or snapshot it. A line item's unit price is a correct snapshot: the price charged that day
must not change when the catalogue does. Two ways to say it, and they mean different things:

| | Follows the origin | Declared as |
|---|---|---|
| **Snapshot** | no — frozen on purpose | \`{ semanticType: 'snapshot', source: 'Product.price', reason: '...' }\` in the model |
| **Denormalization** | yes | \`denormalize: { denormKey, fields, reason }\` on the relationship, which becomes the platform's \`refDenormKey\` |

Undeclared, either one is indistinguishable from an accident.

**And the one limit worth knowing before you draw a diagram:** an aggregation cannot walk a \`multi\`
reference. The engine reads the parent id out of the child's reference field as a single value and
queries children by one equality, so an array never matches — a total over a many-to-many is not slow,
it is impossible. A many-to-many that carries attributes of its own (quantity, price, discount) is a
junction ENTITY, declared \`kind: 'child'\`, never an array of ids.

### 8.0.1 Model what HAPPENS, in the same breath

The structure is half of what arrived. "A sale is born as a draft; confirming it reserves stock and freezes its
items; invoicing it creates the financial entry; only the manager cancels an invoiced sale" describes four
entities and four transitions in one sentence, and nobody will come back later to ask for "the automation" —
they already asked. So the model has a \`behavior\` block, and it goes through the same gate.

    behavior: { states, transitions, invariants }

**${A_STATE_IS_A_KEY}** A state machine is a \`select\` served by a list, and the option keys are what the
package SEEDS on install (once — from then on the options are the office's data, which is exactly why a
renamed label must never break a transition). Every \`from\` and \`to\` names a key. \`initial\` says where a record
is born; \`terminal\` says where it ends, because "this is the end" and "I forgot the way out" are written the
same way.

| declares | concern | mechanism | written as |
|---|---|---|---|
${BEHAVIOR_TABLE}

Read the refusals as answers, not as gaps to route around:

- **No clock.** Nothing in this installation is time-based, and the \`Delay\` step type was never registered — a
  flow that uses it fails mid-execution. Almost every schedule in a business rule is really a question asked
  when something is WRITTEN, or when a person opens a screen, and a filtered list does the rest.
- **No uniqueness.** No layer enforces it: not the field rules, not the object validation, not the security
  rules. The closest declarable thing is a check AFTER the fact — a workflow on \`<collection>.saved\` with a
  \`query\` step — and it must be presented as one: it finds the duplicate that already exists, and two writes at
  the same instant both pass. If a value must truly be unique, make it the document id.
- **A guard reads ONE record.** It never queries. When the condition needs other records, the \`query\` step
  publishes them and the condition node reads its outputs. That is the shape, and it costs one more step.
- **A permission is only answerable when a person acts.** With no actor — an automation born from a save —
  \`hasPermission\` answers \`false\`, always, because granting on the absence of a person would turn "nobody
  triggered this" into "can do anything". A permission on an event trigger is a flow that never runs.
- **A total is not a step.** Declare the field as derived from children with the aggregate and the kernel
  recomputes it on every write to a child, whoever caused it — including edits made outside your flow.
- **An invariant that must REFUSE the passage cannot live in the automation.** The event of a save is published by
  an \`onDocumentWritten\` trigger: by the time it exists the document is committed, and the \`exit\` step halts the
  flow, not the write. So \`scope: 'transition'\` also declares \`enforcement\`. \`blocks\` belongs on the write path —
  a field rule, which the repository throws on before the document is written, plus, on a \`user-action\`, the
  action's \`disabledWhen\` over \`record.<field>\`, which refuses the gesture before anything runs. \`reacts\` is the
  condition plus \`exit\`, and its message has to read like one: "cannot" and "should not have" are not the same
  sentence to whoever receives it.

**And the \`from\` is checked, not decorated — but not in the same place on every trigger.** On \`<collection>.saved\`
the payload carries the CURRENT value at the root, the previous one under \`old\` (absent on an insert) and
\`changeType: 'created' | 'updated'\`, so \`from\` compares against the state the record is in and creation is
distinguishable from update. On \`<collection>.deleted\` the payload is the before-image — the field reads the state
it was in — and there is no \`old\` and no \`changeType\`; a passage triggered by a delete also writes nothing, because
the document is gone. And \`workflow.called\` carries NONE of the three: its context is the parameters you declared.
The state field only reaches it through an \`EntityReference\` parameter, which the hydrator resolves for you — the
plan names the parameter it needs. What stops the person before that is the action's own \`disabledWhen\`.

And the loop that has no mechanism to save you: an effect that writes back into the record that triggered it
republishes the event. It stops when the flow's condition stops matching — which is what moving the state does
for you — or when the second pass writes the same value, because the platform does not publish when the
document did not change. That is the same property that makes recomputing an aggregate safe. If neither holds,
the cascade is real, and it shows up as cost rather than as an error.

**And two things that are easy to leave empty and expensive to leave empty:**

- **Every \`user-action\` transition needs a \`description\`** — one business sentence about what the passage
  does. It becomes the flow's own description, and ${DESCRIPTION_REQUIRED_BECAUSE}. There is no symptom: it
  installs, it runs when somebody presses the button, and it is simply absent from the list that would have
  found it. The gate warns; nothing else ever would.
- **The notes, documents and tags tabs are OFF by default**, and turning one on is
  \`entity.tabs: [{ kind, because }]\`. The \`because\` is required, for the reason a snapshot's \`reason\` is:
  without it, "on purpose" and "out of habit" read exactly the same six months later.

**Two things the gate cannot decide, and they are yours:**

- **Which states the business actually has.** The sentence names one or two; the rest come from the rest of the
  conversation, and a state nobody mentioned may still be required for the thing to work. No comparison
  derives that. What the gate does check is that what you declared is coherent — that every state is reachable,
  that every one has a way out or is declared final, and that no \`from\`/\`to\` names a label.
- **Whether an actor named in the rule is a NEW permission or one that already exists.** "Only the manager
  cancels" might be \`sales.cancel\`, which nothing offers yet and the package must declare, or \`sales.update\`,
  which every collection yields for free. Choosing is a judgement about what the office means by the word.
  What the gate checks is that naming an actor and asking nothing of them is a defect, and it tells you when
  the identifier is neither derived from a collection nor one the kernel declares.

### 8.0.2 The plan decides the SCREEN too, by rule

\`generate_artifact_plan\` does not only say which collections must exist. It says what the screen IS — and
those decisions are rules, not taste. Before this, the vacuum was filled session by session, with a different
answer each time: a screen with no \`titleFieldKey\` lists records that all read the same, a child with a menu
entry gives two doors to the same data, and a user-action transition with no record action is an automation
nobody can trigger.

| what arrives | what is decided, with no exception | declared as |
|---|---|---|
${SCREEN_PLAN_TABLE}

The list columns are the title, the state field, every REQUIRED reference (a row with no customer has no
context) and anything you asked for with \`showInList\`. A total does not go to the list on its own: a total is
read in the detail, and putting every total in the list is a decision about the LIST. Filters are the state,
references, option lists and yes/no — free text stays out, because the platform already has search and a text
filter beside it is the same question in two places.

And what the plan does NOT decide, it hands back, named:

${HUMAN_DECISIONS}

Plus, per action, WHERE it appears. On the card of the list and in the header of the detail the same gesture
means different things, and only one half of that is derivable: a gesture disabled because of a field the card
does not show is a greyed-out button with no visible reason, so it belongs in the detail. When the refusal
reads only fields the card shows, both placements are legible and the choice is about how people work here —
the plan says so instead of picking.

**The \`disabledWhen\` of each action is not a suggestion.** It carries the transition's \`from\` plus every
invariant you declared with \`enforcement: 'blocks'\`, negated and joined. That is the only place a blocking
invariant can sit on a gesture, and writing the action without it gives a button that fires a flow whose
condition silently discards it.

### 8.1 Declaring one

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

**You do not choose it, and you never change it.** \`generate_artifact_plan\` emits the \`sourceId\` of every
screen it plans, in this order:

${SOURCE_ID_PRECEDENCE}

Copy it verbatim. A \`sourceId\` that changes between two versions of the same package fails nowhere: the
update finds no screen with that identity, claims the declared key, finds it taken and installs a SECOND
screen beside the first. The records stay in the old collection with no screen over them, in every
organization that had the earlier version, and nothing on screen says that is what happened.

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
| \`field.logic.compute\` | the field's value, derived from the record and stored on save |
| \`field.logic.derive\` | the field's value, evaluated on every read and never stored |
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
| \`compute\`, \`validate\`, \`derive\` | the record's fields at the root, plus \`value\` (= \`self\`) — the field's own value. These three run on the client AND on the server, so they must not depend on anything else. A \`derive\` also sees the \`compute\` results; the reverse cannot happen, because \`compute\` runs on save and no derived value exists there |
| \`hiddenWhen\`, \`disabledWhen\`, \`onChange\` of a field | the above, plus \`isNew\` and \`isDirty\`. Client only |
| an action's expressions | the form's current values at the root, plus \`record\` (as stored, \`{}\` when new), \`isNew\`, \`isDirty\`, \`permissions\`, \`surface\` (\`detail\` / \`list\` / \`parentTab\`), \`relation\` (\`none\` / \`owned\` / \`related\`), \`user\` |
| \`badge.when\` | each record's fields at the root, plus \`user\` |
| a workflow | \`event.*\` (the payload), the outputs of earlier steps, and the workflow's variables |

\`user\` is \`{ id, name, permissions }\`. A reserved name wins over a field of the same key — a field
called \`record\` is still reachable as \`record.record\`.

### Computed or derived — the question is whether the expression asks the clock

\`compute\` and \`derive\` both give a field its value from an expression. The difference is WHEN, and
picking the wrong one produces a field that lies without ever failing.

\`compute\` runs on save and the value is stored. That is what you want when the value depends only on
the record: a total, a full name, a composed label. It sits in the document, so it is indexable,
filterable and sortable on the server, and it cannot go stale — nothing outside the record moved.

\`derive\` runs on every read and is never stored. Reach for it the moment the expression asks the
clock — \`today()\`, \`now()\`, an age, a countdown, whether a due date has passed. Stored, that answer
is the answer of the day it was saved: a record saved today as on time stays on time a year later,
and nothing in the system ever comes back to correct it. Derived, it answers about the moment someone
is looking.

What you give up is storage, and everything that follows from it. A derived value does not exist in
the document: it never becomes a Firestore index or an equality filter on the server, and a parent
field cannot aggregate over it (the aggregate IS stored, so it would freeze the same way). Filtering
and sorting still work — in memory, over the records already loaded, exactly as a filter across a
link field does. It is read-only in the form, and it is stripped from every write, so \`compute\` and
\`validate\` cannot see it: both of those run on save, where no derived value exists.

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

\`stepDefinitionId\` names an entry of the platform's **step catalog**. These are the ones the kernel
brings; an extension may contribute more to the \`workflow.step\` point, so a package that declares a
dependency may name an id that is not listed here.

${stepCatalogTable(input.steps)}

**A composite input is a \`Literal\` wrapping a whole config object, and the type is not the one its
name suggests.** \`query\` really does take a \`QuerySpec\`; the other four do NOT take a matching
\`…Spec\`:

| Input type | The type inside the \`Literal\` | |
|---|---|---|
| \`Query\` | \`QuerySpec\` | \`{ table, where, orderBy?, limit, projections }\` |
| \`Upsert\` | \`UpsertStepConfig\` | \`{ table, source: 'input' \\| 'event', property? }\` — no \`data\`: the step reads the object from \`source\`, and an \`id\` in it means update |
| \`Remove\` | \`RemoveStepConfig\` | \`{ table, id }\` |
| \`Map\` | \`MapStepConfig\` | \`{ name?, type?, fields: { name, value }[] }\` |
| \`Validate\` | \`ValidateStepConfig\` | ask \`describe_sdk_type\` |

Writing \`UpsertSpec\` where \`UpsertStepConfig\` belongs is the single most common mistake in an
automation, and it used to be invisible: the package validated and the flow silently wrote nothing.
\`check\` now refuses it.

**\`QuerySpec.where\` uses the operator NAMES**, not the symbols: \`eq\`, \`neq\`, \`lt\`, \`lte\`, \`gt\`,
\`gte\`, \`in\`, \`contains\`, \`exists\`. An operator outside that set matches no rows at all — the query
returns nothing and the flow carries on as if the records did not exist.

Ask the MCP server rather than guessing any of this: \`microteia://workflow/steps\` for the catalog,
\`describe_workflow_step\` for one step's exact inputs and outputs, \`list_workflow_events\` for the
trigger names. All three are derived from this installation.

### A workflow that only exists to be called

\`eventName: 'workflow.called'\` is the flow with no trigger of its own — the one an **action** fires,
and the one \`call-workflow\` calls. It is the most used shape there is, and the only one that
declares \`parameters\`:

\`\`\`ts
{
  templateId: 'wf-review',
  name: label('workflow.review'),
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  parameters: [
    { key: 'recordId', label: label('param.record'), type: 'String', required: true },
    {
      key: 'decision', label: label('param.decision'), type: 'select', required: true,
      options: [
        { value: 'approved', label: label('param.approve') },
        { value: 'rejected', label: label('param.reject') },
      ],
    },
    { key: 'note', label: label('param.note'), type: 'String', rules: { validate: { maxLength: 500 } } },
  ],
  steps: [ /* … */ ],
}
\`\`\`

**The parameters ARE the \`event.\` of that flow.** A step reads \`decision\` as
\`{ kind: 'Event', path: 'decision' }\`, or as \`event.decision\` inside an expression — there is no
\`payload\` level here, because nothing was saved.

\`type\` is \`String\`, \`Number\`, \`Date\`, \`Boolean\`, \`select\`, \`lookup\`, \`EntityReference\` or
\`Object\` (which nests through \`fields\`). \`rules\` applies the same formatting and validation a screen
field gets, so the parameter form refuses a bad value before the flow starts rather than halfway
through it. \`list: true\` makes it many.

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

\`command\` instead of \`workflowId\` runs one of the platform's own record gestures — present, it wins.
The ones the kernel brings are ${codeList(input.recordCommands)}, and anything contributed to
\`ui.record.action\` joins them (\`microteia://record-commands\` on the MCP server answers for this
installation). \`order\`, \`enabled\` and \`danger\` are REQUIRED on every action.
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
    where: [{ path: 'status', op: 'eq', value: 'OPEN' }],   // 'eq', never '=='
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

### A trigger of yours MUST be gated to your extension

A Cloud Function belongs to the **project**. An installation belongs to an **organization**. Nothing in
Firebase reconciles the two, and that gap is not an edge case — it is every project with more than one
organization in it:

\`\`\`ts
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { forInstalledExtension } from 'microteia-functions/office';

export const acmeOnSave = onDocumentWritten(
  { document: 'tenants/{tenantId}/invoices/{id}', region },
  forInstalledExtension('com.acme.crm', async (event) => { /* ... */ }),
);
\`\`\`

\`region\` is this installation's, and \`create function\` fills it in — a trigger declared in another
region never fires, and nothing in the deploy says so.

Without the wrapper that trigger fires for **every** organization in the project: the ones that never
installed your extension, and the one that uninstalled it while another still has it. Uninstalling
cannot save you there — the function has to stay deployed, because somebody else still needs it — and
even when nobody does, it is removed by an administrator running \`microteia provision --prune\`, which
happens minutes or days after the person clicked Uninstall. The guard is what makes the withdrawal
take effect at the moment it is asked for.

**This is a refusal, not advice.** A Firestore trigger exported from your \`functions/\` without the
guard is refused before anything is deployed, and so is one whose guard names a different extension's id
— the copy-and-paste case, where the trigger fires and the handler silently never runs. The check reads
your source, so the guard may also sit in an identifier beside the trigger
(\`const gated = forInstalledExtension('com.acme.crm', handler)\`); what it will not accept is a comment
that mentions it.

\`npx microteia-plugin create function\` asks what sets your function off, and writes the guard for you
when the answer is a saved record.

It costs one cached document read per organization per minute, and it fails closed: an event whose path
carries no \`{tenantId}\` is skipped and logged. **A callable does not need it** — only a screen of your
extension calls one, so it becomes unreachable the moment your extension is gone.

\`isExtensionInstalled(tenantId, pluginId)\` is there too, for when you need the same answer inside a
callable, where the organization comes from the request instead of from a path.

Two rules follow from how a Firebase project works, and both are refusals rather than warnings:

- **A \`defineString\` with no value refuses the deploy of *every* function in the project**, not just
  yours — \`firebase-functions\` validates parameters globally. The Console lists every one it finds in
  \`.env.<projectId>\`, empty, so filling it in is the only step left.
- **One installation, one \`node_modules\`.** Two extensions asking for different ranges of the same
  package is refused, because nothing decides between them. A range the platform already pins is kept:
  the runtime is the platform's choice, and one extension may not move it for the others.

A function shared by several extensions goes in \`../functions/\` instead, next to \`microteia.yaml\`.
Nobody owns it, so it is deployed with every \`microteia deploy\` — and **naming one in your
\`manifest.backend.functions\` is refused**. The claim would change nothing while your extension is
installed, and the day it is uninstalled the function turns into an orphan: \`--prune\` deletes it, the
next deploy puts it back, and whoever else depended on it loses their backend in a window nothing
explains. If the function is really yours, move it into your own \`functions/\`.

### Write the handler thin

A Cloud Function is the one part of an extension that cannot be tried in a second: it is deployed, not
built, and it is deployed into somebody else's project. So keep the handler to what only a handler can
do — refuse the unauthenticated call, read the payload, shape the answer — and put the decision the
function exists to make in a plain function beside it (\`create function\` writes the \`onCall\` options,
region included):

\`\`\`ts
// functions/quote.ts — imports nothing from firebase-functions, so a test can call it
export const quoteFor = (input: QuoteInput): QuoteResult => /* ... */;

// functions/index.ts
export const helloQuote = onCall(options, (request) => {
  if (request.auth === undefined) throw new Error('Sign-in required.');

  return quoteFor(request.data as QuoteInput);
});
\`\`\`

The handler is then a few lines that can only be wrong in obvious ways, and everything that can be wrong
in subtle ways sits in a file \`npm test\` covers. It is the same division as a view and its rules (§7),
for the same reason: the part with a name is the part that can be tested.

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
| \`validate_domain_model\` | the domain model, checked deterministically. An ERROR stops the work |
| \`generate_artifact_plan\` | what must exist, reconciled against what is already here |
| \`validate_plugin\` | the platform's verdict, after every edit |
| \`build_plugin\` | the \`.json\`, without writing it |
| \`describe_sdk_type\` | the exact declaration of any authoring type — \`TemplateField\`, \`WidgetSpec\`, \`WorkflowStep\`, \`PluginManifest\`, \`AuthoredPlugin\` |
| \`describe_host_module\` | what a curated module really exports, for a view or a \`startup\` |
| \`describe_workflow_step\` | one step in full: required inputs, accepted mapping kinds, composite shape, outputs |
| \`read_authoring_guide\` | this document, by section |

And one **prompt**, which is the gesture rather than an answer:

| | |
|---|---|
| \`model_business_rule\` | a business rule arrived. It conducts the order — understand, model, validate, plan — and it is the step people skip |

The order is the point of it. A rule arrives as three lines in a conversation, and the fastest thing to do with
three lines is write a screen. That reading installs and runs, and what it costs is paid later and paid forever.
The prompt puts the sentence itself first: the rule becomes an artifact (\`{ id, statement, actors, concepts,
invariants, processes, acceptance }\`) before any entity exists, and the \`statement\` keeps the words it arrived
in — everything after it is a reading, and a reading with no original is traceable to nothing.

Everything that took no argument is a **resource** instead — a document a client attaches and reads,
rather than a tool costing an input schema in every agent's context, in every session:

| | |
|---|---|
| \`microteia://entities\` | the entities this workspace knows. Read it first, in any modelling task |
| \`microteia://domain-model/schema\` | the shape a domain model must have |
| \`microteia://domain-model/rules\` | every check, how each relationship storage is really stored, and the screen rules |
| \`microteia://domain-model/coverage\` | what the model canNOT say — the mechanisms this platform has and the vocabulary does not reach |
| \`microteia://workflow/steps\` | the step catalog — every \`stepDefinitionId\`, what it takes, what it publishes |
| \`microteia://workflow/events\` | the trigger names, and what \`event.\` carries in each |
| \`microteia://extension-points\` | every point, its API version, the impl kinds it accepts |
| \`microteia://record-commands\` | the record gestures an action may run through \`command\` |
| \`microteia://expression-functions\` | the expression functions the installed platform resolves |
| \`microteia://workspace/plugins\` | the extensions authored here, with their current problems |
| \`microteia://workspace/info\` | what this workspace is bound to |

None of them reads the organization's database: what they know is this directory plus the platform
itself. The rule that decides which list something belongs to is worth keeping: **takes an argument or
changes something, it is a tool; hands back a document, it is a resource.**

### What the organization actually runs

The catalog above is honest about a gap it cannot close on its own. A screen somebody built in the Form
Design, and an extension already installed in the organization, are not in this directory — and a field
called \`customerName\` is a defect only *because* Customer is a thing. Without them the check that
matters most cannot fire against the entities that matter most.

The server does not close it by talking to the database. \`microteia-plugin\` is offline by design, and
putting a credential inside the authoring tool would trade a blind spot for something worse. What talks
to the project is the Console, so the Console exports a **snapshot** and this directory reads it:

    microteia export-catalog --tenant <tenantId>

It writes \`${INSTALLED_CATALOG_FILE}\` here — screens with their fields, lists of options, tag lists,
and which extensions are installed. Run it from the installation root (where \`microteia.yaml\` is); with
no \`--tenant\` it lists the offices in the project rather than guessing one. It is **git-ignored**,
because it carries screen and field names the organization typed: that is tenant data, not a product
artifact.

Three things follow, and they are the point:

- **Every entity says where it came from** — \`kernel\`, \`workspace\` or \`installation\` — and every
  answer that uses the catalog carries a \`catalogSources\` block saying when the snapshot was taken and
  what it leaves out. A catalog presented as complete when it is not is worth less than none, because
  the reader stops asking.
- **It is a snapshot, and it ages.** Nothing keeps it in step with the organization. After
  ${INSTALLED_CATALOG_STALE_DAYS} days the answer says so; anything created there since it was taken is
  simply missing.
- **The workspace wins.** An entity in both the snapshot and a \`plugin.ts\` here resolves to the one you
  are editing, and the installed copy is dropped whole. That is reported as information, never as an
  error — but it is reported, because what runs there may already have fields your \`plugin.ts\` does not.

Without the file, everything works exactly as it did before: the catalog is this directory plus the
platform, and it says so.

What it deliberately leaves out, and will not carry — it describes what the entities ARE, and nothing an
organization typed into them:

${INSTALLED_CATALOG_OMITS.map((one) => `- ${one}`).join('\n')}

### Keep the model on disk

Save it as \`<folder>/domain-model.json\`. It is not decoration: \`source\` and \`reason\` on a snapshot
have nowhere to live in an installed field — the artifact carries a plain column — so without the file
the next session reads the catalog, finds \`productName\` sitting on an invoice line, and raises it
again. The checks read the file back on their own, which is what makes a declared exception cost one
decision instead of one per session.

**And save the rule beside it, as \`<folder>/${RULE_LEDGER_FILE}\`.** The plan hands it to you ready to write,
under \`trace.contents\`, when you pass the \`rule\`. It records which screens, lists, actions, flows and
permissions that rule produced — and that is the whole traceability mechanism. What it buys is one thing, and
it is large: when the rule CHANGES, the plan is a diff of what that rule generated. Without it, the changed
rule proposes a second batch of screens that look like the first, and "this replaces that" is left to whoever
remembers.

It is a workspace file on purpose. Stamping the rule's id inside the installed artifact would need a new
property on the screen, the action and the flow — the shape of the package changes, and the Kernel contract
moves with it. The question "which screens did this rule create?" is an AUTHORING question: whoever asks it has
the \`plugin.ts\` open. The organization never asks it, and for them the screen is a screen. It is the same
verdict a declared snapshot exception got, and it has the same consequence: a fresh workspace does not have the
link, which is fine, because a fresh workspace does not have the \`plugin.ts\` the rule generated either.

The domain model can be tested the same way the package is, and for the same reason — the rule then
fails here, in a second, instead of in someone's organization:

\`\`\`ts
import { buildDomainCatalog, validateDomainModel } from '@microteia/sdk';
import MODEL from './domain-model.json';

it('stays modelled', () => {
  const issues = validateDomainModel(MODEL, buildDomainCatalog()).issues;
  expect(issues.filter((one) => one.severity === 'error')).toEqual([]);
});
\`\`\`

### The checks it runs

| Code | Severity | What it catches |
|---|---|---|
${DETECTOR_TABLE}

ERROR blocks the artifact plan; WARNING and INFO do not. Every problem carries a \`suggestion\` and a
\`howToDeclareException\` — and where there is no exception, it says so, which is an answer too.

### What the model cannot say, and why that is written down

Of ${mechanismCoverage().length} mechanisms this platform has, the model's vocabulary reaches
${mechanismCoverage().length - coverageGaps().length} and does not reach ${coverageGaps().length}. Read
\`microteia://domain-model/coverage\` for the list, item by item, with what each one costs.

| surface | mechanisms | out of reach |
|---|---|---|
${COVERAGE_TABLE}

That list exists because of one defect and its whole family. A \`user-action\` transition produced a callable
flow with no description, and without a description the flow is invisible to the step that picks a flow from a
sentence. The model had no way to know — there was no description field — and nobody found out for three
phases. A mechanism with no vocabulary is invisible until somebody trips over it, and the answer to that is not
attention: it is a derived list, checked by a test, so the next one shows up as a failing build instead of as a
surprise.

So when a rule needs one of them — the \`query\` step, a clock, uniqueness, a page, which record an effect
writes — say so and hand the decision back. Translating it into something that looks similar is the one failure
mode this whole subsystem exists to prevent.

Read \`examples/\` for first-party extensions in source form — they are the very source that produces
the \`.json\` the platform installs, so nothing in them is a simplification. Between them they cover
screens, fields, lookups, patches, views wired to pages, \`startup\`, translation and themes.

For automation, read \`examples/automation-example/\` first. It exists for that reason and nothing
else: a workflow triggered by a save, a \`Condition\` node that branches and converges, a \`query\`, a
\`map\` feeding an \`upsert\` that stays idempotent on a second run, a \`workflow.called\` flow with
parameters, and an action with \`promptParameters\` that asks a person before firing. Every id in it is
one \`microteia://workflow/steps\` would give you, and the package validates — which is the whole point of
reading an example instead of a snippet.
`;
