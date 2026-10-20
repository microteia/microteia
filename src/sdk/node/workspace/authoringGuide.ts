import { RECORD_SURFACE_PREFIX, USER_MENU_SURFACE, WORKSPACE_SLOT_SURFACES } from '../../../domain/schema/ui/uiExtensionPoints';
import { KERNEL_EXTENSION_POINTS } from '../../../domain/schema/extensionPoints';
import { SCREEN_ICON_KEYS } from '../../../domain/schema/ui/screenIconCatalog';
import { AUTH_PROVIDER_KINDS } from '../../../domain/schema/auth';
import { EXTENSION_IMAGE_MAX_BYTES } from '../../../domain/usecases/plugins/pluginImage';
import type { ExtensionPointDefinition } from '../../../domain/schema/plugin/extensionPoint';
import { CUSTOM_FIELD_TYPES } from '../../../domain/schema/fieldRules';
import type { CustomFieldType } from '../../../domain/schema/fieldRules';
import { WIDGET_NODE_TYPES } from '../../../domain/schema/ui/widgetSpec';
import {
  REPORT_CHART_KINDS,
  REPORT_GRANULARITIES,
  REPORT_SHAPE_KINDS,
} from '../../../domain/schema/report/reportSpec';
import { AGGREGATION_OP_SINCE_KERNEL } from '../../../domain/schema/aggregationSpec';
import { AGGREGATE_BACKFILL_SINCE_KERNEL, AGGREGATION_MAX_CHILDREN } from '../../../domain/schema/aggregateBackfill';
import { RECORD_KEY_ADOPTION_SINCE_KERNEL } from '../../../domain/schema/recordKeyAdoption';
import { AGGREGATION_OP_LABELS, NUMERIC_AGGREGATION_OPS } from '../../../domain/schema/fieldRules';
import type { WidgetNodeType } from '../../../domain/schema/ui/widgetSpec';
import { STEP_TYPES } from '../../../domain/entities/Workflow';
import type { WorkflowStepMetadata } from '../../../domain/schema/workflowStepCatalog';
import { isStepExcludedFromTrigger } from '../../../domain/schema/workflowStepCatalog';
import { WORKFLOW_AUDIT_EVENT, WORKFLOW_AUDIT_SINCE_KERNEL } from '../../../domain/schema/workflowAuditTrigger';
import type { StepType } from '../../../domain/entities/Workflow';
import { FIELD_EXPRESSION_FUNCTION_NAMES } from '../../../domain/schema/fieldExpression';
import { BUSINESS_CALENDAR_FIELDS } from '../../../domain/schema/time/businessDays';
import { BUSINESS_CALENDAR_POINT } from '../../../domain/schema/time/extensionPoints';
import { ARTIFACT_PREFIX_SINCE_KERNEL } from '../../../domain/schema/plugin/artifactPrefix';
import {
  DOCUMENT_OUTPUTS_BY_FORMAT,
  DOCUMENT_TEMPLATE_MAX_BYTES,
  DOCUMENT_BELONGS_TO_SINCE_KERNEL,
  DOCUMENT_DESTINATION_SINCE_KERNEL,
  DOCUMENT_PARAMETER_TYPES,
  DOCUMENT_PAYLOAD_MAX_BYTES,
  DOCUMENT_PAYLOAD_SINCE_KERNEL,
  DOCUMENT_TEMPLATE_SINCE_KERNEL,
  DOWNLOAD_RETENTION_MAX_DAYS,
  TEMPLATE_BLOCKS,
  TEMPLATE_LOOP_VARIABLES,
} from '../../../domain/schema/document';
import { DEFAULT_TIME_ZONE, TIME_ZONE_SETTING, timeZoneForLocale } from '../../../domain/schema/i18n/timeZone';
import {
  DATE_REACHED_CATCH_UP_DAYS,
  DEFAULT_DATE_REACHED_AT,
  MAX_DATE_REACHED_OFFSET_DAYS,
  MIN_SCHEDULE_INTERVAL_MINUTES,
  WORKFLOW_CLOCK_TICK_MINUTES,
  MAX_DELAY_DAYS,
  WORKFLOW_DATE_REACHED_SINCE_KERNEL,
  WORKFLOW_DELAY_SINCE_KERNEL,
  WORKFLOW_SCHEDULE_SINCE_KERNEL,
} from '../../../domain/schema/workflowClock';
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

const ALL_POINTS: ExtensionPointDefinition[] = KERNEL_EXTENSION_POINTS;

/**
 * O vocabulário fechado do relatório, DERIVADO das constantes.
 *
 * Escrito à mão, cada lista ficava uma operação nova de distância de ficar incompleta — e um autor
 * que lesse "sum, count, avg" não descobriria a que entrou depois. É o mesmo tratamento que as
 * regiões do shell e o catálogo de passos já recebem.
 */
const inlineList = (values: readonly string[]): string =>
  values.map((value) => `\`${value}\``).join(', ');

const AGGREGATION_OP_NAMES = Object.keys(AGGREGATION_OP_LABELS);

const DOCUMENT_OUTPUT_TABLE = Object.entries(DOCUMENT_OUTPUTS_BY_FORMAT)
  .map(([format, outputs]) => `| \`${format}\` | ${outputs.map((output) => `\`${output}\``).join(', ')} |`)
  .join('\n');
const DOCUMENT_BLOCKS = TEMPLATE_BLOCKS.map((block) => `\`{{#${block} …}}…{{/${block}}}\``).join(' and ');
const LOOP_VARIABLES = TEMPLATE_LOOP_VARIABLES.map((name) => `\`${name}\``).join(' and ');
const DOCUMENT_TEMPLATE_MAX_KB = DOCUMENT_TEMPLATE_MAX_BYTES / 1024;

const MEASURE_OP_NAMES: readonly string[] = NUMERIC_AGGREGATION_OPS;

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
  report: 'A report from the organization\'s catalogue, by name. `report` is its key. '
    + 'It names the report instead of embedding the query on purpose: an inline query would put '
    + 'aggregation, permission and scan limits inside a layout DSL, and give you a second place to '
    + 'declare what a number means.',
  keyValue: 'A list of label/value rows. `items: { label, value }[]`.',
  banner: 'A notice. `message`, `variant?: \'info\' \\| \'warning\'`.',
  divider: 'A rule between blocks. No properties.',
};

/** O que cada tipo de passo faz. Fechado por `StepType`. */
const STEP_KINDS: Record<StepType, string> = {
  Action: 'Runs one entry of the platform\'s step catalog, named by `stepDefinitionId`. Its inputs are `configuration`.',
  Condition: 'A control node: `condition` decides which of `branches.whenTrue` / `branches.whenFalse` runs, and the flow converges after. `stepDefinitionId` is empty.',
  Delay: '**Not a step type of its own.** It is in the union for compatibility, and a step declared with it stops the flow at that point — `validate_plugin` refuses it. To wait, use the `delay` catalog step (`type: \'Action\'`, `stepDefinitionId: \'delay\'`, §10); to act at a time, a workflow with `eventName: \'schedule\'`.',
  Loop: 'A control node: `loop: { source, itemName, outputName, body }` runs `body` once per item and publishes the collected outputs under `outputName`. `stepDefinitionId` is empty.',
  Script: 'Runs a script, named by `configuration.scriptId` as a `Literal` — a `templateId` of your own package, or `<extension-id>/<source-id>` for a script another extension exports (§3).',
  SubWorkflow: 'Calls another workflow, named by `configuration.targetWorkflowId` as a `Literal` — again a `templateId`, or a qualified reference.',
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

/**
 * O catálogo de ícones em parágrafo justificado. Vai por extenso, e não por amostra, porque a
 * pergunta que ele responde é fechada: uma chave fora desta lista não existe, e uma lista parcial
 * devolveria o autor a adivinhar — que é exatamente o defeito.
 */
const iconColumns = (): string => {
  const lines: string[] = [];
  let line = '';
  for (const key of SCREEN_ICON_KEYS) {
    const next = line === '' ? `\`${key}\`` : `${line}, \`${key}\``;
    if (next.length > 98) {
      lines.push(`${line},`);
      line = `\`${key}\``;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines.join('\n');
};

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
  notify: 'Notifies people in the app (the bell), by e-mail or by push, and/or writes it to the audit trail. With no channel set it only writes to the audit trail, as version 1 did. Recipients come from `recipientMembers`, `recipientsFrom` (a member id, or a record linked to one by `memberId` — a reference read on its own is an id, so a person linked to a member is `event.personId.memberId`) and `recipientPermission`; each person keeps or refuses a channel in Settings, and `title`/`message` resolve in each recipient\'s language. Publishes `recipients`, `delivered.<channel>` and `failed.<channel>`.',
  'register-audit': 'Writes an entry in the audit trail. `severity` defaults to `LOW`.',
  'set-variable': 'Names a value for the rest of the flow. Read it back with `{ kind: \'Variable\' }`.',
  map: 'Assembles an object from other values — what a write step then writes.',
  'validate-object': 'Checks an object against a screen\'s rules before anything is written.',
  exit: 'Ends the flow here, successfully. Takes nothing.',
  delay: 'Pauses the run and continues it later, in the same run — `duration` (`30m`, `4h`, `2d`) or `until`. Top level only, and only in a run started by an event.',
  'call-workflow': 'Runs another workflow of this package. `waitForResult` decides whether this flow waits. The target may be a `Literal` id or come from an earlier output; `params` carries the parameters in bulk.',
  script: 'Runs one of your `scripts` in the server sandbox.',
  'ai-detect-workflow': 'Asks a model which callable workflow fits a free text, reading their descriptions. No match is a success with `found` false.',
  'ai-extract-parameters': 'Asks a model to fill the parameters of a target workflow from a free text. Publishes `params`, plus `params.<key>` when the target is a `Literal`.',
  query: 'Asks the database. Publishes `count`, `results`, `first`, plus `first.<projection>`.',
  upsert: 'Writes one record. An `id` in the object means update, no `id` means insert.',
  remove: 'Deletes one record.',
  'render-document': 'Fills a document template (`document.template`, or the organization\'s own on the same key) with a record and attaches the PDF or Word file to its Documents tab. The template names the screen; `recordId` must be a record of it. Publishes `documentId`, `name`, `url`, `format` and `emptyFields`.',
};

const excludedStepList = (steps: readonly WorkflowStepMetadata[], eventName: string): string => steps
  .filter((step) => isStepExcludedFromTrigger(step, eventName))
  .map((step) => `\`${step.id}\``)
  .join(', ');

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
| A **Cloud Function** — \`manifest.backend\` | the extension stays inert until someone provisions the organization's Firebase project (§14) |

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
snapshot of the installation, what the organization itself built is invisible to them (§16).

Those three are MCP tools (§16). The model's shape is the resource \`microteia://domain-model/schema\`,
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

An imported extension is used there — activated, installed, published to the catalogue — but never
edited or downloaded: its source is *your* \`plugin.ts\`, not the copy in the organization. To change
it, raise \`manifest.version\`, build, and import the new \`.json\` over the old one. The platform
refuses an import whose id belongs to an extension created on that organization's own *Create
extension* screen, since that would replace an editable source with a closed copy.

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
  reports: [],         // questions asked of the data
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

\`manifest.category\` is optional and free — \`'Theme'\`, \`'Integration'\`, whatever files your
extension usefully. The Extensions list derives its category filter from what the listed packages
declare, so a category nobody used before appears there on its own. Like \`name\` and \`summary\`, it
may be a message reference (\`label('category.reports')\`): you translate what you name.

\`manifest.image\` is the logo the Extensions list shows next to the name — a base64 \`data:\` URI of
a PNG, JPEG, WebP or SVG, at most ${EXTENSION_IMAGE_MAX_BYTES / 1024} KB. A web address is refused: the
package carries everything it shows, and a remote image would tell a third-party server who opened the
list. Without an image the list draws \`manifest.icon\`, and without that, the icon of the first menu
entry or page the extension contributes. Installs, stars and the verified-publisher seal are not
declared: the platform counts and grants them.

### Prefix

\`manifest.prefix\` starts every name your extension creates in the organization that installs it. A
collection — screen, option list, tag set, a field you add to someone else's screen — takes it with
\`_\` (\`acme_client\`); an automation, action, script, report or document template takes it with \`-\`
(\`acme-notify-client\`). 2 to 8 lowercase letters or digits, starting with a letter.

Why it exists: the collections of an organization are ONE namespace. Two extensions that both create
\`client\` cannot live in the same office, and the installation refuses the second one rather than
renaming it — a renamed collection would silently be read by whoever expected the declared name.

- \`create\` asks for the prefix once, records it in \`package.json\` under \`microteia.prefix\`, writes it
  in the manifest and in the names it generates.
- Declared, it is enforced: \`check\` and the installation refuse a created name that does not start
  with it. Absent — extensions written before it existed — nothing is refused, and \`check\` warns.
- It never changes. An update with another prefix is refused: it would rename everything you created.
- The id of the extension must be inside the directory's namespace (\`microteia.namespace\`). An id
  outside it is refused by \`build\` — the copy of somebody else's extension still carrying their id.
  An id that was published before the namespace existed goes in \`microteia.keepIds\`.

Requires kernel \`^${ARTIFACT_PREFIX_SINCE_KERNEL}\`; an older kernel ignores the field.

Every change to an extension raises \`manifest.version\`, and records itself as one entry at the top of
that extension's \`VERSIONS.md\` — the file \`create\` generates next to \`plugin.ts\`. The entry is
written for whoever *uses* the extension: what they will notice, in one plain sentence, never the file
or the field you touched. An extension changed without a new version is an extension that never reaches
the organizations that already have it: the version is the whole of how an update is recognised.

### References between your own artifacts

Inside the package, artifacts point at each other by \`templateId\` (automations, actions, scripts) or
\`key\` (screens), never by real id — the real ids are generated at install time and differ per
organization. \`check\` refuses a reference that leads nowhere.

To point at a *screen* another extension installs, declare what that extension brings:

\`\`\`ts
dependencies: { 'com.example.projects': { version: '^2.0.0', collections: ['projects'] } }
\`\`\`

### References to another extension's artifacts

An automation, an action or a script of another extension is named
\`<extension-id>/<source-id>\` — the id of the extension that owns it, then the \`templateId\` it
carries in its own package. A local id is never enough: it is generated at install time and the
organization may already have that name taken, so what survives the trip is the owning extension
plus the source id.

\`\`\`ts
import { artifactRef } from '@microteia/sdk';

// in the manifest
dependencies: { 'com.example.utils': '^1.0.0' },

// in a step
configuration: {
  scriptId: { kind: 'Literal', value: artifactRef('com.example.utils', 'normalize-tax-id') },
}
\`\`\`

Two conditions, and both are refused when unmet:

- **You declare the dependency.** \`check\` refuses a qualified reference whose extension is not in
  \`dependencies\`.
- **They declare the export.** Only what the owning extension lists in \`manifest.exports\` may be
  referenced. An extension that declares no \`exports\` exposes nothing — every artifact of it stays
  private. This is what lets you rename an internal helper without breaking someone else.

\`\`\`ts
// in the owning extension's manifest
exports: ['normalize-tax-id', 'notify-customer'],
\`\`\`

If the owning extension is not installed, installation is refused and names it. Nothing is resolved
at packaging time: the reference travels as written and the engine resolves it by name on every run,
so it survives the owner being updated or reinstalled.

**You do not have to know the name of anything to write one.** Read \`microteia://referenceable\` — it
lists every artifact this directory can see another extension exporting, already in the form the
reference takes, and each line says which \`kind\` it is, because the kind decides where it fits:

    com.example.utils/normalize-tax-id — Normalize tax id (script, authored here)

Two sources feed it, and the difference matters. A \`plugin.ts\` **in this directory** — the sibling being
authored beside yours — is the truth of now, and it is the case no snapshot can know about, because that
extension is not installed anywhere yet. An extension from \`${INSTALLED_CATALOG_FILE}\` is what the
organization runs, as of the day the snapshot was taken. \`describe_workflow_step\` says the same thing on
the input that takes the id, filtered to the kind that fits there.

\`check\` confers the whole gate from here, not half of it: the reference's shape, the declared
dependency, **and** whether the owner really exports that id at the version you asked for. What it will
not invent is an absence — an owner this directory cannot see comes back as "cannot be checked here",
with what to run to close the gap, never as a refusal.

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

A menu entry declares what it does through \`action\`: \`{ kind: 'openTab', tabKey }\` opens a tab a
\`ui.page\` draws, \`{ kind: 'openTab', screen }\` opens the list of one of your screens (the same target
as \`nav()\`, see "Where a menu entry leads" below), \`{ kind: 'url', href, newTab }\` opens an address.
Nothing else runs — which is why the menu is open to a package that ships no JavaScript at all.

Both are toggled and ordered by the organization, from Settings, under the region's own key
(\`<surface>.slots\`, \`<surface>.items\`). Declare \`order\` and \`defaultEnabled\` and you have said
where it starts; where it ends up is theirs to decide.

### A tab inside a record — including another extension's

Every record detail hosts a tab surface of its own, addressed by the screen's \`sourceId\`:
\`recordSurface('<sourceId>')\` returns \`${RECORD_SURFACE_PREFIX}<sourceId>\`. Contribute a \`ui.tab\` there with
\`surfaceTab\` or \`surfaceTabSpec\` and it appears after Data, Notes and Documents, on saved records
only, in the same list as the child-screen tabs — the organization orders and toggles both together in
Settings, and by default child screens come first. Address the \`sourceId\`, never the installed key: the key may be disambiguated
on install, the \`sourceId\` does not change. A screen of another extension is fair game — declare
that extension in \`dependencies\`.

A \`code\` tab receives \`RecordTabProps\` from \`@microteia/data\`: \`recordId\`, \`record\` (as stored,
and re-rendered when it changes), \`collection\` and \`screenSourceId\`. A \`widget\` tab receives no
data, as on every surface. To list the children of the open record, pass
\`parent: { fieldKey, recordId }\` to \`useEntityList\`: the list is locked to that record, its
actions see \`surface: 'parentTab'\`, and \`openNewRecord()\` opens the form with the field filled in.
Their \`relation\` is \`owned\` when \`fieldKey\` is the screen's declared ownership OR a \`required\`
field — a link that cannot be emptied is never offered as Unlink, so the card shows Delete — and
\`related\` only when the link is optional.

The other side of a many-to-many link gets the same lock. Pass \`parent: { fieldKeys: [...], recordId }\`
and a record enters when ANY of those fields points at \`recordId\` — equality on a single \`reference\`,
"contains" on one with \`multi: true\`: the projects a person works on, the cases where a person is a
party on either side. \`openNewRecord()\` fills the FIRST field (a one-id list when it is \`multi\`).
Unlink takes \`recordId\` out of every field that points at it — out of the list on a \`multi\` field,
leaving the other ids — and \`relation\` is decided per record: a \`required\` \`multi\` field that
still has other ids stays \`related\`, and turns \`owned\` only where \`recordId\` is its last id. Only a
lock by ONE single field hides that field from the card and the filters, because there every record
has the same value; a \`multi\` field or a second field tells something, and stays. Requires kernel
\`^2.51.0\`. Draw \`filteredRecords\` — the list after the person's filter, in
the order of \`sortRecords\` —, and keep \`records\` (the whole list, same order) for counting, finding by id
and totals; declare \`sortRecords\` instead of sorting by hand.

The organization toggles and orders these tabs from Settings (\`<surface>.tabs\`). \`check\` refuses
\`${RECORD_SURFACE_PREFIX}\` with no \`sourceId\`, and warns — without refusing — about a \`sourceId\` it
cannot find in your package, in a dependency authored beside it, or in the installation snapshot.
\`examples/record-tab-example\` has both kinds of tab, and the list locked to the open record.

### Your own screens in the portal

People from OUTSIDE the organization — a client, a supplier — see what screens declare in \`portal\`
(the \`subject\`, the \`fields\` that leave, \`create\` for what they may submit, \`edit\` for what they
may change, \`uploads\` for the documents they may attach). The portal draws a
home, a menu and a standard list and record for them. \`portalView(metadata, viewKey)\` adds yours:

| \`surface\` | Also declare | What it is |
|---|---|---|
| \`list\` / \`detail\` | \`collection\` | replaces the standard list, or the open record, of that collection |
| \`page\` | \`key\`, \`title\`, \`icon\`, \`order\` | a page of its own, with an entry in the portal MENU |
| \`widget\` | \`key\`, \`title\`, \`order\` | a card on the portal HOME |
| \`home\` | — | the whole home, in place of the standard one |

\`order\` is a suggestion. The organization decides what shows and where, in Settings > Portal — the
menu's order and which entries and cards are visible. Your package never forces a place.

A portal view reaches a smaller API: \`@microteia/ui\`, \`@microteia/i18n\`, \`@microteia/format\`,
\`@microteia/theme\` and \`@microteia/portal\` — \`usePortalRecords(collection, { parent })\`,
\`usePortalRecord\`, \`usePortalScreen\`, \`usePortalNavigation\`, \`usePortalDocuments\`,
\`usePortalSubmit\`, \`usePortalUpdate\`. Show an edit gesture only when the record's \`canEdit\` is true
(\`usePortalNavigation().edit\` opens the standard form). Importing \`@microteia/data\` (or report, settings, functions) fails when the view is
compiled: the guest has none of the organization's data stores. A view receives \`{ collection, recordId? }\`
and asks \`@microteia/portal\` for the rest.

It is sent to the guest only when the organization trusts your package's code — the same trust the
Extensions screen shows. Without it, the standard page is drawn.

#### The portal is used on a phone first — design for it

Most guests open the portal on a phone. The portal is responsive, and your view has to be too:

- **One breakpoint, 768px.** Below it the menu is a bar FIXED at the bottom of the screen (Home, the first
  entries, More); above it, tabs at the top. Do not draw a menu of your own, and never use
  \`position: fixed\` at the bottom — it would sit under the bar.
- **Fluid widths.** No fixed widths and no horizontal scroll: use \`width: 100%\`, \`minmax(0, 1fr)\` grids
  and \`flex-wrap\`. Grow into columns with \`@media (min-width: 768px)\`, never the other way around.
- **A card is narrow.** A \`widget\` takes the whole width on a phone and half of it on a computer —
  keep it to a number, a short list or one call to action.
- **Tap targets of at least 44px** (\`theme.spacing['2xl']\` is 48px). Text never below
  \`theme.fontSizes.sm\` on a phone.
- **Theme only.** Colours, sizes and spaces come from the theme — the organization's theme is what the
  guest sees, in light or dark.
- **Check it at 360px wide** before publishing.

\`examples/portal-example\` has the declarations on two screens, a \`detail\` page and a home card.

### Settings whose options are the organization's data

A \`select\` in a \`settingsSection\` takes either \`options\` — a closed list, written in your package —
or \`optionsFrom\`, never both. \`optionsFrom\` reads the options from a collection of the organization,
so a choice keeps up with what the office renames, recolours and adds:

\`\`\`ts
{
  key: 'cases.recent.statuses',
  label: label('settings.recent.statuses'),
  type: 'select',
  multi: true,
  optionsFrom: { kind: 'lookup', collection: 'caseStatuses' },
  default: ['open'],
  scopes: ['tenant', 'user'],
}
\`\`\`

| \`kind\` | Options | Value stored | Label | Colour |
|---|---|---|---|---|
| \`lookup\` | an option list | the option KEY | the option label | the option colour, when the list has one |
| \`entity\` | the records of a screen | the record ID | the screen's \`titleFieldKey\` | — |

**The value is exactly what the matching field stores on a record** — a \`select\` field with that
\`lookupCollection\` stores the key, a \`reference\` field stores the ID. That is the whole contract:
your view compares the setting with the record using \`===\`, with no translation in between. An
option created by the office has the same key and label; an option you seed may not
(\`pending\` / "Pending"), and the key is what you compare.

\`multi: true\` makes the value a \`string[]\` (it works with closed \`options\` too). Read it with
\`useSettingValue\`, or with \`useSettingChoices\` from \`@microteia/settings\`, which also gives each
chosen value's label and colour — so a card title can name the statuses it shows without reading the
list again.

\`collection\` follows the rule of every other reference: in your package (\`lookups\` or \`screens\`) or
in a declared dependency (\`collections\`), and \`check\` refuses one that leads nowhere. Name a screen
of your package by its key, as a field would: the platform finds the installed screen even when its
key had to be disambiguated in the office.

What the editor does, so you do not have to: it is the record form's own control, so options keep
their colours and several values show as removable chips. A value whose option or record no longer
exists stays stored, shows as missing, and can be removed — validation checks the SHAPE of the value,
never whether it still exists. Someone who cannot read the screen of an \`entity\` source sees the
setting disabled, with the reason. An option list is vocabulary, readable by every member.

\`check\` also refuses \`optionsFrom\` or \`multi\` outside a \`select\`, and a \`default\` of the wrong
shape (a list with \`multi\`, a text without). A kernel older than these two draws such a \`select\`
with no options, so a package that uses them starts its \`kernel\` range at the version it is built
with. \`examples/settings-example\` has one property of each kind.

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
| \`nav(metadata)\` | \`ui.nav\` | a menu entry — ONE target (\`key\`, \`screen\` or \`screenSourceId\`, below), \`label\`, \`icon\`, \`order\`, optional \`badge\`, \`group\`, \`requiredPermissions\` and \`requiresSystemAdmin\` |
| \`navGroup(metadata)\` | \`ui.nav.group\` | a titled, collapsible group of the sidebar — \`key\`, \`label\`, \`order\`, optional \`defaultCollapsed\`; entries join it with \`group: '<key>'\` (below) |
| \`page(metadata, viewKey)\` | \`ui.page\` | a workspace screen drawn by one of your \`views\` (§7) |
| \`widgetPage(metadata, spec)\` | \`ui.page\` | a workspace screen declared in Widget DSL — no code, no review |
| \`surfaceTab(metadata, viewKey)\` · \`surfaceTabSpec(metadata, spec)\` | \`ui.tab\` | a tab on a surface, as code or as Widget DSL |
| \`surfaceWidget(metadata, viewKey)\` · \`surfaceWidgetSpec(metadata, spec)\` | \`ui.widget\` | a widget on a surface, as code or as Widget DSL |
| \`surfaceSlot(metadata, viewKey)\` · \`surfaceSlotSpec(metadata, spec)\` | \`ui.slot\` | content in a named region of the shell, as code or as Widget DSL |
| \`menuItem(metadata)\` | \`ui.menu\` | an entry in a menu — the \`action\` *is* the contribution, so no code is involved; \`openTab\` takes ONE of \`tabKey\`, \`screen\` or \`screenSourceId\` |
| \`authProvider(metadata)\` | \`auth.provider\` | a way of signing in, corporate SSO included — declaration only |
| \`recordAction(metadata, viewKey)\` | \`ui.record.action\` | a gesture over one record, next to the platform's own |
| \`command(id, metadata, viewKey)\` | \`ui.command\` | an entry in the command palette |
| \`settingsSection(section)\` | \`ui.settings\` | a section of the Settings screen — the properties *are* the contribution |
| \`messageBundleContribution({ locale, namespace, messages })\` | \`i18n.messages\` | the words, one bundle per locale (§5) |
| \`themeTokensContribution(spec)\` | \`theme.tokens\` | colour and typography tokens |
| \`accessPermissionContribution\` · \`accessRequirementContribution\` · \`accessResourceContribution\` | \`access.*\` | what people can do (§13) |
| \`lookupProviderContribution\` · \`fieldRulePresetContribution\` | \`data.*\` | an external source of options; a reusable field rule |
| \`pointContribution(point, id, metadata, apiVersion)\` | any | a point published by *another* extension, which cannot have a constructor here |

Two fields every contribution accepts, and both are easy to miss:

- **\`when\`** — an expression. The contribution exists only while it is true.
- **\`priority\`** — who wins when several contributions land on the same single-valued point.

Metadata for a screen, a tab or a widget also takes **\`requiredPermissions\`**: a list, and **one** of
them is enough. Absent, the contribution shows for every member. This is what keeps a menu entry from
leading someone to a screen they cannot read.

### Icons — a closed vocabulary

Every \`icon\` in a package is a **key from the platform's catalogue** — a screen, a nav entry, a tab,
a widget, a menu item, an action, a list-card field (\`ui.list.icon\`) and the extension itself all draw
from the same ${SCREEN_ICON_KEYS.length} keys. They are not Remix names, not Material names, and not
free text.

Guessing one costs nothing while you write: the platform draws a generic marker for a key it does not
recognise, so nothing throws and nothing logs — the mistake first appears on the screen of whoever
installed the extension. \`check\` refuses it instead, naming the icon and where it was written.

Ask the MCP server for \`list_icons\` (resource \`microteia://icons\`) for the list this installation
actually draws. It is:

${iconColumns()}

## 5. Text — the rule that has no exception

Every label a person reads is a **reference**, resolved at render:

\`\`\`ts
const label = (key: string) => \`@com.example.hello/\${key}\`;

fields: [{ key: 'title', label: label('field.title'), type: 'text', required: true, order: 0 }]
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

Every string in a spec is a message reference, exactly as everywhere else — every string but the
one named below, which is an identifier and not text anybody reads. The DSL has no
expressions, and it reaches data in exactly ONE way: the \`report\` node, which names a report from
the organization's catalogue (§11). That is what a dashboard is here — a \`grid\` of \`report\`
nodes, each one a table or a chart, with no code in it and nothing for anybody to review:

\`\`\`ts
widgetPage({ key: 'sales', title: label('page.sales'), icon: 'fileChart' }, {
  type: 'grid',
  columns: 2,
  children: [
    { type: 'heading', text: label('page.sales') },
    { type: 'report', report: 'acme-invoices-by-month' },
    { type: 'report', report: 'acme-invoices-by-city' },
  ],
})
\`\`\`

The node names the report by its \`key\`, and that key is **not** rewritten on installation the way a
collection name is — so prefix it with your extension, or you inherit whichever report of that name
the organization already had. Anything else that has to show live records is a screen (§8) or a view
(§7): there is no inline query here, for the reason the node table gives.

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
views: [{ key: 'summary', title: label('page.summary'), icon: 'lineChart', sourceFile: './views/Summary.view.tsx' }]
\`\`\`

\`sourceFile\` is an authoring field: the compiler replaces it with the file's contents. Keeping the
code in a real \`.tsx\` is what lets \`tsc\` and your editor check the part of the extension most likely
to be wrong.

### Grouping menu entries

The sidebar is drawn in sections. An entry with \`group: '<key>'\` joins the \`navGroup()\` with that key;
the group sits at its own \`order\`, on the same scale as the loose entries, and its entries follow
their own \`order\` inside it. The platform declares three groups — put a tool of yours in the one that
matches its purpose:

| Constant | Holds | \`order\` |
|---|---|---|
| \`CUSTOMIZATION_NAV_GROUP\` | what shapes the organization: screens, document templates, extensions | 102 |
| \`AUTOMATION_NAV_GROUP\` | what runs on its own: workflows, scripts, actions, data processing | 106 |
| \`ADMIN_NAV_GROUP\` | the organization's administration: its record, settings, translations, audit, access | 110 |

The user menu is for the person, not for tools: their profile and appearance. A tool entry belongs in
the sidebar.

- **A group key is universal**, like a screen's \`sourceId\`. Two packages that declare the same key
  declare ONE group, labelled and placed by whichever loads first. So you may declare a group another
  extension also declares, and join it without depending on it.
- **A group is joined by KEY, never by name.** Two keys draw two groups, even when both are called
  "Schedule". **Before declaring a group, read \`microteia://nav-groups\`**: every group this directory
  can see — the platform's, the \`plugin.ts\` files here, the first-party extensions in \`examples/\`
  and the extensions in the installation snapshot —, by key, with its name in each language and who
  declares it. If one already serves the purpose, declare THAT key. A new key is for a purpose no
  listed group serves. \`check\` and \`validate_plugin\` warn about a new key whose name another
  visible group already has, and about an entry joining a group nothing here declares.
- **An entry never disappears because of its group.** A \`group\` nobody declared in the organization
  leaves the entry loose, at its own \`order\`.
- **A group draws a header only with two or more visible entries.** With one, the entry stands loose in
  the group's place; with none — permissions, missing targets — the group is not drawn.
- **Collapsing is the person's choice**, remembered on their device; \`defaultCollapsed\` is only where
  it starts. A collapsed group still shows the entry of the open tab, and its header carries the sum
  of the hidden badges.

\`\`\`ts
navGroup({ key: 'schedule', label: label('nav.group.schedule'), order: 20 }),
nav({ key: 'calendar', label: label('nav.calendar'), icon: 'calendar', order: 20, group: 'schedule' }),
\`\`\`

### Where a menu entry leads

A \`nav()\` — and a \`menuItem()\` whose action is \`openTab\` — names exactly ONE target:

| Target | Opens | Use it for |
|---|---|---|
| \`key: '<tab key>'\` (\`tabKey\` in a menu action) | the tab a \`ui.page\` draws — by \`key\`, or by \`keyPrefix\` | a page of this package, of a declared dependency, or of the platform (\`reports\`, \`marketplace\`, …) |
| \`screen: '<screen key>'\` | the LIST of a screen of this package | a screen you draw no view for — usually with \`hideFromSidebar\` and a \`badge\` (§8) |
| \`screenSourceId: '<sourceId>'\` | the list of a screen, found by its universal id | a screen of a dependency |

**A screen's key is not a tab key.** The list of a screen lives in a tab only the installation can name:
the key may gain a suffix there (\`products\` becomes \`products_2\` when the name is taken), or be the key
of a screen the organization already had with the same \`sourceId\`. \`screen\` is resolved after all of
that, so the entry keeps working; you never write the tab yourself.

\`check\` — and the installation — refuse an entry that leads nowhere: a \`key\` that no page of this
package, of a declared dependency or of the platform draws. When a screen of yours has that same key,
the refusal says so and names the \`screen:\` you meant. A dependency \`check\` cannot see from here is
reported as "cannot be checked here", never refused. And if a tab still opens with no page behind it,
the workspace says so — the tab key and the extension that put the entry in the menu — instead of
showing an empty panel.

\`\`\`ts
// Refused: 'recordTabMilestone' is a screen, and no page draws a tab with that key.
nav({ key: 'recordTabMilestone', label: label('nav.milestones'), icon: 'flag', order: 60 }),

// Opens the screen's list, whatever key it has in the organization.
nav({ screen: 'recordTabMilestone', label: label('nav.milestones'), icon: 'flag', order: 60,
  badge: { collection: 'recordTabMilestone', when: 'done != true' } }),
\`\`\`

### A view is not a page until something points at it

\`views\` is a registry, not a menu. The entry sits there, keyed, until a contribution names that key:

\`\`\`ts
contributes: [
  nav({ key: 'summary', label: label('nav.summary'), icon: 'lineChart', order: 50 }),
  page({ key: 'summary', title: label('page.summary'), icon: 'lineChart' }, 'summary'),
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
- **\`home: true\`** makes the page the workspace's start page — the tab opened when the
  organization is entered and nothing else is open. The platform names no start page of its own: with
  none declared, the workspace starts with no tab. If several are declared, the first one loaded that
  the person may see wins.
- **\`nav().badge\`** counts records without any code: \`badge: { collection: 'invoices', when: 'status
  == "open"' }\`. The expression sees each record's fields plus \`user\` (§9), which is what lets a badge
  count what *this* person has not dealt with.

### Several files, one module

\`sourceFile\` also takes a list, merged in the order given:

\`\`\`ts
views: [{
  key: 'summary',
  title: label('page.summary'),
  icon: 'lineChart',
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

- **A clock moves records on; it never stops them.** \`trigger: { kind: 'schedule', when: '0 5 * * *' }\` becomes a
  workflow the kernel clock wakes at that cron time, in the office time zone, with no record and no actor. The
  \`from\` turns into the filter of a \`query\`, and the passage runs per record inside a \`Loop\`. What it cannot do
  is refuse a write — by the time it looks, the record is saved. And a schedule is often the wrong answer: a rule
  asked when something is WRITTEN, or a filtered list a person opens, needs no clock at all.
- **"When the date comes" is not a schedule.** "Overdue three days after the due date" is
  \`trigger: { kind: 'date-reached', field: 'dueDate', offset: '+3d' }\`, and it becomes a
  \`<collection>.dateReached\` workflow: the kernel finds the records that are due, each one arrives as the
  event, once per record and per date, and a changed date fires again. Reach for \`schedule\` only when the
  rule really is about the clock ("every Monday, close the week"), not about a date of the record.
- **Waiting is an effect, in order.** \`effects: [create-record, { kind: 'wait', duration: '2d' }, notify]\` runs the
  first effect at the passage and the last one two days later, in the same run. It is accepted on a save or a
  date trigger, and refused on a button (it waits for the answer) and on a schedule (its effects run inside a
  loop). The effects after the wait see the record AS IT WAS at the passage: "two days later, if it is still
  open, charge" is not a wait — it is \`date-reached\` on the date, with the state in the condition.
- **Generating a document is an effect.** \`{ kind: 'generate-document', template: 'proposal', output: 'pdf' }\`
  fills the template with the record of the transition and attaches the file to its Documents tab — the
  \`render-document\` step. The template is declared with \`documentTemplateContribution\` on the screen of that
  same entity, so the effect never names another entity (the model could not say WHICH record), and it is
  refused on a delete, when there is no record left to attach to. \`output\` is \`pdf\` (default) or \`docx\`.
- **Uniqueness is DECLARED, never computed.** It is the one rule that compares a record against the others, and
  the one you must not write as an expression: a field \`validate\` and a \`validate-object\` step both see a single
  record and never query, and a workflow on \`<collection>.saved\` finds the duplicate only after it exists — two
  writes at the same instant both pass. Declare it on the screen instead: \`keys: [{ name, kind, fields }]\`, or
  \`unique: true\` on the field when one field is the whole key. See "Keys — what cannot repeat" below.
- **A guard reads ONE record.** It never queries. When the condition needs other records, the \`query\` step
  publishes them and the condition node reads its outputs. That is the shape, and it costs one more step.
- **A permission is only answerable when a person acts.** With no actor — an automation born from a save —
  \`hasPermission\` answers \`false\`, always, because granting on the absence of a person would turn "nobody
  triggered this" into "can do anything". A permission on an event trigger is a flow that never runs.
- **A total is not a step.** Declare the field as derived from children with the aggregate and the kernel
  recomputes it on every write to a child, whoever caused it — including edits made outside your flow. The same
  goes for "the value of the most recent child" (the outcome of the last decision, the date of the last contact):
  that is \`op: 'latest'\` with an \`orderBy\`, not a pair of flows on \`.saved\` and \`.deleted\` querying with
  \`limit: 1\` — those miss a write made outside the flow and leave the field editable by hand.
- **A new aggregate reaches the records that already exist.** Adding an aggregate to a screen that already has
  records — or changing its \`from\`, \`via\`, \`op\`, \`field\`, \`filter\` or \`orderBy\` — fills in every existing
  parent on the server, in batches, without you writing a migration and without touching the children. It is
  the declaration that starts it, whoever wrote it: your package on install or update, the office in the Form
  Design. Only the aggregate that is new or changed is recomputed; the ones that were already right are left
  alone, and changing a label recomputes nothing. These writes are not business events: they publish no
  \`<collection>.saved\` and leave no audit line per record (one line for the whole pass), so a flow on \`.saved\`
  never runs over the office's history. They keep \`updatedAt\` as it was and stamp \`updatedBy: 'aggregate-engine'\`
  and \`updatedVia: 'aggregate-backfill'\`. A parent with more than ${AGGREGATION_MAX_CHILDREN} children is filled
  in with what was read and counted on the screen's notice, exactly as the live engine does. This needs kernel
  ${AGGREGATE_BACKFILL_SINCE_KERNEL} or later; on an earlier kernel the aggregate still works, but only on the
  parents whose children change after it was declared — a \`kernel\` range that admits an earlier one will
  install, and the old records will stay empty there.
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
  icon: 'filePaper',
  titleFieldKey: 'number',
  subtitleFieldKey: 'client',
  fields: FIELDS,
  hasNotes: true, hasDocuments: true, hasTags: true, tagCollection: 'invoiceTags',
  listActions: ['copyLink', 'manageTags', 'delete'],   // the card shows them in this order
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
| \`autoValue: { pattern }\` | a generated code: \`A\` letter, \`0\` digit, \`*\` either, anything else literal (\`AA-0000\`). Not repeated among the records already loaded, and still editable. For a code that must truly not repeat, declare a key |
| \`logic\` | the expressions: \`compute\`, \`validate\`, \`hiddenWhen\`, \`disabledWhen\`, \`onChange\` (§9) |
| \`aggregation: { from, via, op, field?, filter?, orderBy? }\` | the value comes from CHILD records — \`op\` is one of ${inlineList(AGGREGATION_OP_NAMES)}. Declared, not inferred, so the engine knows exactly when to recompute. \`latest\` copies \`field\` of the first child that passes \`filter\` after sorting by \`orderBy\` (required with it, and only with it): an empty key sorts last in both directions, ties fall to \`createdAt\` in the direction of the last key and then to the document id, and no matching child makes the field empty (\`null\`). The parent field must have the child field's type, option list, target and cardinality — the value is copied as it is. "The first" is \`latest\` with \`dir: 'asc'\`. A package using \`latest\` declares \`kernel: '^${AGGREGATION_OP_SINCE_KERNEL.latest}'\` or later |
| \`rules\` | \`validate\` (\`check\`, \`pattern\`, \`minLength\`, \`maxLength\`, \`message\`) and \`format\` (\`preset\`, or \`pattern\` + \`replacement\`). A requirement that depends on other fields is an expression in \`logic.validate\` |
| \`showInList\`, \`listLabel\`, \`listIcon\`, \`listOrder\` | whether and how the field appears on the list card |
| \`filterable\` | the field becomes a filter on the list |
| \`hiddenInForm\` | keeps a field out of the form without deleting it |
| \`file: { extensions, maxSizeMb }\` | what a \`file\` field accepts — the size is in megabytes |

**Fields the organization adds** to your screen are theirs. An update of your extension preserves
them, and uninstalling removes only yours.

### Keys — what cannot repeat

A screen with no key accepts duplicates, and that is the default on purpose: two identical rows are
two valid rows until somebody says otherwise. When the business says otherwise, DECLARE it — it is
the one rule here you must not write as an expression.

\`\`\`ts
screens: [{
  key: 'produtos',
  titleFieldKey: 'nome',
  keys: [
    { name: 'sku', kind: 'primary', fields: ['sku'], sparse: false },
    { name: 'linha-nome', kind: 'unique', fields: ['linha', 'nome'] },
    { name: 'email', kind: 'unique', fields: ['email'], normalize: { caseInsensitive: true } },
  ],
  fields: [ /* … */ ],
  // …the rest of the screen, as above
}]
\`\`\`

A key over ONE field can be written on the field itself — \`unique: true\` — which produces exactly
the same key, named \`field:<key>\`. Reach for \`keys\` when the COMBINATION of several fields is what
must not repeat, or when you need a scope, a comparison, or a value that is required.

| | |
|---|---|
| \`name\` | stable, and it is what finds the reservation already written for existing records. Renaming a key retires it and declares another |
| \`kind: 'unique'\` | forbids a second record with this value |
| \`kind: 'primary'\` | that, plus the key is an ADDRESS: an idempotent \`upsert\` by natural key, a stable link. At most one per screen, and never optional |
| \`fields\` | keys of fields of THIS screen, in order — and the order is part of the value |
| \`scope: 'tenant' \\| 'parent'\` | \`tenant\` (default) is the whole organization; \`parent\` is unique WITHIN one parent record — the item numbered 1 of EACH order — and it needs \`parentFieldKey\` |
| \`normalize\` | how two values count as the same: \`trim\` (on by default), \`caseInsensitive\`, and \`formatPreset\` — \`digits\` makes \`123.456\` and \`123456\` one value |
| \`sparse\` | on by default: a record with no value reserves nothing, so forty records with an empty field do not collide in the void. \`false\` makes the value required |
| \`message\` | the reference of what the person reads on the conflict |

**How it holds.** The value is written into a reservation document whose id derives from the value
itself, in the SAME batch as the record. Creating that document is the lock: the security rules
allow \`create\` and not \`update\`, and \`create\` only fires when the document does not exist — so a
second write with the same value fails the batch WHOLE, and no duplicate is ever committed. There is
no window between checking and writing, and it needs no composite index.

**What a key is not.** It is not the document id. The id stays random, because a natural key changes
— the CPF was typed wrong — and moving a document would break every reference pointing at it. A key
is an index, not an address.

**On a collection that already has records**, you write nothing beyond the declaration. A key that
is new — or whose \`fields\`, \`normalize\`, \`scope\` or \`sparse\` changed, or whose \`formatPreset\`
now formats differently — is ADOPTED by the platform, whoever declared it: your package on install or
update, the office in the Form Design. Do not write a migration for it.

- From the first instant, a value written by the form or by an \`upsert\` is checked against the key:
  a new record, or a record whose key value changes, is refused if the value is taken.
- Editing any other field of a record that already existed never trips over the key. Its value is
  the sweep's business, not the next save's.
- The sweep runs on the server, in batches, and only writes the reservations and the record's
  \`keyRefs\`. No other field, and not \`updatedAt\`. These writes are not business events: no
  \`<collection>.saved\`, no audit line per record.
- When nothing is duplicated, the key starts holding on every record by itself. Until then it is
  **pending**.
- When old records repeat a value — or lack it, on a \`primary\` or \`sparse: false\` key — the key
  stays pending. Whoever manages screens sees the repeated values on the screen's list, and the
  office's audit log gets one line. Correcting or deleting the records is the whole gesture: each
  such write rechecks the list, and the key starts holding as soon as nothing repeats.
- A \`formatPreset\` that is not installed holds the sweep until it is.

\`status\` on a key is ignored: whether a key holds is the platform's to say, not the declaration's.
This needs kernel ${RECORD_KEY_ADOPTION_SINCE_KERNEL} or later. On an earlier kernel the key holds from
the moment it is declared without looking at what is stored: an old duplicate is never reported, and
saving that record is refused for a reason nobody showed.

**Where the line is.** The reservation is what makes a duplicate impossible through every honest
path: the form, an automation's \`upsert\`, an import, a migration. What the security rules cannot
check generically is that the value reserved IS the value stored — the rules are static and keys are
runtime data, so a rule cannot compute an id from a list of fields it does not know. That last inch
is enforced at the two write paths, which is the same footing \`required\`, a mask and
\`rules.validate\` already stand on.

### Relationships, and where a screen shows up

| | |
|---|---|
| \`parentEntity\`, \`parentFieldKey\` | this screen is a CHILD: which screen, and the \`reference\` field that points at it. On an \`owned\` child the form hides that field only when it is opened from INSIDE the parent (the child tab, a list locked with \`useEntityList({ parent })\`), where it comes filled in; opened from the child's own screen, the field shows as declared, so a child with a menu of its own can still be created there |
| \`parentRelation: 'owned' \\| 'related'\` | \`owned\` — it exists because of the parent; deleting the parent does NOT delete it (there is no cascade, see above), it is left orphaned. \`related\` — it merely points at the parent, and the gesture that fits is unlinking. A \`required\` link is treated as \`owned\` for the card gestures whatever this says: Unlink would empty a field the save refuses |
| \`hideFromParentTabs\` | the child does not become a tab of the parent |
| \`hideFromSidebar\`, \`sidebarOrder\` | whether a top-level screen gets its own menu entry, and where. Hide it when you declare the entry yourself with \`nav({ screen: '<screen key>', badge })\` — that is how a menu entry gets a badge. Write \`screen\`, never \`key\`: a screen's key is not a tab key, and \`nav({ key: '<screen key>' })\` is refused (§4, "Where a menu entry leads"). A \`nav({ screen })\` over a screen that does NOT hide itself replaces its automatic entry instead of adding a second one |
| \`hideRecordsFromCommandPalette\` | the records of this screen stay out of the command palette (⌘K) search. Declare it when a machine fills the collection — an ingestion, a mail feed — or its records crowd out what people are looking for. The screen itself is still offered ("Open …"), so a screen that also hides from the sidebar keeps one way in; lists, links, tabs and reference pickers are untouched |
| \`recordTabPrefix\` | opening a record from outside (audit log, a mention, the command palette) lands on YOUR view instead of the form (§7) |
| \`dataCollection\` | install the screen over a collection that already exists, instead of creating one. \`fields\` is still the complete schema of it |
| \`eventPrefix\` | the prefix of the events this collection emits, which is what workflows subscribe to (§10) |
| \`listActions\`, \`viewActionIds\`, \`cardActionIds\` | the platform's own record gestures by key; your \`actions\` by \`templateId\` |
| \`memberWritableFields\` | fields ANY member may write on a record someone else created — the door for per-person state (read, liked, saved) that the default permission would close |
| \`authorCanDelete\` | whoever created the record deletes it, without an administrator |
| \`portal\` | what an outside guest sees: \`subject\` (\`'self'\` for the screen whose records receive guests, \`{ field }\` for a reference that leads to it, \`'parent'\` to inherit from the parent), the \`fields\` that leave the organization — nothing else does — and \`documents\` to expose the documents someone marked as shared. \`create: { fields }\` lets the guest create records, filling only those fields — the link to the subject is set by the server from what the guest already sees, never from what they send; it is refused on the \`'self'\` screen. \`uploads: { types }\` lets the guest ATTACH documents — choosing one of those types (none listed = any the organization has), never creating one, and never deleting; it requires \`documents\`. \`edit: { fields, when?, onlyOwn? }\` lets the guest CHANGE records: only those fields, and only fields that are also in \`fields\` (a guest never overwrites what they cannot see); never the link to the subject; \`when\` is a field expression on the WHOLE record (\`status == "draft"\`) checked by the server on every change — invalid means closed —, and \`onlyOwn\` limits it to records the guest created in the portal |
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
| \`report.dataset.includeWhen\` | which rows enter the report (§11) |
| \`action.hiddenWhen\`, \`disabledWhen\`, \`activeWhen\` | whether a button appears, is pressable, or reads as ON |
| \`nav().badge.when\` | which records the menu badge counts |
| \`contribution.when\` | whether the contribution exists at all |
| workflow \`condition\` of \`kind: 'Expression'\`, and any \`{ kind: 'Expression' }\` input mapping | whether the automation runs, and what a step receives |

**The scope is what changes between them, and it is the thing that trips people up:**

| Slot | What is in scope |
|---|---|
| \`compute\`, \`validate\`, \`derive\` | the record's fields at the root, plus \`value\` (= \`self\`) — the field's own value. These three run on the client AND on the server, so they must not depend on anything else. A \`derive\` also sees the \`compute\` results; the reverse cannot happen, because \`compute\` runs on save and no derived value exists there |
| \`hiddenWhen\`, \`disabledWhen\`, \`onChange\` of a field | the above, plus \`isNew\` and \`isDirty\`. Client only |
| an action's expressions | the form's current values at the root, plus \`record\` (as stored, \`{}\` when new), \`isNew\`, \`isDirty\`, \`permissions\`, \`surface\` (\`detail\` / \`list\` / \`parentTab\`), \`relation\` (\`none\` / \`owned\` / \`related\`), \`user\`. A single \`reference\` field is navigable (\`caseId.responsibleLawyerId\`, \`caseId.contractId.clientId\`) — see below. Client only |
| \`badge.when\` | each record's fields at the root, plus \`user\` |
| a report's \`dataset.includeWhen\` | each row's fields at the root, a reference navigated by the name of the record it points at (\`client.city\`), and \`id\`. Every path the expression names exists, and is \`null\` when the record has no value for it — so a field nobody filled in is empty, never an error. Server only, running as the reader: \`hasPermission\` answers for the person who opened the report |
| a workflow | \`event.*\` (the payload), the outputs of earlier steps, the workflow's variables, and \`actor\` — who triggered the run |

\`user\` is \`{ id, name, permissions }\`. A reserved name wins over a field of the same key — a field
called \`record\` is still reachable as \`record.record\`.

\`actor\`, in a workflow, is \`{ id, name, via }\` or \`null\`. \`id\` is the person's uid — the same value a
form writes in \`createdBy\` and the id of their \`members\` document —, \`name\` is their effective name
(nickname, then full name, then display name, then e-mail), and \`via\` is \`"ui"\` when they pressed a
button in the app and \`"agent"\` when an AI agent acted on their behalf over MCP. It is \`null\` where no
person caused the run: a \`<collection>.saved\` / \`.deleted\` trigger, and every flow those start. Test it
with \`isEmpty(actor)\`; \`actor.name\` there reads \`null\` instead of failing. A workflow variable named
\`actor\` does not shadow it. It is identity, not access: what the person may do is still
\`hasPermission(...)\`.

| How the run started | \`actor\` | \`hasPermission\` answers for |
|---|---|---|
| an action (button), or \`run_action\` over MCP | the person, \`via\` \`ui\` / \`agent\` | that person (over MCP: the token's ceiling) |
| \`run_workflow\` (app or MCP) | the person | nobody — the run happens later, on the event bus, and access is not written there |
| \`call-workflow\` waiting for the result | the caller's actor | the caller's actor |
| \`call-workflow\` not waiting | the caller's actor | nobody — same reason as \`run_workflow\` |
| \`<collection>.saved\` / \`.deleted\` | \`null\` | nobody |

**Navigating a reference from an action.** In an action's expressions, a path that goes THROUGH a
single \`reference\` field reads the record it points at: \`caseId.title\`, and further,
\`caseId.contractId.clientId\`. Only what the expression navigates is swapped — a reference read on its
own is still the id, so \`parameterDefaults: { clientId: 'clientId' }\`, \`isEmpty(caseId)\` and
\`caseId == "abc"\` mean what they always meant — even inside an expression that also navigates it:
in \`concat(caseId, " ", caseId.title)\` the first \`caseId\` is the id. \`caseId.id\` is the id too. A
\`multi\` reference is not navigable here. Workflows follow the same rule (§10).

A path with nothing at the end of it is \`null\`, never an error: an empty reference, a deleted record,
and a record in a collection the viewer cannot read all answer \`null\` along the way — a value only
reaches the expression if the person could open the record it came from.

When the pointed-at record is fetched depends on the slot:

| Slot | Pointed-at record |
|---|---|
| \`hiddenWhen\`, \`disabledWhen\`, \`activeWhen\` | synchronous: what the client already holds. A record not loaded yet reads as \`null\` — the button is drawn, never hidden by mistake |
| \`parameterDefaults\` | on demand: the form waits a moment for the records the expression navigates, then opens |

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

### \`today()\` is the organization's day

An instant is the same everywhere; the day it falls on is not. At 10 p.m. in Brasília it is already
tomorrow in UTC. \`today()\` answers the day **in the organization's time zone** — the
\`${TIME_ZONE_SETTING}\` setting under Settings → Language and region, resolved person → organization →
automatic. Automatic follows the organization's language: \`pt-BR\` means \`${timeZoneForLocale('pt-BR')}\`,
anything without a known region means \`${DEFAULT_TIME_ZONE}\`.

The same rule runs everywhere the expression does — the form, a \`derive\` read in the browser or on
the server, a workflow, a report's \`includeWhen\` — so \`dueDate < today()\` cannot be true on the
screen and false in the automation that acts on it. Do not compensate for the time zone yourself:
\`addDays(today(), -1)\` "to fix the evening" is wrong for every organization the day the setting changes.

\`now()\` stays an **instant**. Compare it with other instants (\`dateDiff(now(), createdAt, "hours")\`);
when you need a day, ask \`today()\` instead of cutting one out of \`now()\`.

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
| Business days | \`addBusinessDays(v, n, calendars)\`, \`businessDaysBetween(a, b, calendars)\`, \`isBusinessDay(v, calendars)\`, \`nextBusinessDay(v, calendars)\` — see below |
| Lists | \`first(a)\`, \`last(a)\`, \`map(a, path, compact)\`, \`contains(a, item)\`, \`length(a)\` |
| Brazil, and formatting | \`isCPF\`, \`isCNPJ\`, \`isEmail\`, \`onlyNumber\`, \`formatCPF\`, \`formatCNPJ\`, \`formatMoney(v, locale)\` |
| Check digits | \`mod97(text)\` — the ISO 7064 mod 97-10 remainder, computed over the text so a 20-digit number keeps every digit; letters A–Z count 10–35, anything else (or empty) is \`null\`. Move the check digits to the end first: \`mod97(concat(substring(d, 0, 7), substring(d, 9, 20), substring(d, 7, 9))) == 1\` checks a CNJ number, \`98 - mod97(base + "00")\` computes them |
| Objects | \`object(k, v, ...)\`, \`delete(key, target)\` |
| Access | \`hasPermission(pattern)\` |

An empty value never makes an expression fail, on a screen or in a workflow: a member of \`null\` is
\`null\`, so \`isEmpty(output.query.first.title)\` over a query that found nothing is \`true\`. A path
that does not exist at all is still an error — \`event.payload.title\` in a workflow, where \`event\` is
already the payload, fails the run instead of quietly writing nothing. \`and\` and \`or\` stop
at the side that decides, and \`? :\` and \`if(cond, a, b)\` evaluate only the branch they pick — every
other function receives its arguments already evaluated.

### Business days

The kernel counts business days; it does not know where the calendars live. An extension tells it,
with one contribution — \`businessCalendarContribution({ collection: 'businessCalendars' })\`, on the
point \`${BUSINESS_CALENDAR_POINT}\` — and every document of that collection is a calendar:

| Field | |
|---|---|
| \`${BUSINESS_CALENDAR_FIELDS.key}\` | what a formula writes to name the calendar (the document id works too) |
| \`${BUSINESS_CALENDAR_FIELDS.name}\` | how the office calls it — only used to say which calendar a refusal is about |
| \`${BUSINESS_CALENDAR_FIELDS.weekend}\` | weekdays that are never business days, \`0\` = Sunday … \`6\` = Saturday |
| \`${BUSINESS_CALENDAR_FIELDS.years}\` | year → the \`YYYY-MM-DD\` days of that year that are not business days |

A formula names one calendar or several — a text, a list, or a reference field that points at
calendars — and counts with their UNION: a day that is not a business day in any of them is skipped.

\`\`\`
addBusinessDays(start, 15, ["national", "regional"])   // the 15th business day AFTER start
businessDaysBetween(start, end, "national")            // business days in (start, end]
isBusinessDay(today(), calendars)
nextBusinessDay(addDays(start, 15), "national")        // start itself if it is one, else the next
\`\`\`

\`addBusinessDays(d, n)\` never counts \`d\` itself, and \`businessDaysBetween(d, addBusinessDays(d, n))\` is
always \`n\`. Doubling a term is \`n * 2\`; "the first business day after, then n more" is two calls.

**A count never answers by omission.** No extension declaring calendars, a calendar that does not
exist, a year the calendar never registered: each one is a named refusal. In \`compute\` and
\`validate\` it blocks the save and says why — unlike every other expression error, which is
tolerated. In \`derive\` the field reads empty. A date counted without the holidays is a wrong date
nobody notices, and that is the one failure a deadline cannot have.

The server reads the calendars only for an evaluation that calls one of these functions, so a
collection that never counts business days pays nothing for the capability.

The complete set the installed platform resolves, derived from it rather than from this table:

${FIELD_EXPRESSION_FUNCTION_NAMES.map((name) => `\`${name}\``).join(', ')}

## 10. Automation — workflows, actions and scripts

Three artifacts, and the distinction is what starts them:

| | Starts when | Runs |
|---|---|---|
| **workflow** | a record changes, a list changes, a schedule comes due, a date of a record arrives, or another workflow calls it | on the server |
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
\`document\`, \`workflow.called\` for a workflow that only exists to be invoked — that one declares
\`parameters\`, which become the \`event.\` it receives —, \`schedule\` for one the clock starts,
\`<collection>.dateReached\` for one that runs when a date of a record arrives, and \`audit.recorded\` for
one that reacts to an entry of the organization's Audit trail (\`event.severity\`, \`event.action\`,
\`event.entity\`… — requires kernel ${WORKFLOW_AUDIT_SINCE_KERNEL} or later). Only entries a PERSON caused fire it: what the kernel
or an automation writes to the trail never does, which is what keeps the trigger from feeding itself.
Steps that would write back to the trail (${excludedStepList(input.steps, WORKFLOW_AUDIT_EVENT)}) are refused in that workflow —
each step's catalog entry lists the triggers it refuses in \`excludedTriggers\`.

### A workflow that runs on a schedule

\`\`\`ts
workflows: [{
  templateId: 'wf-overdue',
  name: label('workflow.overdue'),
  eventName: 'schedule',
  schedule: { cron: '0 8 * * MON-FRI' },     // weekdays at 08:00, in the organization's time zone
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [/* a \`query\` for the records it is about, then a \`Loop\` over them */],
}]
\`\`\`

The kernel has ONE clock for the whole project, and it wakes a scheduled workflow in every organization
where that workflow exists — which is every organization that installed your extension and has not
deactivated it. You write no Cloud Function, and the organization provisions nothing.

- **\`cron\`** has five fields (minute, hour, day of month, month, day of week; names like \`MON\` and \`JAN\`
  work) or is one of \`@hourly\`, \`@daily\`, \`@weekly\`, \`@monthly\`. It may not fire more often than every
  ${MIN_SCHEDULE_INTERVAL_MINUTES} minutes, and the clock checks every ${WORKFLOW_CLOCK_TICK_MINUTES}: \`0 8 * * *\` starts within ${WORKFLOW_CLOCK_TICK_MINUTES} minutes after 08:00.
  \`validate_plugin\` refuses an expression the clock cannot run, because that workflow would install switched
  on and never fire.
- **The time zone is the organization's** (\`${TIME_ZONE_SETTING}\`). \`schedule.timeZone\` overrides it with an IANA
  name, and in an extension it is almost always wrong: you ship to organizations in other zones, and "at 8"
  means at 8 in each of them.
- **\`event\` carries no record**: only \`scheduledFor\` (the instant the cron named) and \`firedAt\` (when it ran).
  Query what the run is about. \`actor\` is \`null\` — nobody pressed anything, so \`hasPermission\` answers false.
- **A clock that was down fires once, not once per missed time.** A daily workflow that missed three days runs
  one time when the clock comes back.

### A workflow that runs when a date arrives

\`\`\`ts
workflows: [{
  templateId: 'wf-due-soon',
  name: label('workflow.due-soon'),
  eventName: 'invoices.dateReached',
  dateReached: { field: 'dueDate', offset: '-3d', at: '08:00' },   // three days before, at 08:00
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [/* event is the record — the same payload as invoices.saved */],
}]
\`\`\`

Reminders, renewals, overdue charges, triage deadlines: "when this date comes" is the most common schedule in
a business rule, and it is NOT a cron plus a query — the kernel already knows which records are due.

- **\`field\`** is a \`date\` field of the screen that emits the prefix. \`validate_plugin\` refuses any other when
  that screen is in your package.
- **\`offset\`** is whole days: \`-3d\` three days before, \`0d\` on the day, \`+1d\` the day after (up to
  ${MAX_DATE_REACHED_OFFSET_DAYS} either way). To warn at D-3, D-1 and D-0, declare three workflows.
- **\`at\`** is \`HH:mm\` in the organization's time zone, ${DEFAULT_DATE_REACHED_AT} when omitted.
- **Once per record and per date.** The kernel keeps the mark: a record fires once for its date, and fires again
  if the date changes. A record that reaches its day AFTER \`at\` — created today, due today — fires when it is
  saved instead of waiting for tomorrow.
- **Never retroactively.** Dates that arrived before the workflow existed do not fire, and a clock that was down
  recovers at most ${DATE_REACHED_CATCH_UP_DAYS} days.
- **\`event\` is the record**, like \`<collection>.saved\` without \`changeType\` and \`old\`; \`actor\` is \`null\`.

\`schedule\` needs kernel ${WORKFLOW_SCHEDULE_SINCE_KERNEL} or later, and \`dateReached\` ${WORKFLOW_DATE_REACHED_SINCE_KERNEL}. On an earlier
kernel the workflow installs and never fires, so \`validate_plugin\` refuses a package whose \`kernel\` range starts
below the one its trigger needs.

**Listening to another extension.** A workflow may listen to \`<prefix>.saved\` / \`<prefix>.deleted\` of
a collection a **declared dependency** brings. The name is the prefix that screen EMITS — its
\`eventPrefix\`, or its collection when it declares none —, which is not always the collection: a screen
over \`cases\` declaring \`eventPrefix: 'case'\` emits \`case.saved\`. Declare the extension in
\`manifest.dependencies\` (listing \`collections\` is not needed for this, and \`case\` is no collection):

\`\`\`ts
dependencies: { 'com.acme.cases': { version: '^2.0.0', collections: ['cases'] } },
workflows: [{ templateId: 'link-on-case', name: 'Link on new case', eventName: 'case.saved', /* … */ }],
\`\`\`

The prefix is resolved against the screens of your dependencies. **On install**, every package is in
view, and a prefix no declared dependency emits is refused — naming the prefix. **In \`check\`**, the
dependencies are the \`plugin.ts\` files in this workspace and the \`installed-catalog.json\`; a prefix
emitted by an extension you did NOT declare is refused, and one no visible source emits is a warning that
says so (run \`microteia export-catalog\` to close the gap). With no dependency declared at all, there is
nowhere to look, and the trigger is refused.

**\`condition\`** is evaluated once, before any step: \`AlwaysTrue\`, \`FieldComparison\`, \`LogicalAnd\`,
\`LogicalOr\`, \`Not\`, or \`Expression\`.

**Every step input is an \`InputMapping\`**, and the five kinds are the whole of how data moves:

| | |
|---|---|
| \`{ kind: 'Literal', value }\` | a constant |
| \`{ kind: 'Event', path }\` | a path **inside \`event.payload\`** — relative |
| \`{ kind: 'Expression', expression }\` | an expression over the whole context (§9) — there \`event\` **is** the payload: \`event.title\`, never \`event.payload.title\` |
| \`{ kind: 'Output', stepId, outputId }\` | what an earlier step produced |
| \`{ kind: 'Variable', name }\` | a workflow variable |

**Navigating a reference in a workflow.** The rule is the one actions follow (§9): the record a
\`reference\` points at is read only when the path names a field AFTER the reference. In a workflow,
\`event.<reference>\` on its own is the stored id — \`event.caseId\` is \`"k1"\`, never the case —
and \`event.<reference>.<field>\` reads the record it points at: \`event.caseId.court\`. The same holds
for \`{ kind: 'Event', path: 'caseId' }\` and for a \`FieldComparison\`. A \`multi\` reference read on
its own is the list of ids as stored; \`event.calendars.name\` is one name per record it points at.
An empty reference is \`null\` both ways, never an error.

It holds for the whole run, not just for one expression: a step that navigates \`event.caseId.court\`
does not change what another step copying \`event.caseId\` receives. So a \`map\` that mirrors a record
into another (\`caseId: event.caseId\`) writes the id, and a recipient that is a person LINKED to a
member is \`event.responsibleLawyerId.memberId\`, not \`event.responsibleLawyerId\`.

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

**Who wrote it is stamped for you, and cannot be written by you.** An \`upsert\` — the step, a script's
\`upsert()\`, or \`create_record\` / \`update_record\` over MCP — records the author exactly as the form does:
\`createdBy\` / \`updatedBy\` is the \`actor\`'s uid, \`createdByName\` / \`updatedByName\` and the photo come
from the same rule, and \`createdVia\` / \`updatedVia\` says how the write came in — \`"ui"\`, \`"agent"\` or,
with no person behind the run, \`"automation"\` (the author is then \`workflow-engine\`). Every one of those
fields is managed by the system: a mapping or a \`data\` object that names them is refused, or dropped by the
step. So "who registered this" and "typed or by the AI" need no field of yours — read them off the record.

**\`QuerySpec.where\` uses the operator NAMES**, not the symbols: \`eq\`, \`neq\`, \`lt\`, \`lte\`, \`gt\`,
\`gte\`, \`in\`, \`contains\`, \`exists\`. An operator outside that set matches no rows at all — the query
returns nothing and the flow carries on as if the records did not exist.

Ask the MCP server rather than guessing any of this: \`microteia://workflow/steps\` for the catalog,
\`describe_workflow_step\` for one step's exact inputs and outputs, \`list_workflow_events\` for the
trigger names. All three are derived from this installation.

### Waiting inside a workflow — the \`delay\` step

\`\`\`ts
{ id: 'wait', stepDefinitionId: 'delay', type: 'Action', order: 1, enabled: true,
  configuration: { duration: { kind: 'Literal', value: '2d' } } }   // or { until: <a date> }
\`\`\`

It pauses the run and continues it later, IN THE SAME RUN: the execution shows "waiting" with the time it
continues, and the steps after it run then, with the outputs and variables from before.

- **\`duration\`** is \`30m\`, \`4h\` or \`2d\` (up to ${MAX_DELAY_DAYS} days); **\`until\`** is an instant. Exactly one of the two.
  An \`until\` that has already passed does not wait.
- **Only at the top level** of the workflow — not inside a condition branch or a loop body.
- **Only in a run started by an event** (a save, a date, a schedule, a \`call-workflow\` that does not wait). A
  run someone is waiting on — an action's button, a \`call-workflow\` waiting for the result, a test run —
  cannot pause, and the step fails there. \`validate_plugin\` refuses a \`delay\` in a workflow one of your
  actions runs.
- **It continues on the workflow as it is THEN.** Turned off, deleted, or its extension deactivated during the
  wait: the run ends "cancelled", saying why. The steps after the wait are those of the current version.
- \`actor\` comes back as the same person, with no permissions — \`hasPermission\` answers false after a wait.
- Precision is the clock's: it continues within ${WORKFLOW_CLOCK_TICK_MINUTES} minutes of the time.

The \`delay\` step needs kernel ${WORKFLOW_DELAY_SINCE_KERNEL} or later, and \`validate_plugin\` refuses a package that admits an older one.

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
through it: \`validate\` takes \`check\` (a preset), \`pattern\` (with \`flags\`), \`minLength\` and
\`maxLength\` (counted in characters), and an optional \`message\` that replaces the default refusal.
\`list: true\` makes it many.

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
  danger: false,
  enabled: true,
  order: 0,
}]
\`\`\`

\`command\` instead of \`workflowId\` runs one of the platform's own record gestures — present, it wins,
and \`workflowId\` may be left out (\`{ templateId: 'act-copy', key: 'copy', command: 'copyLink', ... }\`).
An action with neither is refused by \`check\`.
The ones the kernel brings are ${codeList(input.recordCommands)}, and anything contributed to
\`ui.record.action\` joins them (\`microteia://record-commands\` on the MCP server answers for this
installation). \`order\`, \`enabled\` and \`danger\` are REQUIRED on every action.
\`activeWhen\` turns the button into a switch that shows the record's current state.
\`promptParameters\` opens the workflow's parameter form before firing, and \`parameterDefaults\` maps
each parameter to an expression, for when the field name on screen is not the parameter name in the
flow — or when the value lives on a record this one points at:

\`\`\`ts
{
  templateId: 'act-generate-deadline',
  workflowId: 'wf-generate-deadline',
  promptParameters: true,
  parameterDefaults: {
    responsibleLawyerId: 'caseId.responsibleLawyerId',   // the lawyer of the CASE, not a copy
    caseNumber: 'processNumber',
  },
  // ...
}
\`\`\`

Each parameter opens with the first of these that answers: the \`parameterDefaults\` expression; the
record's field with the same key; the parameter's own \`defaultValue\` in the workflow. A declared
expression that answers empty skips the same-key field — it was declared not to be that field — but
still falls back to \`defaultValue\`. An expression that throws is reported and the parameter falls
back as if it had none.

A screen offers the action by putting its \`templateId\` in \`cardActionIds\` or \`viewActionIds\`.

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
  for (const invoice of open.results) {                       // { count, results, first }, never an array
    await upsert({ table: 'invoices', id: String(invoice.id), data: { status: 'PAID' } });
  }
  log('closed', open.count);
  return { closed: open.count };
}

main();
\`\`\`

In scope: \`input\` (the declared \`inputParams\`), \`actor\` (as in §9 — \`{ id, name, via }\` or \`null\`),
\`query\`, \`upsert\`, \`remove\`, \`fn.*\` (the expression functions of §9), \`log\` and \`console\`. Nothing else — no \`fetch\`, no \`require\`, no filesystem. The
budget per run is **25 queries, 25 mutations and 10 seconds**; a script that needs more than that is a
Cloud Function (§14), not a script.

**Reading a record by its id** is a filter on \`id\`, in \`query()\` and in the \`query\` step alike:
\`where: [{ path: 'id', op: 'eq', value: someId }]\` for one, \`op: 'in'\` with a list for several. It reads
those documents directly — no scan, no index, no 300-record ceiling — and any other filter in the same
\`where\` is checked against what was read. An id that does not exist is simply absent from \`results\`.

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

## 11. Reports — questions asked of the data

A report is not a screen and not an automation: it is a **question**. What it covers, how it is
folded, what is counted. Declare one in \`reports\` and it shows up in the organization's report list
the moment your extension is installed.

\`\`\`ts
reports: [{
  templateId: 'invoicesByStatus',
  key: 'acme-invoices-by-status',
  title: label('report.invoices'),
  description: label('report.invoices.about'),
  icon: 'fileChart',
  origin: 'plugin',
  spec: {
    v: 1,
    dataset: {
      table: 'invoices',                       // the COLLECTION — a screen your package installs
      where: [{ path: 'status', op: 'neq', value: { kind: 'Literal', value: 'void' } }],
      dimensions: [
        { key: 'month', path: 'dueDate', label: label('report.month'), granularity: 'month',
          timeZone: 'America/Sao_Paulo' },
        { key: 'city', path: 'client.city', label: label('report.city'), sort: { dir: 'asc' } },
      ],
      measures: [
        { key: 'total', op: 'sum', path: 'amount', label: label('report.total'),
          format: { kind: 'currency' } },
        { key: 'count', op: 'count', label: label('report.count') },
        { key: 'late', op: 'sum', path: 'amount', label: label('report.late'),
          filter: [{ path: 'status', op: 'eq', value: { kind: 'Literal', value: 'overdue' } }] },
      ],
    },
    shape: {
      kind: 'matrix',
      rows: [{ dimension: 'city', subtotal: true }],
      columns: [{ dimension: 'month' }],
      values: ['total', 'count'],
      emptyCell: 'blank',
    },
    presentation: {
      chart: { kind: 'bar', category: 'month', series: ['total'], splitBy: 'city', stacked: true },
      prompts: [{ key: 'city', label: label('report.ask.city'), path: 'client.city', op: 'eq' }],
      export: { csv: true },
    },
  },
}]
\`\`\`

Call \`describe_sdk_type ReportSpec\` for the exact shape of the spec and
\`describe_sdk_type ReportModuleTemplate\` for the envelope around it — both expand the types they
reference. \`list_report_options\` (\`microteia://reports/options\`) answers the other half: the folds,
the chart kinds, the date buckets, the measure operations and the capability tokens THIS installation
executes, derived from the kernel rather than from this page.

The fold above is a pivot. The one that answers "WHAT each customer owes" — the records, gathered,
with the total of each group — is a list that groups. Its columns are DIMENSIONS, so the record's own
values are declared as dimensions of the dataset:

\`\`\`ts
dataset: {
  table: 'invoices',
  dimensions: [
    { key: 'number', path: 'number', label: label('report.number') },
    { key: 'dueDate', path: 'dueDate', label: label('report.due') },
    { key: 'amount', path: 'amount', label: label('report.amount') },
    { key: 'city', path: 'client.city', label: label('report.city') },
  ],
  measures: [{ key: 'total', op: 'sum', path: 'amount', label: label('report.total') }],
},
shape: {
  kind: 'tabular',
  columns: ['number', 'dueDate', 'amount'],   // dimension keys — never a measure key
  groupBy: [{ dimension: 'city', subtotal: true }],
}
\`\`\`

### The envelope

| property | what it is |
|---|---|
| \`templateId\` | the stable address of the report inside your package, as with every other artifact |
| \`key\` | how it is ADDRESSED once installed: its tab (\`rep:<key>\`), its deep link, the command palette, and the \`report\` node of the Widget DSL (§6). Unlike a collection name it is **not** rewritten on installation — prefix it with your extension |
| \`origin\` | \`'plugin'\`, always, for a report your package brings |
| \`icon\` | one key of the icon catalogue (§4) |
| \`enabled\` | \`false\` installs it hidden: declared, not offered |
| \`spec\` | the report itself — everything below |

A report your package brings is **managed**: its spec is read-only in the organization's designer, and
the gesture there is to duplicate it. That is not borrowed from how screens behave, it is the opposite
of it, and on purpose: a screen merges because a field is an independent unit with an owner of its
own, while a report is a single assertion — half of your package plus half of somebody's edit is a
number nobody wrote.

### Three layers, and why the split is the contract

\`dataset\` is the **semantic layer**: where the rows come from, what can be grouped
(\`dimensions\`) and what can be measured (\`measures\`). \`shape\` is the **fold**. \`presentation\`
is the **look**.

\`shape\` and \`presentation\` never repeat a path — they **cite a key**. That indirection is what
buys you years: swapping the measured field, changing the period, promoting a measure to a computed
one, are all a change inside one \`dataset\` entry, and nothing else moves.

The split is also what decides how an OLDER kernel treats your report:

| Where the unknown thing is | What happens |
|---|---|
| \`presentation\` | ignored, the rest renders |
| \`shape\`, \`dimension.granularity\` | degrades to the documented fallback, **with a visible warning** |
| \`dataset\`, \`measures\` | the report is **refused**, naming the token |

That asymmetry is deliberate. A discarded chart shows *less*; a discarded measure shows **a
different number under the same label**, and no reader can notice that. So write the numbers you
mean, and treat a refusal as the platform telling you it cannot answer for them.

### The vocabulary

- \`measures[].op\`: ${inlineList(MEASURE_OP_NAMES)} — the same words a field aggregate uses, minus \`latest\`, which copies a value instead of computing a number. \`path\` is required except for \`count\`; \`count\` with \`distinct: true\` and a \`path\`
  counts distinct values. \`filter\` restricts one measure and only it — that is how one column counts
  everything and the next counts only what is overdue, in the same table.
- \`measures[].kind: 'computed'\` with an \`expression\` over OTHER measures of the same report, by key
  — \`won / count * 100\`, \`total / quantity\`. It is evaluated AFTER aggregation, on every row,
  subtotal, pivot cell and total, so a ratio is the ratio of that group's totals and never the average
  of per-record ratios. It sees measures only, never the record; a measure it cites does not have to
  be in \`values\`. A cited measure with no value, a division by zero or a non-numeric result leave
  the cell empty instead of inventing a number. Citing a name that is not a measure, or a cycle
  between computed measures, refuses the report.
- \`measures[].format\`: \`{ kind, decimals, preset }\`. \`kind\` is \`number\`, \`integer\`,
  \`currency\`, \`percent\`, \`date\` or \`duration\`; \`preset\` names an entry of the SAME field-rule
  preset catalogue a field uses, never a parallel one. \`percent\` prints the number as it is,
  followed by \`%\` — a ratio has to be multiplied by 100 in its expression.
- \`dimensions[].granularity\`: ${inlineList(REPORT_GRANULARITIES)}. Only meaningful over a date. **Set \`timeZone\`**: without it the bucket is cut in UTC, and a sale at nine at night
  on the 31st lands in the wrong month — with nothing on screen saying so.
- \`dimensions[].path\` may cross a reference (\`client.city\`), same grammar as a query projection.
- \`dimensions[].sort\`: \`{ dir: 'asc' | 'desc' }\` orders that level's members. \`limit\` keeps the
  first N of them, and what it drops does not reappear anywhere — while the grand total still counts
  every row scanned. So a limited level marks the result **partial**, and the platform says so on
  screen, in the CSV and on the printed page, because rows that do not add up to their own total are
  the one thing a reader cannot catch.
- \`shape.kind\`: ${inlineList(REPORT_SHAPE_KINDS)}. **Grouping and showing are two different
  questions, and the fold decides how the second one is answered — never whether the first one was
  asked.** Every fold groups by \`{ dimension, subtotal? }\` levels, outermost first; what changes is
  what the fold does with the levels and with the dimensions that are NOT levels:

  | fold | one row is | the levels are | the other dimensions |
  |---|---|---|---|
  | \`tabular\` | a RECORD | \`groupBy\`, optional | \`columns\` |
  | \`summary\` | a GROUP | \`groupBy\`, required | shown nowhere — you are warned by key |
  | \`matrix\` | a group × a column | \`rows\` (and \`columns\`) | shown nowhere — you are warned by key |

  - \`tabular\`: one row per record. \`columns\` is an array of **dimension keys**, plain strings, in
    column order — a measure key there is a named error. \`orderBy\` is done by the query.
    \`groupBy\` breaks the list into groups **without giving up the columns**: each group opens with
    the value of its dimension, its records follow with the same columns as always, and the group's
    total closes it. That is the report that answers "WHAT each customer owes"; \`summary\` answers
    "HOW MUCH", and the difference is whether the records survive. Put a dimension in \`groupBy\` and
    leave it OUT of \`columns\` — repeating it on every detail line writes the same value under the
    band that just said it.
  - \`summary\`: \`groupBy\` is required and \`values\` is an array of measure keys. The records do
    not appear at all — only one row per group, with its numbers. A \`summary\` with an empty
    \`groupBy\` is refused: there would be nothing to group, and it would render as "no data" over a
    full collection.
  - \`matrix\`: \`rows\` and \`columns\` are those same level objects and BOTH are required. This
    version reads one level of \`columns\`; more than one is flattened, with a warning.
    \`emptyCell: 'zero'\` writes a zero where nothing happened — the default leaves it blank, because
    "there was none" and "there was, and it came to zero" are different statements.
  - \`grandTotal: false\` drops the total row, on \`summary\` and \`matrix\`.
  - **Declare only the dimensions the fold uses.** One that is neither a level nor a column is shown
    nowhere, and the platform warns whoever opens the report, naming it. It is a warning and not a
    refusal because the numbers stay right — but a field that silently vanishes reads as lost data.
- \`presentation.chart.kind\`: ${inlineList(REPORT_CHART_KINDS)}. \`category\` is the dimension on the
  categorical axis, \`series\` the measures drawn (absent: all of \`values\`), \`splitBy\` a second
  dimension that breaks each measure into one series per member — the pivot's columns becoming the
  legend — and \`stacked\` piles them instead of setting them side by side. A kind this version cannot
  draw simply does not appear; the table still shows the same data.

  **\`splitBy\` names a level the fold already has.** Either the grouping level right below the one on
  the axis — \`groupBy: [month, city]\` with \`category: 'month'\`, \`splitBy: 'city'\` — or, on a
  \`matrix\`, the other side of the pivot: a column grouping when the axis is a row level, a row level
  when the axis is the columns (the example above, and the pivot's default axis). Every bar is then
  one row or one cell the fold already computed, so an average stays an average. In a \`summary\` or a \`matrix\`, a level that is not the last needs
  \`subtotal: true\` to have rows at all. A pie or a donut draws one figure and ignores \`splitBy\`.
  Anything else is warned by key and the chart is drawn without the breakdown — the platform never
  adds rows up to make one.

  **A chart plots GROUPS, so the fold has to have them.** It reads one level of \`groupBy\` /
  \`rows\` — the one \`category\` names, or the innermost when it names none — and one point comes out
  of each member of that level, with the measures of that group as its values. So a \`summary\`, a
  \`matrix\` and a \`tabular\` **with** \`groupBy\` all draw; a \`tabular\` with no grouping does not,
  and declaring a chart on one is warned rather than rendered as an empty frame beside a full table.
  If you want the chart, group the list — you keep the records either way.
- \`dataset.scanLimit\` asks for a smaller scan than the ceiling. Asking for a bigger one is clamped,
  never refused.

### The question the report asks the reader

\`presentation.prompts\` is the filter the READER fills in before running — the difference between one
report and the same report per customer, per period, per city.

\`\`\`ts
prompts: [
  { key: 'from', label: label('report.ask.from'), path: 'dueDate', op: 'gte' },
  { key: 'client', label: label('report.ask.client'), path: 'clientId', op: 'in' },
]
\`\`\`

Each prompt names a \`path\` and an \`op\`, and an answered one becomes one more predicate on top of
\`dataset.where\`. How it is asked comes from the FIELD the path points at — a date asks with a date
picker, a reference asks with the record chooser of the collection it points to, an option list asks
with its options. You do not choose that, and you should not try to: it is the same control the
organization already knows from the screen the data came from.

**A prompt left empty simply does not filter.** \`required\` and \`default\` are in the contract and
this version acts on neither, so a report that would be wrong unrestricted needs its restriction in
\`dataset.where\`, where nobody can skip it.

### The question asked of each row

\`dataset.where\` compares one path with one value, and that is what makes it cheap: an equality goes
down to the database. \`dataset.includeWhen\` is the other half — an EXPRESSION (§9), evaluated over
each row, and the row enters the report when it answers true.

\`\`\`ts
dataset: {
  table: 'invoices',
  where: [{ path: 'status', op: 'neq', value: { kind: 'Literal', value: 'void' } }],
  includeWhen: 'paid < amount and dueDate < today()',
}
\`\`\`

Reach for it when no list of predicates can write the question: two fields compared with each other,
an arithmetic check, a date read against today, an OR between two ANDs. The scope is the row — the
fields at the root, a reference navigated by the name of the record it points at (\`client.city\`), and
\`id\`. Compare a reference through the record it points at (\`client.id\`), never through the raw path:
the row arrives with the pointed record in place of the id, so comparing the raw path with an id finds
nothing.

Three properties follow from where it runs, and each one matters:

- **It only narrows.** It is evaluated in memory over what the scan brought back, so it never widens
  the read and the scan ceiling keeps its meaning. Keep the cheap part of the question in
  \`where\` — that is the part the database answers.
- **Every path it names is read data.** It joins the hydration plan and the permission check like any
  other path, so \`client.city\` in an expression asks for the read of the pointed collection exactly
  as grouping by it would.
- **An expression that cannot be answered refuses the report.** Not the row — the report. This is the
  one place where swallowing a failure produces a SMALLER total under the same label, and no reader can
  catch that. A path the record has no value for is not a failure: it is \`null\`.

It lives in \`dataset\`, so an older kernel that does not execute it **refuses** the report by the name
of the token (\`dataset.includeWhen\`) rather than summing the rows it would have excluded.

### What is refused, and what is only warned about

The same function checks a report before it is packaged, before it is saved and before it runs — there
is no path where one accepts what another rejects. It is **refused** when:

- it declares no measure. A report with no number has nothing to say, a \`tabular\` one included;
- \`shape\` cites a dimension or measure key that \`dataset\` does not declare, or a \`tabular\` column
  that is a measure;
- a \`summary\` groups by nothing, or a \`tabular\` is left with no column at all — including the case
  where every dimension it declares went into \`groupBy\`, which the refusal names separately, because
  "add a column" has nothing to teach whoever grouped by the only field they had;
- a \`matrix\` is missing its rows or its columns;
- two keys collide — dimensions and measures share ONE namespace, so that \`values\` can never be
  ambiguous;
- a measure other than \`count\` has no \`path\`;
- \`dataset.includeWhen\` is not a valid expression, or names a path the schema cannot walk;
- \`dataset.table\` is not a collection this installation has.

Everything else is a **warning**, and warnings are visible — to you in \`validate_plugin\`, and to
whoever opens the report. A chart citing a key nobody declared, a chart on a list that groups by
nothing, a dimension the fold shows nowhere, a bucket over something that is not a date, a scan above
the ceiling, and every property this version reads but does not act on, all arrive that way rather
than as silence.

**A path no field declares is accepted** — by design. In an installation it may be a field the
organization created in the Form Design, and refusing it would break the report they built. So a typo
(\`responsibleId.nmae\`) installs, runs, and comes out as an empty column. \`check\` and \`validate_plugin\`
close that gap from where they stand: every path of your reports and of your \`query\` steps is walked
against the screens this directory sees — your own, the \`plugin.ts\` files beside it and the
\`installed-catalog.json\`, the same sources that resolve an event prefix — and one that leaves the schema
on a collection whose screen is in view is a **warning**, naming the collection and the field. A
collection with no visible screen is not checked.

### What you do not control, and should not try to

**Permission.** Running a report charges, on the server, the read permission of every collection it
touches — including collections reached through a reference. Grouping by \`client.city\` requires
\`clients.read\`. You do not declare that and cannot opt out of it: the list is derived from the
hydration plan, so a package cannot hide a hop by declaring less.

A report may carry a permission of its OWN — \`spec.access.permission\`, with \`requires\` for what it
depends on (§13). It only ever restricts: seeing the report takes that permission AND the read of
every collection it touches. It cannot grant, and that is the whole reason creating a report is
allowed to be cheap.

**The scan ceiling.** The query is index-free by design, so it walks documents with a ceiling. A
report covering more than that comes back marked partial, and the platform says so on screen, in the
CSV header and on the printed page. Do not work around it — a partial number presented as a total is
the one failure a reader cannot catch.

**The collection name.** \`dataset.table\` is the \`key\` of a screen your package installs, and the
installation rewrites it: the name can take a suffix in an organization that already uses it. Paths
are NOT rewritten, because a path never names a collection. Point at a collection your package
carries, or one a declared dependency brings — the package gate refuses anything else.

**\`requires\`.** Derived from the spec, never written by hand. It is what lets a kernel refuse your
report by the NAME of the feature it lacks instead of running it without that feature and returning a
different number under the same label. Leaving it out is correct; writing it short is the one way to
defeat that gate, so the package gate refuses a \`requires\` that omits anything the spec uses.

### Putting one somewhere other than the report list

A report is a page of its own, and it is also a node: \`{ type: 'report', report: '<key>' }\` places it
in any Widget DSL tree (§6). A \`grid\` of those nodes is a dashboard — declared, with no code in it
and nothing for anybody to review.

### Writing a report in code

When the declared shape is not enough — a cover page, text between sections, two datasets side by
side — write a view and compose \`@microteia/report\`: \`useReport\`, \`ReportView\`,
\`ReportTable\`, \`ReportMatrix\`, \`ReportChart\`. They are the same components the platform uses,
so this is composition, not reimplementation.

The report still needs its \`dataset\`: code replaces the **presentation**, never the data. Numbers
arrive through \`useReport\`, which asks the server — and that is where permission is charged. A view
is \`impl: { kind: 'code' }\`, so it waits for an administrator to read and trust it (§7).

### What the contract names but this version does not run

\`schedule\` (running on a timer) and \`dataset.kind: 'join'\`. Declaring one is not silently ignored: the platform refuses the report by
the name of what it lacks.

These are read and not acted on, and each says so as a warning rather than doing nothing:
\`shape.limit\`, \`presentation.fields\`, \`presentation.drillDown\`, \`presentation.export.fileName\`
(the file is always offered, and its name comes from the title), \`prompts[].control\`,
\`prompts[].required\`, \`prompts[].default\`, and \`dimensions[].sort.by\` — of \`sort\`, only
\`dir\` is read, and members are ordered by their key.

Reading any of this here is how you know it is coming, not permission to use it yet.

## 12. Documents — templates generated from a record

A document template — a power of attorney, a fee agreement, a receipt, a notice — is **data**: a
\`document.template\` contribution, no code, no trust gesture. The organization generates it from the
record (the "Generate document" gesture) or from an automation (the \`render-document\` step), and the
file lands in that record's Documents tab or in Downloads. Requires kernel \`^${DOCUMENT_TEMPLATE_SINCE_KERNEL}\`.

\`\`\`ts
import { documentTemplateContribution } from '@microteia/sdk';

contributes: [
  documentTemplateContribution({
    key: 'acme-payment-plan',               // the address; the organization's template on the same key wins
    title: label('template.payment-plan'),  // a message reference, like every label
    collection: 'acmeAgreement',            // the screen key as you declared it...
    screenSourceId: 'acme:agreement',       // ...and its sourceId, which wins: installed keys can get a suffix
    format: 'markdown',
    body: PAYMENT_PLAN,                      // the text below
    fileName: 'Payment plan - {{party}}',
    datasets: [{ name: 'installments', from: 'acmeInstallment', fromSourceId: 'acme:installment',
                 via: 'agreement', orderBy: 'dueDate' }],
  }),
],
\`\`\`

Where the file goes is the template's default, and whoever generates it may ask for the other:

- \`destination: 'record'\` (the default) attaches it to the record's Documents tab. The screen must
  declare \`hasDocuments: true\` — without the tab there is nowhere to attach the file, and the generation
  refuses instead of sending it elsewhere.
- \`destination: 'downloads'\` saves it to the organization's Downloads, a temporary area that needs no
  tab: a receipt to hand over, a statement to send. \`retentionDays\` (0 to ${DOWNLOAD_RETENTION_MAX_DAYS}, 0 = never
  expires) overrides the organization's retention setting; past it, the file is deleted.

Both fields require kernel \`^${DOCUMENT_DESTINATION_SINCE_KERNEL}\`; an older kernel ignores them and attaches.

### Templates of data — \`source: 'payload'\`

Not every document is about a record. A template with \`source: 'payload'\` has no screen: whoever
generates it — an automation, an AI agent — sends the data, and the paths start at that object. It
goes to Downloads unless whoever generates it says which record owns it (\`belongsTo\`, below), and
generating it needs the \`documents.generate\` permission.

\`\`\`ts
documentTemplateContribution({
  key: 'acme-quote',
  title: label('template.quote'),
  source: 'payload',
  collection: '',                           // no screen
  format: 'markdown',
  body: QUOTE,                              // {{customer.name}}, {{#each lines}}…{{/each}}
  parameters: [
    { key: 'customer', label: 'Customer', type: 'EntityReference', entityType: 'acmeCustomer', required: true },
    { key: 'lines', label: 'Lines', type: 'Object', list: true, fields: [
      { key: 'description', label: 'Description', type: 'String', required: true },
      { key: 'amount', label: 'Amount', type: 'Number' },
    ] },
  ],
  sample: { customer: '', lines: [{ description: 'Setup', amount: 100 }] },
}),
\`\`\`

- \`parameters\` are the parameters of a called automation — types ${DOCUMENT_PARAMETER_TYPES.map((type) => `\`${type}\``).join(', ')},
  \`Object\` + \`fields\` for nesting, \`list\` for collections, \`required\` and \`rules\`. A missing
  required parameter refuses the generation; without parameters any object is accepted as it comes.
- A first-level \`EntityReference\` takes the record id and is hydrated like a reference field:
  \`{{customer.name}}\` reads the record. Reading it charges \`<collection>.read\` of whoever generates.
- No \`datasets\` and no \`destination: 'record'\` in the template — it has no record of its own. The
  payload is at most ${DOCUMENT_PAYLOAD_MAX_BYTES / 1024} KB of JSON. \`sample\` is what the preview merges.
- The \`render-document\` step offers each parameter as its own input (\`param.<key>\`), plus a \`payload\`
  input for a whole object.

**Where the file lives — \`belongsTo\`.** A document with sources almost always has a record it
belongs to, and the same template may be generated from more than one screen. So the home is decided
by **whoever generates**, not by the template: the \`render-document\` step (and the agent's
\`render_document\`) takes \`belongsTo\`, the key of one of the template's single \`EntityReference\`
parameters.

\`\`\`ts
configuration: {
  templateKey: { kind: 'Literal', value: 'acme-quote' },
  'param.customer': { kind: 'Event', path: 'customerId' },
  belongsTo: { kind: 'Literal', value: 'customer' },     // the parameter whose record owns the file
  destination: { kind: 'Literal', value: 'record' },     // attach it to that record's Documents tab
},
\`\`\`

- With \`destination: 'record'\` the file is attached to that record. Its screen must have the Documents
  tab, and an agent or a person generating needs \`<collection>.update\` on it — the same as attaching.
- With Downloads, that record is remembered as the file's **origin**, and "Attach to a record" suggests
  it: the copy that goes out to be signed comes back to the right place. Without \`belongsTo\`, the first
  filled single reference is the suggested origin — and only that: attaching never guesses.
- A list reference, an empty one, or a key that is not a reference is refused, and so is
  \`belongsTo\` on a record template, whose document already belongs to its record.

\`belongsTo\` requires kernel \`^${DOCUMENT_BELONGS_TO_SINCE_KERNEL}\`.

Requires kernel \`^${DOCUMENT_PAYLOAD_SINCE_KERNEL}\`; an older kernel finds no screen and drops the template.

### The grammar

What sits between \`{{ }}\` is a **field expression** (§9): the same paths (\`{{agreement.party.name}}\`
follows references), the same functions (\`formatDate\`, \`formatMoney\`, \`upper\`, \`round\`…). The
grammar adds only what an expression cannot say: ${DOCUMENT_BLOCKS}.

\`\`\`md
# Payment plan

**Party:** {{party}} — signed on {{formatDate(signedOn, "DD/MM/YYYY")}}

| # | Due | Amount |
|---|---|--:|
{{#each installments}}| {{index}} | {{formatDate(dueDate, "DD/MM/YYYY")}} | {{formatMoney(amount)}}{{#if paid}} (paid){{/if}} |
{{/each}}

<!-- pagebreak -->
\`\`\`

- Inside a loop the item's fields are at the root, the record's are still readable, and ${LOOP_VARIABLES}
  are reserved: \`item\` is the whole element (the only way to read a list of plain texts), \`index\` the
  position counting from 1.
- There is no \`else\`: write the opposite condition, \`{{#if not paid}}\`. A Word template is rendered by a
  different engine, and what one format cannot say the other does not offer.
- A reference alone (\`{{client}}\`) prints nothing — it is a whole record. Write the field you mean:
  \`{{client.name}}\`.
- A merged value is **text**, never markup: a party called \`A*B\` does not open bold.
- \`#\` is the document title (centered), paragraphs are justified, and GitHub tables, lists, bold,
  italics and \`---\` work. \`<!-- pagebreak -->\` starts a new page.
- An expression that fails leaves its place **empty** and the generation reports it — the step
  publishes \`emptyFields\`. A malformed block is refused by \`documentTemplateIssues\`, which is what the
  package gate runs.
- Formatting functions without a locale argument speak the **organization's** language and time zone,
  not the language of whoever pressed the button: the document is theirs.

### Lists of child records — \`datasets\`

A loop repeats a list. A list field of the record works as is; records of ANOTHER screen that point
here come from \`datasets\`, in the vocabulary of an aggregated field: \`from\` (the child screen), \`via\`
(its reference field to this record), \`orderBy\`, \`direction\`, \`limit\` (at most 100 — more than that is
a report, §11). Address \`from\` by \`fromSourceId\` for the same reason as the screen.

### Formats

| Template | Produces |
|---|---|
${DOCUMENT_OUTPUT_TABLE}

A Word template carries the \`.docx\` in base64 (\`content\`, at most ${DOCUMENT_TEMPLATE_MAX_KB} KB
decoded) and the fields are written inside the document itself, with the same grammar. Converting Word
to PDF needs an office engine the platform does not run, so that pair is refused when you declare it,
not when someone generates.

### Who wins

1. Among packages, the first contribution of a key in registry order (priority, then plugin id).
2. The organization's own template on the same key replaces yours — "Customize" copies yours there,
   and deleting the copy brings yours back.
3. The organization can turn a key off without uninstalling you.

Your template is never copied into the organization: it lives while your extension is installed and
enabled, and an update replaces it. A template whose screen is not installed is simply not offered.

The example \`document-example\` is all of the above in one package.

## 13. Access — declare capabilities, never roles

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

## 14. When your extension needs the server

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
guard is refused before it goes up, and so is one whose guard names a different extension's id — the
copy-and-paste case, where the trigger fires and the handler silently never runs. The refusal is of that
one function: everything else deploys, and the command ends in an error naming it. So a source sitting
in this workspace for an extension nobody has installed blocks nothing — the Console reports it on every
\`provision\`, and refuses it the day somebody installs the extension and it is asked to go up. The check reads
your source, so the guard may also sit in an identifier beside the trigger
(\`const gated = forInstalledExtension('com.acme.crm', handler)\`); what it will not accept is a comment
that mentions it.

\`npx microteia-plugin create function\` asks what sets your function off, and writes the guard for you
when the answer is a saved record.

It costs one cached document read per organization per minute, and it fails closed: an event whose path
carries no \`{tenantId}\` is skipped and logged.

\`isExtensionInstalled(tenantId, pluginId)\` is there too, for when you want the answer rather than a
refusal.

### A callable of yours owes three refusals

\`\`\`ts
import { onCall } from 'firebase-functions/v2/https';
import { requireInstalledExtension } from 'microteia-functions/office';

export const acmeQuote = onCall({ region, cors: true }, async (request) => {
  const { tenantId, ...input } = request.data;
  const uid = await requireInstalledExtension('com.acme.crm', tenantId, request);

  return quoteFor(input);
});
\`\`\`

The caller signed in, the caller belongs to that organization, and your extension is installed and active
there. It returns the caller's uid.

The middle one is the one that is not obvious, and it is why this is a refusal rather than advice. **The
deploy makes every callable publicly invocable** — it grants \`allUsers\` the \`roles/run.invoker\` role
on each one — so what stands between your function and the internet is the Firebase token check and
nothing else. Your screen going away with your extension closes nothing: the endpoint answers ANY
signed-in user of this project, from any organization, whether or not they installed your extension. And
the organization arrives in the **payload**, because \`useCallable\` sends only what your screen passed —
so without the check, a user of one organization can point your function at another.

It throws rather than returning a boolean, deliberately: a \`false\` invites being ignored, and the
missing \`if\` leaves no symptom at all. The errors are \`HttpsError\`, so they reach your view as errors
and not as a broken response. The check reads the whole file, so the guard may sit in a handler you
extracted — which is what §"Write the handler thin" asks you to do.

### A schedule of yours loops over the organizations instead

**First, ask whether you need a function at all.** A routine that reads and writes records on a timer is a
workflow with \`eventName: 'schedule'\` (§10): the kernel clock runs it in every organization that has it,
stops it when the extension is deactivated, and asks nobody to provision anything. A Cloud Function on a
timer is for what a workflow cannot do — calling an outside service with a secret, say.

A scheduled run, a Pub/Sub message, an HTTP request and a Storage event carry no \`{tenantId}\` in their
path. There is no organization for \`forInstalledExtension\` to ask about, and because it fails closed,
wrapping one of these in it leaves your function **inert even while your extension is installed** — it
deploys, it fires, and nothing ever happens. Leaving it unguarded is the other wrong answer: the run acts
on every organization in the project.

\`\`\`ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { forEachInstalledOffice } from 'microteia-functions/office';

export const acmeNightly = onSchedule(
  { schedule: 'every day 03:00', region },
  async () => {
    await forEachInstalledOffice('com.acme.crm', async (tenantId) => { /* ... */ });
  },
);
\`\`\`

It reads one document per organization, once per run, and asks exactly what the trigger guard asks — a
deactivated extension counts as not installed. It returns how many organizations it ran in. One
organization failing does not take the others' turn: every installed organization runs, and the function
then fails naming the ones that did not, so a bad record in one place cannot silently suspend the routine
everywhere else and a failure cannot pass unnoticed either.

**This too is a refusal.** One of these functions in your \`functions/\` without the loop is refused
before anything is deployed, and so is a loop that names another extension's id. The check reads the
whole file, not just the call, because the loop legitimately sits inside the handler and may be a couple
of calls deeper.

\`npx microteia-plugin create function\` writes it for you when you answer "a clock".

Two rules follow from how a Firebase project works, and both are refusals rather than warnings:

- **A \`defineString\` with no value refuses the deploy of *every* function in the project**, not just
  yours — \`firebase-functions\` validates parameters globally. The Console lists every one it finds in
  \`.env.<projectId>\`, empty, so filling it in is the only step left.
- **One installation, one \`node_modules\`.** Two extensions asking for different ranges of the same
  package is refused, because nothing decides between them. A range the platform already pins is kept:
  the runtime is the platform's choice, and one extension may not move it for the others.

### A function several extensions share

It goes in \`../functions/\` instead, next to \`microteia.yaml\`. No single extension owns it, so
**naming one in your \`manifest.backend.functions\` is refused**: the claim would change nothing while
your extension is installed, and the day it is uninstalled the function turns into an orphan — deleted by
\`--prune\`, put back by the next deploy, with whoever else depended on it losing their backend in a
window nothing explains. If the function is really yours, move it into your own \`functions/\`.

What replaces the claim is a declaration of **who it serves**, in \`functions/package.json\`:

\`\`\`json
{
  "microteia": {
    "serves": {
      "acmeRecalcTotals": ["com.acme.crm", "com.acme.billing"]
    }
  }
}
\`\`\`

That single line is what lets the platform treat it like any other extension artifact: it is deployed
while **any** of those extensions is installed somewhere in the project, and withdrawn once none of them
is. Any one of them is enough, and that is the only sensible rule — the function exists because more than
one extension needs it, so requiring all of them would make uninstalling one switch off the others.

Guard the trigger with the same list:

\`\`\`ts
export const acmeRecalcTotals = onDocumentWritten(
  { document: 'tenants/{tenantId}/invoices/{id}', region },
  forAnyInstalledExtension(['com.acme.crm', 'com.acme.billing'], async (event) => { /* ... */ }),
);
\`\`\`

**Declared and unguarded is refused** the moment it is deployed, and so is a guard naming an extension
the function does not declare serving: the two lists answer the same question — \`serves\` decides the withdrawal, the guard
decides the execution — and one of them being wrong makes the function act where it can no longer be
withdrawn. Guarding by just one of the declared extensions is fine; the list is the ceiling, not the
floor.

A shared function with **no** \`serves\` still works exactly as before: deployed with every
\`microteia deploy\`, and nothing withdraws it — not even \`--prune\`. Nothing is refused there either,
because without ids there is no guard to ask for. The Console does list them on every \`provision\`, so
whoever inherits the installation can see which functions sit outside the mechanism.

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

## 15. Size

| | |
|---|---|
| Warning | ${kib(input.advisoryBytes)} |
| Refused | ${kib(input.maxBytes)} |

A package is stored as a single document. If you are near the limit, the usual cause is code that
should be several extensions, or a seed list that should be data.

## 16. Testing, and asking the installation

\`validatePluginPackage\` is exported from \`@microteia/sdk\` — the same function \`check\` calls. Keeping
it in a test means a broken package fails in a second, on your machine:

\`\`\`ts
import { fileURLToPath } from 'node:url';
import { buildPlugin } from '@microteia/sdk/node';

it('installs cleanly', () => {
  const built = buildPlugin({ entry: fileURLToPath(new URL('./plugin.ts', import.meta.url)) });
  expect(built.issues).toEqual([]);
});
\`\`\`

It validates the BUILT package — \`buildPlugin\` does exactly what \`build\` does, inlining every
\`sourceFile\` first, and its \`issues\` are \`validatePluginPackage\` over the result. Calling
\`validatePluginPackage\` from \`@microteia/sdk\` directly is the same check for a package that is
already built, which an authored one with views or a \`startup\` list is not.

A report over the screens of SIBLING extensions can be held to them in a test, which makes the warning
above a failure. \`packagesSchemaContext\` builds the schema of a set of packages — their screens, the
fields one adds to another's screen, their lists — and \`undeclaredReportPaths\` (or \`undeclaredQueryPaths\`)
asks the question \`check\` asks. \`catalogSchemaContext\` does the same from screens already in catalog form:

\`\`\`ts
import { packagesSchemaContext, undeclaredReportPaths, validateReportSpec } from '@microteia/sdk';
import { contactsPlugin } from '../contacts/plugin';
import plugin from './plugin';

const ctx = packagesSchemaContext([plugin, contactsPlugin]);

it.each(plugin.reports ?? [])('$key reads only declared fields', (report) => {
  expect(validateReportSpec(report.spec, { schema: ctx })).toEqual([]);
  expect(undeclaredReportPaths(report.spec, ctx)).toEqual([]);
});
\`\`\`

The MCP server answers from **this installation** rather than from a snapshot of documentation, which
is why it is worth asking before writing:

| | |
|---|---|
| \`validate_domain_model\` | the domain model, checked deterministically. An ERROR stops the work |
| \`generate_artifact_plan\` | what must exist, reconciled against what is already here |
| \`validate_plugin\` | the platform's verdict, after every edit — including every reference to another extension, against what its owner exports |
| \`build_plugin\` | the \`.json\`, without writing it |
| \`describe_sdk_type\` | the exact declaration of any authoring type — \`TemplateField\`, \`WidgetSpec\`, \`WorkflowStep\`, \`PluginManifest\`, \`AuthoredPlugin\` |
| \`describe_host_module\` | what a curated module really exports, for a view or a \`startup\` |
| \`describe_workflow_step\` | one step in full: required inputs, accepted mapping kinds, composite shape, outputs |
| \`describe_extension\` | what ONE extension declares, brings and requires, from the compiled package — how "how is X done?" gets answered without reading a whole \`plugin.ts\` |
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
| \`microteia://referenceable\` | every artifact another extension exports that you may point a step at, already in the form the reference takes (§3) |
| \`microteia://nav-groups\` | every sidebar group this directory can see, by key, with its name in each language and who declares it — read it before declaring a group |
| \`microteia://examples\` | the first-party extensions in \`examples/\`, and which mechanism each is the best one to read for |
| \`microteia://example-coverage\` | every mechanism of this platform against those examples: which have one, which have none, and which are out of reach for an extension |
| \`microteia://workspace/plugins\` | the extensions authored here, with their current problems and what each one exports |
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
which extensions are installed, and **what each of them declares in \`manifest.exports\`**. Run it from
the installation root (where \`microteia.yaml\` is); with no \`--tenant\` it lists the offices in the
project rather than guessing one. It is **git-ignored**, because it carries screen and field names the
organization typed: that is tenant data, not a product artifact.

The exported surface is what makes §3 usable from here. Without it you knew an extension was installed
and had no way to learn the name of anything inside it — and a name you cannot see is a name you cannot
write. The whole list, from both sources, is the resource \`microteia://referenceable\`; every answer that
carries a \`catalogSources\` block repeats it, already in the form the reference takes:

    com.example.utils/normalize-tax-id — Normalize tax id (script)

The \`kind\` is the part that decides where it fits: a script goes in \`scriptId\`, an automation in
\`targetWorkflowId\`. What the artifact DOES never travels — the steps and the code are behaviour, and
the snapshot is shape. The name and the kind are contract.

A snapshot taken by a Console older than this field carries no surface at all, and the answer says so
rather than presenting an empty list as "these extensions export nothing". Re-run \`export-catalog\` with
the Console that came with the installation.

One thing the snapshot cannot cover, and it is the most common: the extension being authored **beside
yours in this directory**, which is installed nowhere and therefore in no snapshot. Its surface is read
from its own \`plugin.ts\`, and there an empty \`exports\` is an answer rather than a silence — the package
is right here.

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
import { buildDomainCatalog, parseDomainModel, validateDomainModel } from '@microteia/sdk';
import MODEL from './domain-model.json';

it('stays modelled', () => {
  const parsed = parseDomainModel(MODEL);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  const issues = validateDomainModel(parsed.model, buildDomainCatalog()).issues;
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

So when a rule needs one of them — the \`query\` step, a clock, a page, which record an effect
writes — say so and hand the decision back. Translating it into something that looks similar is the one failure
mode this whole subsystem exists to prevent.

Read \`examples/\` for first-party extensions in source form — they are the very source that produces
the \`.json\` the platform installs, so nothing in them is a simplification. Between them they cover
screens, fields, lookups, patches, views wired to pages, \`startup\`, translation and themes.

Which one, though, is a question the folder names do not answer. \`microteia://examples\` does: it lists
what is here and says which MECHANISM each one is the best one to read for. And \`describe_extension\`
answers what any one of them declares, brings and requires without your reading it line by line — the
points it contributes to, the points it declares for others, its screens and collections, its exported
surface, and what it demands of the Firebase project. Neither is prose written beside the code: both
are the package itself, compiled here.

For automation, read \`examples/automation-example/\` first. It exists for that reason and nothing
else: a workflow triggered by a save, a \`Condition\` node that branches and converges, a \`query\`, a
\`map\` feeding an \`upsert\` that stays idempotent on a second run, a \`workflow.called\` flow with
parameters, and an action with \`promptParameters\` that asks a person before firing. Every id in it is
one \`microteia://workflow/steps\` would give you, and the package validates — which is the whole point of
reading an example instead of a snippet.
`;
