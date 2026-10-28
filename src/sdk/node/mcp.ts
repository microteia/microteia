import { existsSync, readFileSync } from 'node:fs';
import { KERNEL_EXTENSION_POINTS } from '../../domain/schema/extensionPoints';
import { join, relative, resolve } from 'node:path';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { THIRD_PARTY_IMPL_KINDS } from '../../domain/schema/plugin/extensionPoint';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { parsePackage } from '../../domain/usecases/plugins/packageSerialization';
import { validatePluginPackage } from '../validate';
import { buildPlugin } from './compile';
import { hostModuleBlock, hostModuleNames, hostTypesPath, readHostTypes } from './hostTypes';
import { referencedSymbols, sdkDeclaration, sdkSurfaceNames, sdkTypesRoot } from './sdkTypes';
import { FIELD_EXPRESSION_FUNCTION_NAMES } from '../../domain/schema/fieldExpression';
import { describeMessage, packageText } from './messages';
import {
  CONTROL_STEP_TYPES,
  CORE_STEP_CATALOG,
  CORE_STEP_DEFINITION_IDS,
  UNIMPLEMENTED_STEP_TYPES,
  coreStepMetadata,
  isCoreStepDefinitionId,
} from '../../domain/schema/workflowStepCatalog';
import { RECORD_ACTION_METADATA } from '../../domain/schema/ui/recordActionMetadata';
import { SCREEN_ICON_KEYS } from '../../domain/schema/ui/screenIconCatalog';
import { REPORT_CAPABILITIES } from '../../domain/schema/report/reportCapabilities';
import {
  REPORT_CHART_KINDS,
  REPORT_GRANULARITIES,
  REPORT_SHAPE_KINDS,
} from '../../domain/schema/report/reportSpec';
import { NUMERIC_AGGREGATION_OPS } from '../../domain/schema/fieldRules';
import {
  ENTITY_EVENT_ACTIONS,
  NESTED_EVENT_SUFFIXES,
  WORKFLOW_CALLED_EVENT,
} from '../../domain/schema/eventCatalog';
import {
  DATE_REACHED_ACTION,
  DEFAULT_DATE_REACHED_AT,
  MAX_DATE_REACHED_OFFSET_DAYS,
  MIN_SCHEDULE_INTERVAL_MINUTES,
  WORKFLOW_CLOCK_TICK_MINUTES,
  WORKFLOW_SCHEDULE_EVENT,
} from '../../domain/schema/workflowClock';
import type { DomainIssue, ParseResult } from '../domain';
import {
  A_STATE_IS_A_KEY,
  BEHAVIOR_MECHANISMS,
  EMBEDDED_STRATEGY,
  RULE_LEDGER_FILE,
  SCREEN_IS_NOT_AN_ENTITY_MODEL,
  SCREEN_PLAN_HUMAN_DECISIONS,
  SCREEN_PLAN_RULES,
  STORAGE_MECHANISMS,
  buildArtifactPlan,
  coverageGaps,
  coverageSummary,
  detectorList,
  domainModelJsonSchema,
  mechanismCoverage,
  parseBusinessRule,
  parseDomainModel,
  transitionSummary,
  validateDomainModel,
  withRuleEntry,
} from '../domain';
import type { BusinessRule } from '../domain';
import { MCP_PROMPTS, renderMcpPrompt } from './prompts';
import { exportedSurface } from '../../domain/usecases/plugins/crossExtensionRefs';
import { SCRIPT_ID_INPUT, TARGET_WORKFLOW_ID_INPUT } from '../../domain/usecases/plugins/pluginReferences';
import type { ReferenceableArtifact } from './referenceable';
import { crossRefReport, referenceableArtifacts } from './referenceable';
import { recordSurfaceReport } from './recordSurfaces';
import { navTargetReport } from './navTargetReport';
import { navGroupReport, sameNameDifferentKeys, summarizeNavGroups, visibleNavGroups } from './navGroups';
import { eventRefReport } from './eventRefs';
import { documentStepReport } from './documentSteps';
import { fieldPresetReport } from './fieldPresets';
import { undeclaredPathReport } from './undeclaredPaths';
import { queryCeilingReport } from './queryCeilings';
import { QUERY_MAX_RESULTS, QUERY_MAX_SCAN, QUERY_PAGE_SINCE_KERNEL } from '../../domain/schema/querySpec';
import { readWorkspaceCatalog } from './workspaceCatalog';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { INSTALLED_CATALOG_FILE, INSTALLED_CATALOG_OMITS } from './installedCatalog';
import { EXAMPLES_DIR, findPluginFiles } from './workspacePlugins';
import { belongsToNamespace, outsideNamespaceMessage, workspaceNamespace } from './workspace/namespace';
import { describeExtension, exampleCoverageReport, listExamples } from './describeExtension';

/**
 * O servidor MCP do diretório de extensões — o que faz uma IA no VSCode trabalhar com a VERDADE em vez
 * de um retrato da documentação.
 *
 * Quase tudo que ele serve já era DADO neste repositório e não prosa: os pontos de extensão são
 * arrays, a API curada é um `.d.ts` gerado, e a validação é a mesma função que a instalação chama. É
 * isso que torna o laço curto: a IA propõe, `validate_plugin` responde com o que a plataforma diria,
 * ela corrige — sem deploy, sem escritório de cliente no meio.
 *
 * O protocolo é JSON-RPC 2.0 delimitado por linha, escrito à mão. Sem SDK de MCP de propósito: uma
 * ferramenta que se instala na máquina de um escritório é mais confiável quanto menos ela arrasta, e a
 * superfície usada aqui são três métodos.
 */

const PROTOCOL_VERSION = '2024-11-05';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (input: Record<string, unknown>, root: string) => string;
}

const asString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`"${name}" is required and must be a string.`);
  }
  return value;
};

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

/**
 * Quantas declarações VIZINHAS acompanham a pedida. Existe porque devolver `TemplateField` sozinho
 * responde `Omit<FieldDefinition, 'origin'>` — correto e inútil; e porque o fechamento completo de
 * `PluginManifest` seria o pacote inteiro.
 */
const REFERENCE_EXPANSION_LIMIT = 6;
const ALL_MAPPING_KINDS = ['Literal', 'Event', 'Expression', 'Output', 'Variable'];

/**
 * Os cinco tipos de input COMPOSTO e o tipo que cada um exige dentro do `Literal`. É a distinção que
 * mais custou a quem escrevia automação: o passo `query` recebe de fato um `QuerySpec` — e `QuerySpec`
 * era publicado pelo SDK —, então quem aprendia o `query` generalizava para o `upsert` e escrevia
 * `UpsertSpec`, que não é o que o passo lê.
 */
const COMPOSITE_INPUT_SHAPE: Record<string, string> = {
  Query: 'QuerySpec',
  Upsert: 'UpsertStepConfig',
  Remove: 'RemoveStepConfig',
  Map: 'MapStepConfig',
  Validate: 'ValidateStepConfig',
};


const ALL_POINTS = KERNEL_EXTENSION_POINTS;

const describeIssues = (issues: ReturnType<typeof validatePluginPackage>): string =>
  issues.length === 0
    ? 'No problems. This package would install.'
    : `${issues.length} problem(s):\n${issues
      .map((issue) => `- [${issue.source}] ${describeMessage(issue.message, issue.messageParams)}`)
      .join('\n')}`;

/**
 * O relatório da referência a OUTRA extensão, que `validatePluginPackage` não alcança sozinha.
 *
 * Com o pacote na mão dá para conferir a forma da referência e a dependência declarada; as outras duas
 * — se o `sourceId` está no `exports` da dona e se a versão satisfaz a faixa — pedem o outro lado, e o
 * outro lado passou a estar aqui: os `plugin.ts` deste diretório e o retrato da instalação. Enquanto
 * elas não eram cobradas, um id trocado passava por esta tool e era recusado no escritório de quem
 * instala — o único lugar em que ninguém tem como consertá-lo.
 *
 * A recusa da dona sai do PORTÃO real, com a frase do kernel resolvida para inglês. O que muda aqui é
 * só o significado da ausência: este diretório não é o escritório, e por isso "não achei a dona" é uma
 * resposta sobre o que não se sabe, nunca uma recusa fabricada.
 */
const describeCrossRefs = (pkg: MarketplacePlugin, root: string): string => {
  const findings = crossRefReport(pkg, root);
  if (findings.length === 0) return '';

  const refused = findings.filter((one) => one.status === 'refused' || one.status === 'absent-there');
  const head = refused.length === 0
    ? `${findings.length} reference(s) to another extension, none of them refused here:`
    : `${refused.length} of ${findings.length} reference(s) to another extension would NOT install:`;

  return `\n\n${head}\n${findings
    .map((one) => `- [${one.status}] ${one.ref} (${one.kind}, from ${one.writtenBy}) — ${one.detail}`)
    .join('\n')}`;
};

/**
 * Os gatilhos que escutam OUTRA extensão. `refused` é o prefixo emitido por uma extensão que o pacote
 * não declara; o resto é o que este diretório enxerga ou não — dito, nunca recusado.
 */
const describeEventRefs = (pkg: MarketplacePlugin, root: string): string => {
  const findings = eventRefReport(pkg, root);
  if (findings.length === 0) return '';
  const refused = findings.filter((one) => one.status === 'refused');
  const head = refused.length === 0
    ? `${findings.length} trigger(s) on an event another extension emits, none of them refused here:`
    : `${refused.length} of ${findings.length} trigger(s) on an event another extension emits would NOT install:`;
  return `\n\n${head}\n${findings
    .map((one) => `- [${one.status}] ${one.prefix}.* (from ${one.writtenBy}) — ${one.detail}`)
    .join('\n')}`;
};

/**
 * O passo `render-document` que cita o modelo de OUTRO pacote. `refused` é o modelo lido aqui cujo
 * contrato o passo não cumpre; o que não se enxerga é dito, nunca recusado — pode ser o do escritório.
 */
const describeDocumentSteps = (pkg: MarketplacePlugin, root: string): string => {
  const findings = documentStepReport(pkg, root);
  if (findings.length === 0) return '';
  const refused = findings.filter((one) => one.status === 'refused');
  const head = refused.length === 0
    ? `${findings.length} step(s) generating a document template of another package, none of them refused here:`
    : `${refused.length} of ${findings.length} step(s) generating a document template of another package do NOT fill its contract:`;
  return `\n\n${head}\n${findings
    .map((one) => `- [${one.status}] ${one.templateKey} (step "${one.step}" of ${one.writtenBy}) — ${one.detail}`)
    .join('\n')}`;
};

/**
 * O preset que um campo nomeia e que só outra extensão pode declarar. `refused` é a chave que as
 * dependências lidas aqui não têm; o que não se enxerga é dito, nunca recusado.
 */
const describeFieldPresets = (pkg: MarketplacePlugin, root: string): string => {
  const findings = fieldPresetReport(pkg, root);
  if (findings.length === 0) return '';
  const refused = findings.filter((one) => one.status === 'refused');
  const head = refused.length === 0
    ? `${findings.length} field preset(s) another extension should declare, none of them refused here:`
    : `${refused.length} of ${findings.length} field preset(s) name a preset their dependencies do NOT declare:`;
  return `\n\n${head}\n${findings
    .map((one) => `- [${one.status}] ${one.preset} (${one.path} of ${one.field}) — ${one.detail}`)
    .join('\n')}`;
};

/**
 * As telas a que o pacote pendura abas (`record:<sourceId>`). Aviso, nunca recusa: a tela pode ser de
 * outra extensão, num escritório que este diretório não enxerga.
 */
/**
 * Os itens de menu que podem levar a uma dependência declarada — os únicos que o portão do pacote não
 * responde sozinho. `refused` é a dependência lida aqui que não desenha aquela aba.
 */
const describeNavTargets = (pkg: MarketplacePlugin, root: string): string => {
  const findings = navTargetReport(pkg, root);
  if (findings.length === 0) return '';
  const refused = findings.filter((one) => one.status === 'refused');
  const head = refused.length === 0
    ? `${findings.length} menu item(s) that may open a page of a dependency, none of them refused here:`
    : `${refused.length} of ${findings.length} menu item(s) open a tab no page draws:`;
  return `\n\n${head}\n${findings
    .map((one) => `- [${one.status}] ${one.contributionId} (${one.target}) — ${one.detail}`)
    .join('\n')}`;
};

/**
 * Os grupos da barra lateral: o nome que outro grupo já tem com outra chave, e o item que entra num
 * grupo que nada aqui declara. Aviso, nunca recusa.
 */
const describeNavGroups = (pkg: MarketplacePlugin, root: string): string => {
  const findings = navGroupReport(pkg, root);
  if (findings.length === 0) return '';
  return `\n\n${findings.length} sidebar group(s) to look at (warnings only, never refused):\n${findings
    .map((one) => `- [${one.status}] ${one.key} — ${one.detail}`)
    .join('\n')}`;
};

const describeRecordSurfaces = (pkg: MarketplacePlugin, root: string): string => {
  const findings = recordSurfaceReport(pkg, root);
  if (findings.length === 0) return '';
  return `\n\n${findings.length} record detail(s) this package adds tabs to (warnings only, never refused):\n${findings
    .map((one) => `- [${one.status}] record:${one.sourceId} (${one.contributions.join(', ')}) — ${one.detail}`)
    .join('\n')}`;
};

/** Aviso, como no `check`: o id é permanente, e uma extensão já publicada fora do namespace fica como está. */
const describeNamespace = (pkg: MarketplacePlugin, root: string): string => {
  const namespace = workspaceNamespace(root);
  if (namespace === null || belongsToNamespace(pkg.manifest.id, namespace)) return '';
  return `\n\nWarning (never refused): ${outsideNamespaceMessage(pkg.manifest.id, namespace)} `
    + 'Keep it only if this extension is already installed somewhere — its id cannot change.';
};

/**
 * Os caminhos de relatório e de consulta que nenhum campo das telas visíveis declara. Aviso, como no
 * `check`: a plataforma os aceita porque o escritório pode ter criado o campo.
 */
const describeUndeclaredPaths = (pkg: MarketplacePlugin, root: string): string => {
  const findings = undeclaredPathReport(pkg, root);
  if (findings.length === 0) return '';
  return `\n\n${findings.length} report or query path(s) no visible field declares (warnings only, never refused):\n${findings
    .map((one) => `- ${one.path} (from ${one.writtenBy}) — ${one.detail}`)
    .join('\n')}`;
};

const QUERY_CEILINGS_NOTE = [
  `A query reads at most ${QUERY_MAX_SCAN} documents from the database and returns at most ${QUERY_MAX_RESULTS} records; `
  + `a larger \`limit\` is cut to ${QUERY_MAX_RESULTS} (validate_plugin and \`check\` warn).`,
  'Only `eq` on a field stored in the record goes to the database. Every other operator, a path into a referenced '
  + 'record, a derived field and `orderBy` apply in memory to the documents read — so a range filter or a sort sees '
  + `the first ${QUERY_MAX_SCAN} documents the \`eq\` filters select, not the whole collection.`,
  'The step publishes `hasMore`: true when records were left out, by the limit or by the read ceiling.',
  'To go through a larger collection, read in pages: `page: {}` for the first page, `page: { after: <mapping> }` '
  + 'for the next. Pages follow the record id, the step publishes `cursor` (null after the last page), and each run '
  + 'reads the next page — store the cursor where the next run can read it (a field of the record that drives the '
  + `work, or a parameter of a called workflow). \`orderBy\` is refused with \`page\`. Needs kernel ${QUERY_PAGE_SINCE_KERNEL} or later.`,
];

/** Os passos `query` com `limit` acima do teto. Aviso, como no `check`: o motor corta, não recusa. */
const describeQueryCeilings = (pkg: MarketplacePlugin): string => {
  const findings = queryCeilingReport(pkg);
  if (findings.length === 0) return '';
  return `\n\n${findings.length} query step(s) asking for more than a query returns (warnings only, never refused):\n${findings
    .map((one) => `- ${one.step} (workflow "${one.workflow}") — ${one.detail}`)
    .join('\n')}`;
};

// ─── Modelo de domínio ────────────────────────────────────────────────────────

/**
 * Uma REFERÊNCIA de mensagem escondida dentro de uma frase inglesa.
 *
 * O validador de modelo chama `screenIdIssue` e `validateFieldKey` de verdade — são eles que sabem
 * quais nomes de coleção o kernel recusa — e o que eles devolvem é `@core.records/...`, porque rodam
 * onde não existe idioma. O texto do problema carrega a referência como veio, e quem imprime é quem
 * resolve. Mesma divisão de `describeIssues`, só que a referência aqui está no meio da frase.
 */
const MESSAGE_REF_IN_TEXT = /@[a-z0-9.-]+\/[A-Za-z0-9._-]+/g;

const resolveRefsInText = (text: string): string =>
  text.replace(MESSAGE_REF_IN_TEXT, (reference) => describeMessage(reference));

const describeIssue = (issue: DomainIssue): Record<string, unknown> => ({
  code: issue.code,
  severity: issue.severity,
  ...(issue.entity === undefined ? {} : { entity: issue.entity }),
  ...(issue.field === undefined ? {} : { field: issue.field }),
  message: resolveRefsInText(issue.message),
  suggestion: resolveRefsInText(issue.suggestion),
  howToDeclareException: resolveRefsInText(issue.howToDeclareException),
});

/**
 * O catálogo é lido a cada chamada, e não guardado: o autor edita um `plugin.ts` entre uma pergunta e
 * a seguinte, e um catálogo em cache responderia sobre o diretório de dois minutos atrás — que é
 * exatamente o tipo de resposta que este servidor existe para não dar.
 */
const readModel = (input: Record<string, unknown>): ParseResult => {
  const raw = input.model;
  if (raw === undefined || raw === null || raw === '') {
    throw new Error(
      'Send the domain model in "model", as a JSON object or a JSON string. '
      + 'Read the resource microteia://domain-model/schema for its shape.',
    );
  }
  return parseDomainModel(raw);
};

/**
 * Uma linha de superfície referenciável, já na forma em que a referência se escreve. A fonte viaja
 * junto porque as duas não valem o mesmo: o `plugin.ts` ao lado é a verdade de agora, e o retrato
 * envelhece — dizer "instalada lá" sem dizer isso apresentaria as duas como uma coisa só.
 */
const referenceableLine = (one: ReferenceableArtifact): string =>
  `${one.ref} — ${one.name} (${one.kind}${one.from === 'workspace' ? ', authored here' : ', installed there'}`
  + `${one.disabled ? ', extension switched off' : ''})`;

/**
 * O QUE ESTÁ EM `examples/`, dito em toda resposta que carrega procedência — e dito como o que NÃO
 * está no catálogo.
 *
 * Omitir era o defeito anterior por outro caminho: um diretório em que só há exemplos passaria a
 * parecer vazio, e quem lesse iria procurar o `calendar` justamente por não ter sido avisado de que
 * ele está ali, em fonte, para ler.
 */
const describeExamples = (read: WorkspaceCatalog): string | null =>
  read.examples.length === 0
    ? null
    : `${read.examples.length} first-party extension(s) in ${EXAMPLES_DIR}/, as SOURCE to read: `
      + `${read.examples.join(', ')}. They are ours and are rewritten whenever this installation takes a new `
      + 'platform version. They are NOT in this catalog and are NOT authored here: nothing in this directory '
      + 'installs them, so an entity one of them declares exists nowhere. If this organization actually runs '
      + `one of them, it is the installation snapshot that says so — read it there, not from ${EXAMPLES_DIR}/.`;

/**
 * DE ONDE O CATÁLOGO VEIO, dito em toda resposta que o usa.
 *
 * Um catálogo apresentado como completo quando não é vale menos que nenhum: o agente para de
 * perguntar, e passa a modelar contra uma lista que não tem o que mais importa. A tool sempre acertou
 * nisso enquanto só havia o workspace, e continua acertando agora que há uma segunda fonte — a
 * diferença é que agora ela também diz QUANDO o retrato foi tirado, e avisa quando ele envelheceu.
 */
const catalogProvenance = (read: WorkspaceCatalog): Record<string, unknown> => {
  const installed = read.installed;

  if (installed === null) {
    return {
      workspace: `${read.sources.length} plugin.ts compiled in this directory`,
      examples: describeExamples(read),
      installation: null,
      referenceable: referenceableArtifacts(read).map(referenceableLine),
      caveats: [
        ...read.installedProblems,
        `No ${INSTALLED_CATALOG_FILE} here, so nothing this organization actually runs is in this list: a `
        + 'screen somebody built in the Form Design, or an extension already installed there, is invisible. '
        + 'ASK rather than assume the list is everything — or run "microteia export-catalog --tenant '
        + '<tenantId>" in the installation to bring a snapshot of it in.',
      ],
    };
  }

  return {
    workspace: `${read.sources.length} plugin.ts compiled in this directory`,
    examples: describeExamples(read),
    /**
     * O que se pode REFERENCIAR, das DUAS fontes: os `plugin.ts` deste diretório e as extensões do
     * retrato. Vive fora do bloco `installation` porque deixou de ser só dele — enquanto era, a
     * extensão irmã escrita ao lado, que é o caso mais comum de compartilhamento, não aparecia em
     * lugar nenhum.
     */
    referenceable: referenceableArtifacts(read).map(referenceableLine),
    installation: {
      file: installed.path,
      projectId: installed.projectId,
      office: `${installed.tenantName} (${installed.tenantId})`,
      takenAt: installed.exportedAt,
      ageDays: installed.ageDays,
      stale: installed.stale,
      staleAfterDays: installed.staleAfterDays,
      kernelVersion: installed.kernelVersion,
      consoleVersion: installed.consoleVersion,
      extensions: installed.extensions.map((one) =>
        `${one.name} ${one.version} (${one.id})${one.active ? '' : ' — switched off'}`),
      collectionsOnlyThere: installed.addedCollections,
      collectionsAlsoInWorkspace: installed.shadowedCollections,
      listsAdded: installed.lookups,
      tagListsAdded: installed.tagLists,
      omits: INSTALLED_CATALOG_OMITS,
    },
    caveats: [
      ...read.installedProblems,
      ...(installed.shadowedCollections.length === 0 ? [] : [
        `${installed.shadowedCollections.join(', ')} exist in BOTH sources. The workspace version won — it is `
        + 'the one being edited — and the installed one was dropped whole. That is information, not a '
        + 'problem: what runs there may already have fields this plugin.ts does not.',
      ]),
      'It is a SNAPSHOT. Nothing keeps it in step with the organization — anything created there since it '
      + 'was taken is missing from this list.',
    ],
  };
};

const TOOLS: ToolDefinition[] = [
  {
    name: 'validate_plugin',
    description:
      'Validate an extension package against the exact same checks the platform runs on install: '
      + 'manifest shape, referential integrity, size limits and migrations — plus every reference to '
      + 'ANOTHER extension, checked against what this workspace and the installation snapshot know that '
      + 'each owner exports. Accepts a path to a '
      + 'plugin.ts (compiled first) or to a .json, or the raw JSON. Use this after every edit — it is '
      + 'the fastest way to know whether a package would be accepted.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to a plugin.ts or a built .json.' },
        json: { type: 'string', description: 'The package as raw JSON, instead of a path.' },
      },
    },
    run: (input, root) => {
      if (typeof input.json === 'string') {
        const parsed = parsePackage(input.json);
        if (!parsed.ok) return `Not a valid package: ${describeMessage(parsed.error)}`;
        return `${describeIssues(validatePluginPackage(parsed.package))}${describeCrossRefs(parsed.package, root)}${describeEventRefs(parsed.package, root)}${describeDocumentSteps(parsed.package, root)}${describeFieldPresets(parsed.package, root)}${describeUndeclaredPaths(parsed.package, root)}${describeQueryCeilings(parsed.package)}${describeRecordSurfaces(parsed.package, root)}${describeNavTargets(parsed.package, root)}${describeNavGroups(parsed.package, root)}${describeNamespace(parsed.package, root)}`;
      }
      const path = resolve(root, asString(input.path, 'path'));
      if (path.endsWith('.json')) {
        const parsed = parsePackage(readFileSync(path, 'utf8'));
        if (!parsed.ok) return `Not a valid package: ${describeMessage(parsed.error)}`;
        return `${describeIssues(validatePluginPackage(parsed.package))}${describeCrossRefs(parsed.package, root)}${describeEventRefs(parsed.package, root)}${describeDocumentSteps(parsed.package, root)}${describeFieldPresets(parsed.package, root)}${describeUndeclaredPaths(parsed.package, root)}${describeQueryCeilings(parsed.package)}${describeRecordSurfaces(parsed.package, root)}${describeNavTargets(parsed.package, root)}${describeNavGroups(parsed.package, root)}${describeNamespace(parsed.package, root)}`;
      }
      const result = buildPlugin({ entry: path });
      return `${result.package.manifest.id} v${result.package.manifest.version}\n${describeIssues(result.issues)}`
        + describeCrossRefs(result.package, root)
        + describeEventRefs(result.package, root)
        + describeDocumentSteps(result.package, root)
        + describeFieldPresets(result.package, root)
        + describeUndeclaredPaths(result.package, root)
        + describeQueryCeilings(result.package)
        + describeRecordSurfaces(result.package, root)
        + describeNavTargets(result.package, root)
        + describeNavGroups(result.package, root)
        + describeNamespace(result.package, root);
    },
  },
  {
    name: 'build_plugin',
    description:
      'Compile a plugin.ts to the .json the platform installs and return it, together with any '
      + 'problems. Views declared with "sourceFile" are inlined. Does not write to disk.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the plugin.ts.' },
        exportName: { type: 'string', description: 'Which export to read, when the file has several.' },
      },
      required: ['path'],
    },
    run: (input, root) => {
      const result = buildPlugin({
        entry: resolve(root, asString(input.path, 'path')),
        exportName: typeof input.exportName === 'string' ? input.exportName : undefined,
      });
      return `${describeIssues(result.issues)}\n\n${result.json}`;
    },
  },
  {
    name: 'describe_extension',
    description:
      'What ONE extension declares, brings and requires, read from the compiled package — the answer to '
      + '"how is X done?" and to "what does this extension actually do?" in a single call, instead of opening '
      + 'a 500-line plugin.ts and inferring. It says the points it contributes to, the extension points it '
      + 'declares for others, its screens and their collections, its option lists, workflows, actions, '
      + 'scripts, reports, code views, startup code and migrations, what it exports for another extension to '
      + `reference, what it demands of the Firebase project, and whether it would install. Pass a folder name `
      + `(the ones in ${EXAMPLES_DIR}/ included), an extension id, or a path to a plugin.ts. Start from `
      + 'the resource microteia://examples when you do not know which one to ask about. Nothing in the answer '
      + 'is prose written beside the code: it is the package itself.',
    inputSchema: {
      type: 'object',
      properties: {
        extension: {
          type: 'string',
          description: `Folder name, extension id, or path to a plugin.ts. A folder under ${EXAMPLES_DIR}/ works by its own name.`,
        },
        detail: {
          type: 'string',
          enum: ['summary', 'full'],
          description: 'summary (default) counts and names what each screen holds; full lists every field of every screen.',
        },
      },
      required: ['extension'],
    },
    run: (input, root) => {
      const query = typeof input.extension === 'string' ? input.extension : '';
      if (query.trim() === '') {
        return 'Name the extension in "extension": a folder name, an id, or a path to a plugin.ts. '
          + 'Read microteia://examples for the ones that ship with this installation.';
      }
      const detail = input.detail === 'full' ? 'full' : 'summary';
      const result = describeExtension(root, query, { detail });
      return typeof result.answer === 'string' ? result.answer : pretty(result.answer);
    },
  },
  {
    name: 'describe_host_module',
    description:
      'The TypeScript declarations of a module that extension CODE (a view or startup) may import. '
      + 'Nothing outside this set is reachable — the runtime resolves imports against a fixed '
      + 'allowlist. Call with no name to list every module in it.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: "e.g. '@microteia/data'" } },
    },
    run: (input, root) => {
      const types = readHostTypes(root);
      const names = hostModuleNames(types);
      if (typeof input.name !== 'string' || input.name === '') {
        return `Available modules:\n${names.map((name) => `- ${name}`).join('\n')}`;
      }
      const block = hostModuleBlock(types, input.name);
      if (block === null) {
        return `"${input.name}" is not available to extensions. Available:\n${names.map((n) => `- ${n}`).join('\n')}`;
      }
      return block;
    },
  },
  {
    name: 'describe_sdk_type',
    description:
      'The exact declaration of an AUTHORING type, read from the .d.ts this installation carries — '
      + 'the shape a package must have for the platform to accept it. Ask for `AuthoredPlugin`, '
      + '`PluginManifest`, `ScreenModuleTemplate`, `TemplateField`, `FieldDefinition`, `WidgetSpec`, '
      + '`WorkflowDefinition`, `WorkflowStep`, `InputMapping`, `ActionDefinition`, `Script`, '
      + '`PluginMigration`, `SettingsSection`, `QuerySpec`, `ReportSpec`, or any other symbol the SDK '
      + 'publishes. '
      + 'Call with no name to list the whole published surface. The declarations carry no comments — '
      + 'they are emitted stripped, so read AUTHORING.md for what each property MEANS.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: "e.g. 'TemplateField'" } },
    },
    run: (input, root) => {
      const dir = sdkTypesRoot(root);
      if (dir === null) {
        return 'Could not find the @microteia/sdk type declarations in this workspace. Run "npm run sdk:refresh".';
      }
      const names = sdkSurfaceNames(dir);
      if (typeof input.name !== 'string' || input.name === '') {
        return `The SDK publishes ${names.length} symbols:\n${names.map((name) => `- ${name}`).join('\n')}`;
      }
      // Amarrado a um local: o estreitamento de uma propriedade de índice não sobrevive à chamada
      // seguinte, e o `tsconfig.sdk.json` — mais estrito que o gate da raiz — cobra isso.
      const wanted = input.name;
      const found = sdkDeclaration(dir, wanted);
      if (found === null) {
        const near = names.filter((name) => name.toLowerCase().includes(wanted.toLowerCase()));
        return near.length > 0
          ? `"${wanted}" is not a published symbol. Did you mean:\n${near.map((name) => `- ${name}`).join('\n')}`
          : `"${wanted}" is not published by this SDK. Call this tool with no name to list what is.`;
      }
      // O caminho vem junto porque ele é a prova de que a resposta saiu do pacote instalado, e não
      // de memória: quem lê pode abrir o arquivo.
      const head = `// ${found.file}\n${found.declaration}`;
      const referenced = referencedSymbols(found.declaration, names).slice(0, REFERENCE_EXPANSION_LIMIT);
      const expanded = referenced
        .map((name) => sdkDeclaration(dir, name))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .map((entry) => `// ${entry.file}\n${entry.declaration}`);
      return expanded.length === 0
        ? head
        : `${head}\n\n// ─── referenced by it ───\n\n${expanded.join('\n\n')}`;
    },
  },
  {
    name: 'describe_workflow_step',
    description:
      'Everything one step of the catalog needs in `configuration`: each input, whether it is '
      + 'required, its type, which InputMapping kinds it accepts, its options and its default — plus '
      + 'the outputs later steps can read through `{ kind: "Output" }`. Call with no id to list the '
      + 'ids. For a composite input (Query, Upsert, Remove, Map, Validate) the value is a '
      + 'Literal wrapping the matching *StepConfig — ask `describe_sdk_type` for its shape. An input that '
      + 'names another artifact also lists what is referenceable from here, already in the form the '
      + 'reference takes.',
    inputSchema: {
      type: 'object',
      properties: { stepDefinitionId: { type: 'string', description: "e.g. 'upsert'" } },
    },
    run: (input, root) => {
      const wanted = typeof input.stepDefinitionId === 'string' ? input.stepDefinitionId : '';
      if (wanted === '') {
        return `The catalog has ${CORE_STEP_CATALOG.length} steps:\n${CORE_STEP_DEFINITION_IDS
          .map((id) => `- ${id}`).join('\n')}`;
      }
      if (!isCoreStepDefinitionId(wanted)) {
        return `"${wanted}" is not in the kernel catalog. It has:\n${CORE_STEP_DEFINITION_IDS
          .map((id) => `- ${id}`).join('\n')}\nA step contributed by another extension is not listed `
          + 'here — read that extension\'s own documentation.';
      }
      const step = coreStepMetadata(wanted);
      /**
       * O input que guarda o id de OUTRO artefato é o lugar exato em que a referência qualificada é
       * escrita — e era o lugar em que a lista do que se pode referenciar não chegava. Ela viajava em
       * três respostas, todas sobre entidade e tela; quem escreve o passo pergunta o passo.
       *
       * A leitura do catálogo é preguiçosa: descrever um passo que não aponta para nada não paga o
       * preço de compilar os `plugin.ts` do diretório.
       */
      const referencedKind = (inputId: string): ReferenceableArtifact['kind'] | null => {
        if (inputId === SCRIPT_ID_INPUT) return 'script';
        return inputId === TARGET_WORKFLOW_ID_INPUT ? 'workflow' : null;
      };
      const surface = step.inputs.some((one) => referencedKind(one.id) !== null)
        ? referenceableArtifacts(readWorkspaceCatalog(root))
        : [];

      return pretty({
        stepDefinitionId: step.id,
        name: describeMessage(step.name),
        description: describeMessage(step.description),
        category: step.category,
        stepType: step.type,
        configurable: step.configurable,
        // O tipo composto é a armadilha que mais custou: o passo `query` recebe um `QuerySpec`, mas
        // `upsert`, `remove`, `map` e `validate-object` NÃO recebem `UpsertSpec` — recebem o
        // `*StepConfig` correspondente. Quem aprendia o primeiro generalizava errado para os outros.
        inputs: step.inputs.map((one) => ({
          id: one.id,
          label: describeMessage(one.label),
          description: one.description === undefined ? undefined : describeMessage(one.description),
          required: one.required,
          type: one.type,
          ...(referencedKind(one.id) === null ? {} : {
            acceptsQualifiedRef:
              'A `templateId` of your own package, or "<extension-id>/<source-id>" for an artifact another '
              + 'extension exports. The owner must be in `manifest.dependencies` and must list that id in its '
              + '`manifest.exports` — validate_plugin checks both.',
            referenceable: surface
              .filter((artifact) => artifact.kind === referencedKind(one.id))
              .map(referenceableLine),
          }),
          shape: COMPOSITE_INPUT_SHAPE[one.type] ?? null,
          // Sem isto, quem escreve o passo "Gerar documento" não sabia que `recordId` é do modelo de
          // registro e `payload`/`belongsTo` do modelo de dados — e só descobria pela recusa em runtime.
          ...(one.templateSource ? { onlyForTemplateSource: one.templateSource.is } : {}),
          ...(one.picker === 'document-template-reference'
            ? { names: 'The key of one of the chosen payload template\'s single EntityReference parameters.' }
            : {}),
          acceptsMappingKinds: one.allowedMappingKinds ?? ALL_MAPPING_KINDS,
          defaultValue: one.defaultValue,
          pattern: one.pattern,
          options: one.options?.kind === 'Static'
            ? one.options.options.map((option) => ({
              value: option.value,
              label: describeMessage(option.label),
            }))
            : one.options ?? undefined,
        })),
        outputs: step.outputDefinitions.map((one) => ({
          id: one.id,
          label: describeMessage(one.label),
          type: one.type,
        })),
        dynamicInputs: step.dynamicInputs ?? null,
        // Os `param.<chave>` deste passo não estão em `inputs`: nascem do modelo. Sem dizer que eles são
        // conferidos contra ele, quem escreve o passo só descobria o nome errado no documento em branco.
        ...(step.dynamicInputs?.kind === 'from-target-document-template-parameters'
          ? {
            checkedAgainstTemplate: 'With a `Literal` `templateKey`, validate_plugin and `check` hold the step to that '
              + 'template: each `param.<key>` must be one of its parameters (the first segment — `param.customer.name` '
              + 'fills `customer`), every `required` parameter filled by `param.<key>` or by `payload`, `recordId` only '
              + 'for a record template, `payload` / `belongsTo` / `param.*` only for a payload template, `belongsTo` a '
              + 'single `EntityReference` parameter, and `destination: "record"` on a payload template only with '
              + '`belongsTo`. A template of your package is refused on install too; one another plugin.ts here or the '
              + 'installation snapshot declares is refused by validate_plugin; one nothing visible declares is reported '
              + 'as not checkable, never refused — the organization may have its own on that key.',
          }
          : {}),
        dynamicOutputs: step.dynamicOutputs ?? null,
        // Os tetos não aparecem em input nenhum, e foi assim que um `limit: 300` virou 100 sem ninguém
        // saber. Os números saem das constantes que o motor aplica.
        ...(step.id === 'query' ? { ceilings: QUERY_CEILINGS_NOTE } : {}),
      });
    },
  },
  {
    name: 'validate_domain_model',
    description:
      'THE GATE, and the first thing to call after a business request. Give it a domain model — entities, '
      + 'what each field MEANS, and the relationships — and it answers with what is wrong, deterministically. '
      + `"${SCREEN_IS_NOT_AN_ENTITY_MODEL}" A request arrives describing what someone SEES, and the naive reading `
      + 'produces one entity with everybody else\'s data inside it. That reading validates, installs and runs; '
      + 'nothing else in this platform refuses it. This does. A model with an ERROR does not become an artifact plan. '
      + 'It does not forbid duplication: a copy is fine when it is DECLARED (semanticType "snapshot" with source and reason). '
      + 'It is ALSO the gate for what HAPPENS: the optional `behavior` block declares the states a record moves through, '
      + `what moves it, and what must stay true. ${A_STATE_IS_A_KEY} Declare it whenever the request describes a `
      + 'lifecycle — it almost always does, in the same sentence as the structure ("a sale is born as a draft; only the '
      + 'manager cancels an invoiced one"), and waiting to be asked for "the automation" is waiting for a request that '
      + 'never comes. Every trigger, effect and invariant is translated to a mechanism that exists here, and the ones '
      + 'that do not exist — a clock, a uniqueness constraint — are refused with the reason instead of something that '
      + 'looks similar. '
      + 'Read microteia://domain-model/schema for the shape and microteia://domain-model/rules for every check.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'object', description: 'The domain model. A JSON string is accepted too.' },
      },
      required: ['model'],
    },
    run: (input, root) => {
      const parsed = readModel(input);
      if (!parsed.ok) {
        return pretty({ ok: false, blocking: parsed.issues.length, issues: parsed.issues.map(describeIssue) });
      }
      const read = readWorkspaceCatalog(root);
      const result = validateDomainModel(parsed.model, read.catalog);
      const issues = [...parsed.issues, ...result.issues];
      return pretty({
        ok: result.ok && parsed.issues.length === 0,
        rule: SCREEN_IS_NOT_AN_ENTITY_MODEL,
        // O veredito é tão completo quanto o catálogo que o produziu, e quem lê tem de saber disso:
        // um campo passa por "não pertence a outra entidade" apenas porque a entidade não está aqui.
        catalogSources: catalogProvenance(read),
        entities: result.expanded.model.entities.map((one) => `${one.name} (${one.kind})`),
        relationships: result.relationships.map((one) => ({
          reads: `${one.relationship.targetEntity} <- ${one.relationship.sourceEntity}.${one.fieldKey}`,
          storage: one.mechanism.storage,
          declaredAs: one.mechanism.declaration,
          storedAs: one.mechanism.storedAs,
        })),
        // O comportamento traduzido, do mesmo jeito que os relacionamentos: o que precisa existir, pelo
        // identificador do mecanismo real. Quem escreve o `plugin.ts` lê daqui e não relê o modelo —
        // é assim que duas leituras deixam de poder discordar.
        transitions: result.transitions.map((one) => ({
          reads: transitionSummary(one),
          eventName: one.eventName || undefined,
          action: one.actionKey,
          condition: one.workflowCondition,
          // A prosa fica FORA da condição: `condition` é copiada verbatim para o `plugin.ts`, e uma
          // nota entre parênteses dentro dela não parseia.
          conditionNote: one.conditionNote,
          steps: one.steps,
          permission: one.permission,
          // Onde o `from` é conferido em RUNTIME, e o que o gatilho traz para conferi-lo. Sem isto o
          // `from` era prosa: quem lia o plano escrevia a automação sem condição nenhuma, e ela
          // rodava em qualquer estado. `workflow.called` não carrega o registro — o campo do estado
          // chega lá por um parâmetro de referência, e é o que `requiresParameter` nomeia.
          fromCheck: one.fromCheck,
          supported: one.supported || undefined,
        })),
        blocking: issues.filter((one) => one.severity === 'error').length,
        issues: issues.map(describeIssue),
        next: result.ok
          ? 'Call generate_artifact_plan with the same model.'
          : 'Fix the errors and call this again. There is no plan until they are gone.',
      });
    },
  },
  {
    name: 'generate_artifact_plan',
    description:
      'Turns a VALIDATED domain model into a plan: which screens, fields, references and option lists must exist, '
      + 'what each SCREEN looks like, and in which target (an extension package, or this organization\'s own screens). '
      + 'It returns a PLAN, never files — you write the plugin.ts, and then validate_plugin checks it. The plan is a '
      + 'DIFF against what already exists here, so running it twice proposes nothing the second time; it also says '
      + 'what it cannot do, instead of working around it: a field type is immutable, a change to the shape of stored '
      + 'data needs a declared migration, and nothing is ever removed. '
      + 'The screen half is decided by RULE, not by taste — a root entity gets a list and a detail, a child gets a tab '
      + 'of its parent and never a menu entry, an option list never gets a screen, a derived field is read-only, the '
      + 'state field goes to the list, and every user-action transition gets one record action with the disabledWhen '
      + 'the blocking invariant produced. What it does NOT decide it hands back, named: icon, menu order, and where '
      + 'ambiguous actions appear. '
      + `Pass the \`rule\` too, and the plan becomes that rule's BATCH: it reads the ${RULE_LEDGER_FILE} of this `
      + 'workspace and answers with the delta — the same rule twice proposes nothing, a changed rule proposes only '
      + 'what changed, and a rule that lost an entity proposes DISABLING what it no longer needs, never deleting.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'object', description: 'The domain model, the same one validate_domain_model accepted.' },
        rule: {
          type: 'object',
          description: 'Optional but recommended: the BusinessRule this model came from — { id, statement, actors, '
            + 'concepts, invariants, processes, acceptance }. A bare sentence is accepted and read as the statement.',
        },
      },
      required: ['model'],
    },
    run: (input, root) => {
      const parsed = readModel(input);
      if (!parsed.ok) {
        return pretty({ ok: false, issues: parsed.issues.map(describeIssue) });
      }
      const read = readWorkspaceCatalog(root);
      let rule: BusinessRule | undefined;
      const ruleIssues: ReturnType<typeof describeIssue>[] = [];
      if (input.rule !== undefined) {
        const readRule = parseBusinessRule(input.rule);
        if (readRule.rule === null) ruleIssues.push(...readRule.issues.map(describeIssue));
        else rule = readRule.rule;
      }
      const plan = buildArtifactPlan(parsed.model, read.catalog, {
        ...(rule === undefined ? {} : { rule }),
        ledger: read.ruleLedger,
      });
      return pretty({
        ok: plan.ok,
        target: plan.target,
        // O plano é um DIFF contra o que já existe, então de onde veio "o que já existe" é parte do
        // resultado: uma coleção que só o retrato conhece muda o diff, e um retrato velho o desatualiza.
        catalogSources: catalogProvenance(read),
        extensionId: plan.extensionId,
        relationships: plan.relationships,
        screens: plan.screens.map((screen) => ({
          operation: screen.operation,
          entity: screen.entity,
          kind: screen.kind,
          collection: screen.collection,
          titleFieldKey: screen.titleFieldKey,
          parent: screen.parent,
          // A chave é a única declaração cuja AUSÊNCIA não tem sintoma: sem ela a tela aceita a
          // duplicata em silêncio. Por isso ela sai no plano mesmo vazia — o `[]` é uma afirmação.
          keys: screen.keys,
          retainedKeys: screen.retainedKeys.length > 0 ? screen.retainedKeys : undefined,
          retainedFields: screen.retainedFields.length > 0 ? screen.retainedFields : undefined,
          fields: screen.fields.map((field) => ({
            operation: field.operation,
            key: field.key,
            type: field.type,
            required: field.required || undefined,
            multi: field.multi || undefined,
            refEntity: field.refEntity,
            lookupCollection: field.lookupCollection,
            aggregation: field.aggregation,
            computeExpression: field.computeExpression,
            section: field.section,
            reason: field.reason,
          })),
        })),
        lookups: plan.lookups,
        // O PLANO DE TELAS. Ele vem por regra, e as regras viajam com ele: quem lê o plano tem de poder
        // conferir a decisão contra a regra que a produziu, em vez de confiar nela.
        screenPlan: {
          rules: SCREEN_PLAN_RULES.map((one) => `${one.subject} -> ${one.decides} (${one.declaredAs})`),
          screens: plan.screenPlan.screens.map((screen) => ({
            entity: screen.entity,
            collection: screen.collection,
            // O id UNIVERSAL da tela. Ele vem daqui e é COPIADO como está: é por ele que a versão
            // seguinte do pacote atualiza esta tela em vez de instalar uma segunda ao lado dela.
            sourceId: screen.sourceId,
            sourceIdFrom: screen.sourceIdFrom,
            presence: screen.presence,
            titleFieldKey: screen.titleFieldKey,
            parent: screen.parent,
            listColumns: screen.listColumns,
            filterableFields: screen.filterableFields,
            sections: screen.sections.length > 0 ? screen.sections : undefined,
            readOnlyFields: screen.readOnlyFields.length > 0 ? screen.readOnlyFields : undefined,
            referenceFields: screen.referenceFields.length > 0 ? screen.referenceFields : undefined,
            actions: screen.actions.length > 0 ? screen.actions : undefined,
            tabs: screen.tabs.length > 0 ? screen.tabs : undefined,
            keys: screen.keys.length > 0 ? screen.keys : undefined,
            humanDecisions: screen.humanDecisions.length > 0 ? screen.humanDecisions : undefined,
          })),
          notScreens: plan.screenPlan.notScreens,
          // Nomeado, e não omitido: um plano que não diz o que ele NÃO decidiu parece completo, e o
          // custo aparece quando o escritório recebe um ícone que não tem nada a ver com o negócio dele.
          humanDecisions: plan.screenPlan.humanDecisions,
        },
        // A regra mudou e algo que ela criou não é mais necessário. DESATIVAR, nunca excluir.
        deactivations: plan.deactivations.length > 0 ? plan.deactivations : undefined,
        // A INTEGRIDADE DO LIVRO, dita em voz alta e não só dentro dos problemas. Ele é escrito à mão e
        // passou a ser a fonte da identidade das telas: uma linha que escorregou não tem sintoma hoje e
        // instala uma segunda tela na próxima passada, em todo escritório de uma vez.
        ledgerIntegrity: plan.ledgerIntegrity === null
          ? undefined
          : {
            file: plan.ledgerIntegrity.file,
            ok: plan.ledgerIntegrity.findings.length === 0,
            findings: plan.ledgerIntegrity.findings,
            because: plan.ledgerIntegrity.findings.length === 0
              ? 'the ledger and what exists here say the same thing.'
              : 'the ledger is the source of each screen\'s universal identity, and a book that slipped makes the '
                + 'next pass derive a NEW identity for a screen that already exists — which installs a second screen '
                + 'instead of updating it. Write `trace.contents` before writing the package.',
          },
        trace: plan.trace === null
          ? undefined
          : {
            file: plan.trace.file,
            unchanged: plan.trace.delta.unchanged,
            added: plan.trace.delta.added,
            dropped: plan.trace.delta.dropped,
            // O arquivo pronto para gravar. Este servidor NÃO escreve em disco — quem grava é quem
            // tem as ferramentas de arquivo, e é a mesma postura de `build_plugin`.
            writeThisTo: plan.trace.file,
            contents: withRuleEntry(read.ruleLedger, plan.trace.entry),
          },
        migrationsRequired: plan.migrationsRequired,
        versionBump: plan.versionBump,
        issues: [...ruleIssues, ...plan.issues.map(describeIssue)],
        howToWriteIt: plan.ok
          ? [
            'Each planned screen with operation "create" or "update" is one entry of `screens` in the package '
            + '(or a `screenPatch` when the collection belongs to another extension).',
            'A field with operation "unchanged" is already installed: declare it exactly as it is, and the update will '
            + 'recognise it instead of duplicating it.',
            'The relationship is already resolved above — refEntity, parentEntity, parentFieldKey and parentRelation. '
            + 'Do not read it again from the model; that is how two readings start to disagree.',
            'Copy each screen\'s `sourceId` from the screen plan verbatim, and never recompute one: it is how an '
            + 'update recognises the screen, and a value that changes between two versions installs a SECOND screen '
            + 'beside the first, leaving the records in a collection with no screen over it.',
            'The screen plan above already decided the list columns, the filters, the sections and the record actions. '
            + 'The disabledWhen of each action is not a suggestion: it carries the transition\'s `from` plus every '
            + 'invariant declared with enforcement "blocks", and that is the only place a blocking invariant can sit '
            + 'on a gesture.',
            ...(plan.trace === null
              ? [`Pass the \`rule\` next time and write the ${RULE_LEDGER_FILE} the answer hands you: without it, the `
                + 'next version of this rule cannot be a diff of what this one generated.']
              : [`Write \`trace.contents\` to \`<folder>/${plan.trace.file}\`. That is the whole traceability `
                + 'mechanism, and it is a workspace file on purpose — stamping the ruleId inside the installed '
                + 'artifact would change the shape of the package.']),
            'Then run validate_plugin. This plan says what must exist; that one says whether what you wrote installs.',
          ]
          : ['This plan is blocked. Read the issues above before writing anything.'],
      });
    },
  },
  {
    name: 'read_authoring_guide',
    description:
      'The authoring manual for this platform: package anatomy, extension points, screens, '
      + 'automation, reports, the curated API, code trust, translation rules and size limits. Read it '
      + 'before writing an extension. Pass a query to get only the matching sections — '
      + '"reports" is the section to read before declaring one: which question each fold answers, '
      + 'when a chart has anything to plot, and what the author does NOT control (permission per '
      + 'collection, the scan ceiling). Pair it with list_report_options, which says what THIS '
      + 'installation executes.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Optional: only sections matching this.' } },
    },
    run: (input, root) => {
      const candidates = [
        join(root, 'AUTHORING.md'),
        join(root, '../AUTHORING.md'),
        resolve(__dirname, '../../../AUTHORING.md'),
      ];
      const path = candidates.find((candidate) => existsSync(candidate));
      if (path === undefined) return 'AUTHORING.md not found in this workspace.';
      const guide = readFileSync(path, 'utf8');
      if (typeof input.query !== 'string' || input.query.trim() === '') return guide;

      const query = input.query.toLowerCase();
      const sections = guide.split(/\n(?=## )/);
      const matching = sections.filter((section) => section.toLowerCase().includes(query));
      return matching.length > 0
        ? matching.join('\n\n')
        : `Nothing about "${input.query}". Sections:\n${sections
          .map((section) => section.split('\n')[0])
          .filter((heading) => heading.startsWith('#'))
          .join('\n')}`;
    },
  },
];


/**
 * LEITURAS PURAS — o que era ferramenta e virou recurso.
 *
 * Toda ferramenta é contexto que TODO agente carrega em TODA sessão, inclusive quem abriu o editor
 * só para validar um pacote. Oito destas oito não recebiam argumento nenhum e não faziam nada: eram
 * documentos, e um documento servido como ferramenta é um documento que custa um esquema de entrada
 * na janela de todo mundo, o tempo inteiro.
 *
 * O corpo de cada uma está INTACTO abaixo — o que mudou foi a superfície, não a resposta. A regra que
 * separa as duas listas é a mesma daqui para a frente: **recebe argumento ou muda alguma coisa, é
 * ferramenta; devolve um documento, é recurso.**
 */
const PURE_READS: ToolDefinition[] = [
  {
    name: 'list_entities',
    description:
      'The entities this workspace knows: the two the kernel still declares, every collection the '
      + 'plugin.ts files here describe, and — when a snapshot of the installation has been exported — '
      + 'everything the organization actually runs. THIS is what you look at before modelling anything: '
      + 'a field called "customerName" is a defect only because Customer is a thing, and this is how you '
      + 'find out that it is. It never reads a database itself. Every entity says where it came from, '
      + 'and the answer says when the snapshot was taken and what it leaves out, so you can tell a '
      + 'complete list from a partial one instead of assuming.',
    inputSchema: { type: 'object', properties: {} },
    run: (_input, root) => {
      const read = readWorkspaceCatalog(root);
      const { catalog, sources, failures } = read;
      return pretty({
        kernelVersion: KERNEL_VERSION,
        rule: SCREEN_IS_NOT_AN_ENTITY_MODEL,
        catalogSources: catalogProvenance(read),
        entities: catalog.entities.map((entity) => ({
          collection: entity.collection,
          screenKey: entity.screenKey === entity.collection ? undefined : entity.screenKey,
          labelSingular: describeMessage(entity.labelSingular),
          labelPlural: describeMessage(entity.labelPlural),
          titleFieldKey: entity.titleFieldKey,
          source: entity.source,
          ownerPluginId: entity.ownerPluginId,
          parent: entity.parent,
          fields: entity.fields.map((field) => {
            const suffix = field.refEntity
              ? ` -> ${field.refEntity}${field.multi ? '[]' : ''}`
              : field.lookupCollection ? ` (list ${field.lookupCollection})` : '';
            return `${field.key}: ${field.type}${field.required ? '!' : ''}${suffix}`;
          }),
        })),
        lookups: catalog.lookups.map((one) => ({ collection: one.collection, label: describeMessage(one.label) })),
        tagLists: catalog.tagLists.map((one) => ({ collection: one.collection, label: describeMessage(one.label) })),
        readFrom: sources,
        couldNotCompile: failures,
        notes: [
          'source "kernel" = declared in the platform itself; source "workspace" = brought by a plugin.ts in this '
          + 'directory, which is what you can edit; source "installation" = read from the exported snapshot, which is '
          + 'what the organization already runs and which nothing here can change.',
          'The kernel declares no business entity, and never will: a new one belongs to an extension package or to this '
          + 'organization\'s own screens.',
        ],
      });
    },
  },
  {
    name: 'list_extension_points',
    description:
      'Every extension point a package may contribute to, with the API version and which '
      + 'implementation kinds each accepts. "code" is restricted: a third-party package may declare '
      + 'it, but the code only runs after an administrator reviews and trusts it.',
    inputSchema: { type: 'object', properties: {} },
    run: () => pretty({
      kernelVersion: KERNEL_VERSION,
      implKindsThatRunWithoutReview: THIRD_PARTY_IMPL_KINDS,
      // `code` NÃO está na lista acima, e a distinção é a que mais importa aqui: qualquer pacote pode
      // declará-lo, e a validação não o recusa. O que ele paga é revisão humana antes de executar.
      codeImplNote:
        'A package may declare impl kind "code" (a view or a startup, delivered as source). It is not '
        + 'refused by validation; it simply does not execute until an administrator of the organization '
        + 'reads the source and trusts it, and the trust is bound to that exact code by hash. See '
        + 'AUTHORING.md, "Code trust".',
      points: ALL_POINTS.map((point) => ({
        id: point.id,
        apiVersion: point.apiVersion,
        // Resolvidos, não crus: enquanto o tradutor do terminal carregava só `core.marketplace`, isto
        // devolvia `@core.data/point.entity.title` — e a `description`, que é o campo que diz PARA QUE
        // SERVE o ponto, era descartada de todo.
        title: describeMessage(point.title),
        description: point.description === undefined ? undefined : describeMessage(point.description),
        ownerPluginId: point.ownerPluginId,
        allowedImplKinds: point.allowedImplKinds,
        implRequired: point.implRequired,
        multiple: point.multiple,
      })),
    }),
  },
  {
    name: 'list_workflow_steps',
    description:
      'The step catalog: every `stepDefinitionId` a workflow may name, with its category, what it '
      + 'receives and what it publishes. Derived from the kernel catalog, not from documentation. '
      + 'THIS is the tool to call before writing a workflow — a step is the one thing a declaration '
      + 'cannot invent, and an id that is not here does not run. Call `describe_workflow_step` for the '
      + 'full input shape of one of them.',
    inputSchema: { type: 'object', properties: {} },
    run: () => pretty({
      kernelVersion: KERNEL_VERSION,
      steps: CORE_STEP_CATALOG.map((step) => ({
        stepDefinitionId: step.id,
        name: describeMessage(step.name),
        description: describeMessage(step.description),
        category: step.category,
        stepType: step.type,
        inputs: step.inputs.map((input) => `${input.id}${input.required ? '' : '?'}: ${input.type}`),
        outputs: step.outputDefinitions.map((output) => `${output.id}: ${output.type}`),
        dynamicOutputs: step.dynamicOutputs?.kind ?? null,
      })),
      controlStepTypes: CONTROL_STEP_TYPES,
      unimplementedStepTypes: UNIMPLEMENTED_STEP_TYPES,
      notes: [
        'Every step of a workflow names one entry above through `stepDefinitionId`, EXCEPT the control '
        + `nodes (${CONTROL_STEP_TYPES.join(', ')}), where it stays empty.`,
        `Step types the engine does not run: ${UNIMPLEMENTED_STEP_TYPES.join(', ') || 'none'}. `
        + 'Declaring one is refused by validate_plugin.',
        'An extension may contribute its own steps to the "workflow.step" point, so a package that '
        + 'declares a dependency may name an id that is not listed here.',
      ],
    }),
  },
  {
    name: 'list_workflow_events',
    description:
      'The event names a workflow may declare in `eventName` — the GRAMMAR, derived from the engine, '
      + 'because the collection half of the name is yours (your screen, a screen of a declared '
      + 'dependency, a screen the organization designed, a collection that already exists). Also says what `event.` carries in each case, '
      + 'which is what decides whether a condition can even answer.',
    inputSchema: { type: 'object', properties: {} },
    run: () => pretty({
      kernelVersion: KERNEL_VERSION,
      forms: [
        {
          eventName: `<collection>.${ENTITY_EVENT_ACTIONS.join(' | <collection>.')}`,
          fires: 'a record of that collection is written or deleted',
          eventPayload: 'the record, plus "changeType" (created | updated) and "old" on a save',
        },
        {
          eventName: `<collection>.${DATE_REACHED_ACTION}`,
          fires: 'a date field of a record arrives, shifted by `dateReached.offset` days, at `dateReached.at` in the '
            + 'organization\'s time zone — once per record and per date value',
          eventPayload: 'the record, as on a save, without "changeType" and "old"',
        },
        ...NESTED_EVENT_SUFFIXES.map((suffix) => ({
          eventName: `<prefix>${suffix}.${ENTITY_EVENT_ACTIONS.join(` | <prefix>${suffix}.`)}`,
          fires: `a ${suffix.slice(1)} of a record changes. <prefix> is the event prefix of the record's screen `
            + `(its \`eventPrefix\`, or its collection), and the screen must show the ${suffix.slice(1)}s tab`,
          eventPayload: `the ${suffix.slice(1)}, plus "parentId", "parentType" (the prefix) and "parent" (the `
            + 'id and the title field of the record it hangs from); "old" on a save',
        })),
        {
          eventName: `lookup.${ENTITY_EVENT_ACTIONS.join(' | lookup.')}`,
          fires: 'an entry of an option list the organization owns changes',
          eventPayload: 'the entry; `lookupCollection` on the workflow names which list',
        },
        {
          eventName: WORKFLOW_CALLED_EVENT,
          fires: 'an action, or another workflow, invokes it — never on its own',
          eventPayload: 'the `parameters` the workflow declares, which become its `event.`',
        },
        {
          eventName: WORKFLOW_SCHEDULE_EVENT,
          fires: `the kernel clock reaches \`schedule.cron\`, in the organization's time zone — checked every `
            + `${WORKFLOW_CLOCK_TICK_MINUTES} minutes, never more often than every ${MIN_SCHEDULE_INTERVAL_MINUTES}`,
          eventPayload: '"scheduledFor" (the instant the cron named) and "firedAt" (when it actually ran) — no record',
        },
      ],
      notes: [
        'The collection half is not enumerable from here on purpose: it is the collection of the '
        + 'screen that declares it, and the kernel knows none by name. Use your own screen\'s '
        + 'collection, or the `eventPrefix` it declares — or the prefix a screen of a DEPENDENCY '
        + 'emits (`order.saved` for a screen over `orders` declaring `eventPrefix: "order"`). That '
        + 'extension must be in `manifest.dependencies`; the prefix is resolved against its screens, '
        + 'and validate_plugin says which one emits it.',
        `"${WORKFLOW_CALLED_EVENT}" is the trigger an action fires. That workflow declares `
        + '`parameters`, and `promptParameters` on the action opens their form before firing.',
        'The same value is addressed three different ways, and telling them apart is the most '
        + 'common mistake in a workflow. A `condition` `fieldPath` is ABSOLUTE over the whole '
        + 'context (`event.payload.x`); an `{ kind: "Event", path }` mapping is RELATIVE to the '
        + 'payload (`x`); and inside an `{ kind: "Expression" }` the name `event` IS the payload '
        + '(`event.x`) — there is no `event.payload` to reach for there, and reaching for one '
        + 'throws instead of reading as empty.',
        `"${WORKFLOW_SCHEDULE_EVENT}" needs \`schedule: { cron }\` beside it — five fields, or @daily / @hourly / `
        + '@weekly / @monthly. It runs in the organization\'s time zone; `schedule.timeZone` overrides it, and is '
        + 'almost never right in an extension, which travels to organizations in other zones. Nothing is in `event` '
        + 'but the instant: query the records the run is about (a `query` step, then a `Loop`). An extension that '
        + 'is deactivated stops firing; one that is not installed has no workflow to fire.',
        `"<collection>.${DATE_REACHED_ACTION}" needs \`dateReached: { field, offset, at? }\` beside it: \`field\` is a `
        + '`date` field of that collection, `offset` is whole days (`-3d` three days before, `0d` on the day, `+1d` the '
        + `day after, up to ${MAX_DATE_REACHED_OFFSET_DAYS}), \`at\` is HH:mm (default ${DEFAULT_DATE_REACHED_AT}). The kernel `
        + 'keeps the "already fired" mark: changing the date fires again for the new one, and a record that reaches '
        + 'the day after `at` fires when it is saved. Dates before the workflow existed never fire.',
        'Who triggered the run is NOT in `event`: it is the `actor` root, `{ id, name, via }`, in any '
        + '`{ kind: "Expression" }` and condition. It is the person on an action and on `run_workflow` '
        + '(`via` "ui", or "agent" over MCP), it is passed on by `call-workflow`, and it is `null` on '
        + 'every `<collection>.saved` / `.deleted` / `.dateReached` and `schedule` trigger — test it with `isEmpty(actor)`.',
      ],
    }),
  },
  {
    name: 'list_record_commands',
    description:
      'The platform\'s own record gestures — what an action may run through `command` instead of '
      + '`workflowId`. Derived from the kernel, so an extension that adds one shows up here.',
    inputSchema: { type: 'object', properties: {} },
    run: () => pretty({
      kernelVersion: KERNEL_VERSION,
      commands: Object.values(RECORD_ACTION_METADATA).map((action) => ({
        command: action.key,
        title: describeMessage(action.title),
        danger: action.danger ?? false,
        requiresRecordPermission: action.requiresRecordPermission ?? null,
        requiresTags: action.requiresTags ?? false,
      })),
      note:
        'In an action, `command` and `workflowId` are exclusive and `command` wins; with `command`, '
        + '`workflowId` may be omitted, and an action with neither is refused. A screen offers '
        + 'the action by naming its templateId in `cardActionIds` or `viewActionIds`.',
    }),
  },
  {
    name: 'list_expression_functions',
    description:
      'The functions available to every declarative expression of this installation — a field\'s '
      + '"compute" / "validate" / "hidden when", an action\'s "hidden when", a nav badge, a workflow '
      + 'condition. Derived from the engine itself, not from documentation. AUTHORING.md, '
      + '"Expressions", has the scope each slot sees, which is what decides whether an expression is '
      + 'even able to answer.',
    inputSchema: { type: 'object', properties: {} },
    run: () => pretty({
      kernelVersion: KERNEL_VERSION,
      functions: [...FIELD_EXPRESSION_FUNCTION_NAMES].sort(),
      operators: ['+', '-', '*', '/', '%', '^', '==', '!=', '>', '>=', '<', '<=', 'and', 'or', 'not', '!', '? :', 'in'],
      note:
        'A name resolved as an operator is not repeated as a function: "not", "abs", "ceil" and '
        + '"floor" work through the operator form. "hasPermission" answers about whoever is looking, '
        + 'and accepts the patterns "<entity>.delete", "*.delete", "invoices.*" and "invoice%.read". '
        + '"addBusinessDays", "businessDaysBetween", "isBusinessDay" and "nextBusinessDay" count with the '
        + 'business-day calendars an extension declares on "time.business.calendar"; a missing calendar '
        + 'or year is a refusal, never a count without the holidays.',
    }),
  },
  {
    name: 'list_report_options',
    description:
      'The report vocabulary this installation actually executes: the folds and what each does with '
      + 'the groupings, the chart kinds, the date buckets, the measure operations, and the capability '
      + 'tokens. Derived from the kernel, so it is what THIS version answers for — a fold or a chart '
      + 'kind outside it degrades with a visible warning rather than failing. Read it before writing a '
      + '`spec`, together with AUTHORING.md, "Reports": this tool says WHAT exists, that section says '
      + 'which question each fold answers.',
    inputSchema: { type: 'object', properties: {} },
    run: () => pretty({
      kernelVersion: KERNEL_VERSION,
      // Grouping and showing are two questions. Conflating them is what made a ten-field report
      // render ten indent levels in a single column, so the fold table answers both separately.
      folds: REPORT_SHAPE_KINDS.map((kind) => ({ kind, ...(REPORT_FOLD_NOTES[kind] ?? {}) })),
      chartKinds: [...REPORT_CHART_KINDS],
      granularities: [...REPORT_GRANULARITIES],
      measureOps: [...NUMERIC_AGGREGATION_OPS],
      capabilities: [...REPORT_CAPABILITIES],
      note:
        'A chart plots GROUPS: it reads one level of `groupBy` / `rows` and draws a point per member '
        + 'of it. So `summary`, `matrix` and a `tabular` WITH `groupBy` all draw; a `tabular` without '
        + 'grouping does not, and a chart declared on one is warned instead of rendered empty. '
        + '`spec.requires` is DERIVED from the spec and never written by hand — it is what lets an '
        + 'older kernel refuse a report by the name of the feature it lacks instead of answering with '
        + 'a different number under the same label.',
    }),
  },
  {
    name: 'list_icons',
    description:
      'Every icon key this installation can draw. `icon` is a key from this catalogue everywhere it '
      + 'appears — a screen, a nav item, a tab, a widget, a menu item, an action, a list card field '
      + '(`ui.list.icon`) and the extension itself. There is no free naming, and no Remix or Material '
      + 'name: a key outside this list is refused by validate_plugin. Derived from the kernel, so it is '
      + 'exactly what the installed version knows how to draw — read it BEFORE writing an icon, because '
      + 'guessing one costs nothing at build time and shows up as the generic marker on the screen of '
      + 'whoever installed the extension.',
    inputSchema: { type: 'object', properties: {} },
    run: () => pretty({
      kernelVersion: KERNEL_VERSION,
      total: SCREEN_ICON_KEYS.length,
      icons: [...SCREEN_ICON_KEYS],
      note:
        'The kernel draws the generic marker for a key it does not know, so a typo never fails at '
        + 'runtime. That is why the package gate refuses it instead: validate_plugin reports the icon '
        + 'and where it was written.',
    }),
  },
  {
    name: 'list_examples',
    description:
      `The first-party extensions that travel in ${EXAMPLES_DIR}/ as source to read, and — the part no package `
      + 'answers — which MECHANISM each one is the best one to read for. Read it before writing a mechanism for '
      + 'the first time, and before guessing which folder to open: it is the question that comes before '
      + 'describe_extension. They are ours, nobody in this organization wrote them, nothing here installs them, '
      + 'and the whole directory is rewritten whenever this installation takes a new platform version.',
    inputSchema: { type: 'object', properties: {} },
    run: (_input, root) => pretty(listExamples(root)),
  },
  {
    name: 'list_workspace_plugins',
    description:
      'The extensions authored in this workspace — the ones somebody here wrote —, with their id, version, '
      + 'current problems and, the part a sibling needs, what each one declares in `manifest.exports`, which '
      + `is the only surface of it another extension may reference. What sits in ${EXAMPLES_DIR}/ is ours and `
      + 'is named apart: it is reading material, not work of this organization.',
    inputSchema: { type: 'object', properties: {} },
    run: (_input, root) => {
      const { authored, examples } = findPluginFiles(root);
      const reference = examples.length === 0 ? '' : `\n\n${examples.length} first-party extension(s) also sit `
        + `in ${EXAMPLES_DIR}/, as source to READ: ${examples.map((one) => relative(root, one)).join(', ')}. `
        + 'They are not in the list above because nobody here wrote them and nothing here installs them — they '
        + 'are rewritten whenever this installation takes a new platform version.';

      if (authored.length === 0) {
        return 'No extension is authored in this directory. Create one with "microteia-plugin create".' + reference;
      }

      return authored.map((entry) => {
        try {
          const result = buildPlugin({ entry });
          const { manifest } = result.package;
          /**
           * A superfície exportada da IRMÃ era o que faltava aqui, e é o caso mais comum de
           * compartilhamento: o escritório escreve a `utils` e quem a usa lado a lado, e a `utils` não
           * está instalada em lugar nenhum — logo o retrato da instalação não a alcança. O que se
           * enxergava era id, versão e problemas; nunca o nome de nada dentro dela.
           */
          const describe = packageText(result.package);
          const surface = exportedSurface(result.package)
            .map((one) => ({ ...one, name: describe(one.name) }));
          const exported = surface.length === 0
            ? '  exports nothing — every artifact of it is private to it'
            : surface.map((one) => `  exports ${manifest.id}/${one.id} — ${one.name} (${one.kind})`).join('\n');
          return `${relative(root, entry)}\n  ${manifest.id} v${manifest.version} — `
            + `${describeIssues(result.issues)}\n${exported}`;
        } catch (error) {
          return `${relative(root, entry)}\n  does not compile: ${error instanceof Error ? error.message : String(error)}`;
        }
      }).join('\n\n') + reference;
    },
  },
  {
    name: 'list_referenceable',
    description:
      'Everything this directory can see that another extension exports — the artifacts you may point a '
      + 'step at with "<extension-id>/<source-id>", already in the form the reference takes. Two sources: '
      + 'the plugin.ts files here (a sibling being authored beside yours, which no snapshot can know about) '
      + 'and the extensions in the installation snapshot. Each line says which, because a plugin.ts is the '
      + 'truth of now and a snapshot ages. A name you cannot see is a name you cannot write.',
    inputSchema: { type: 'object', properties: {} },
    run: (_input, root) => {
      const read = readWorkspaceCatalog(root);
      const artifacts = referenceableArtifacts(read);
      return pretty({
        total: artifacts.length,
        catalogSources: catalogProvenance(read),
        referenceable: artifacts.map((one) => ({
          ref: one.ref,
          name: one.name,
          kind: one.kind,
          from: one.from,
          writtenIn: one.writtenIn,
          ...(one.disabled ? { extensionSwitchedOff: true } : {}),
        })),
        alsoRequired:
          'Referencing one of these means declaring the owner in `manifest.dependencies`. validate_plugin '
          + 'refuses a qualified reference that is not covered by a declared dependency, and the authoring '
          + 'screen derives the dependency from what the package points at.',
      });
    },
  },
  {
    name: 'list_nav_groups',
    description:
      'Every sidebar group this directory can see, by KEY — the platform\'s, the plugin.ts files here, the '
      + `first-party extensions in ${EXAMPLES_DIR}/ and the extensions in the installation snapshot —, with `
      + 'the name it shows in each language and who declares it. A group is joined by key, never by name: two '
      + 'keys draw two groups even when both are called the same. Read it BEFORE declaring a navGroup() or '
      + 'writing `group:` on a menu entry, and reuse the key of a group that already serves the purpose.',
    inputSchema: { type: 'object', properties: {} },
    run: (_input, root) => {
      const read = readWorkspaceCatalog(root);
      const visible = visibleNavGroups(root, read);
      return pretty({
        groups: summarizeNavGroups(visible.declarations),
        sameNameDifferentKeys: sameNameDifferentKeys(visible.declarations),
        installationSnapshot: visible.installationKnown === null
          ? `none — run "microteia export-catalog --tenant <tenantId>" in the installation to see the groups `
            + 'of the extensions installed there, including third-party ones'
          : visible.installationKnown
            ? 'read'
            : `${INSTALLED_CATALOG_FILE} was taken by a Console that did not record sidebar groups; export it again`,
        ...(visible.failures.length === 0 ? {} : { notCompiled: visible.failures }),
        rule: 'Declaring a key another package declares joins ONE group, labelled and placed by whichever loads '
          + 'first — declare it anyway, so the entry stays grouped when that package is not installed. A new key '
          + 'is for a purpose no listed group serves.',
      });
    },
  },
  {
    name: 'workspace_info',
    description:
      'What this workspace is bound to: the kernel contract version, whether an installation is '
      + 'connected, where the curated type declarations live, the extensions authored here and the '
      + `first-party ones that travel in ${EXAMPLES_DIR}/ as source to read.`,
    inputSchema: { type: 'object', properties: {} },
    run: (_input, root) => {
      const configPath = join(root, '../.microteia/firebase-config.json');
      const connected = existsSync(configPath);
      const files = findPluginFiles(root);
      return pretty({
        kernelVersion: KERNEL_VERSION,
        workspace: root,
        hostTypes: hostTypesPath(root),
        installationConnected: connected,
        // O projeto Firebase é do escritório; o servidor o REPORTA, nunca o usa para escrever.
        firebaseProjectId: connected
          ? (JSON.parse(readFileSync(configPath, 'utf8')) as { projectId?: string }).projectId ?? null
          : null,
        /**
         * O prefixo de todo id escrito aqui. `null` quer dizer que ninguém o decidiu ainda — e o agente
         * pergunta, em vez de copiar o dos exemplos.
         */
        namespace: workspaceNamespace(root),
        namespaceRule: workspaceNamespace(root) === null
          ? 'No namespace is recorded in package.json (microteia.namespace). Ask which reverse-DNS namespace '
            + 'is this organization\'s before creating an extension; never copy the one in examples/.'
          : `Every extension authored here is ${workspaceNamespace(root)}.<name>.`,
        plugins: files.authored.map((entry) => relative(root, entry)),
        /**
         * Listados à parte de propósito: são nossos, são reescritos a cada troca de kernel, e listá-los
         * junto dos do escritório era o que fazia um agente atribuir a autoria deles a quem lê.
         */
        examples: files.examples.map((entry) => relative(root, entry)),
      });
    },
  },
];

/**
 * A URI de cada leitura pura. Ela é o que um cliente anexa ao contexto, então é contrato — mais
 * frágil que o nome de uma ferramenta, porque renomeá-la quebra o anexo sem erro nenhum.
 */
/**
 * O que cada dobra faz com os NÍVEIS e com as dimensões que não são níveis.
 *
 * Prosa, e por isso emparelhada com `REPORT_SHAPE_KINDS` em vez de escrita como lista própria: uma
 * dobra nova sem nota aqui é reprovada no teste, e a lista servida continua sendo a do kernel.
 */
const REPORT_FOLD_NOTES: Record<string, { oneRowIs: string; levels: string; otherDimensions: string }> = {
  tabular: {
    oneRowIs: 'a RECORD',
    levels: '`groupBy`, optional — each group opens with its value, its records follow with the same '
      + 'columns, and the group total closes it',
    otherDimensions: '`columns`, in that order',
  },
  summary: {
    oneRowIs: 'a GROUP',
    levels: '`groupBy`, required — an empty one is refused',
    otherDimensions: 'shown nowhere; the platform warns, naming each of them',
  },
  matrix: {
    oneRowIs: 'a group crossed with a column',
    levels: '`rows` and `columns`, both required — this version reads one level of `columns`',
    otherDimensions: 'shown nowhere; the platform warns, naming each of them',
  },
};

const PURE_READ_URIS: Record<string, string> = {
  list_entities: 'microteia://entities',
  list_examples: 'microteia://examples',
  list_extension_points: 'microteia://extension-points',
  list_workflow_steps: 'microteia://workflow/steps',
  list_workflow_events: 'microteia://workflow/events',
  list_record_commands: 'microteia://record-commands',
  list_report_options: 'microteia://reports/options',
  list_icons: 'microteia://icons',
  list_expression_functions: 'microteia://expression-functions',
  list_workspace_plugins: 'microteia://workspace/plugins',
  list_referenceable: 'microteia://referenceable',
  list_nav_groups: 'microteia://nav-groups',
  workspace_info: 'microteia://workspace/info',
};

const pureRead = (name: string, root: string): string => {
  const entry = PURE_READS.find((one) => one.name === name);
  if (entry === undefined) throw new Error(`Unknown read "${name}".`);
  return entry.run({}, root);
};

// ─── Recursos ─────────────────────────────────────────────────────────────────

interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: (root: string) => string;
}

/**
 * O que é RECURSO e o que é FERRAMENTA, e por que a distinção não é decorativa.
 *
 * Ferramenta é uma pergunta com resposta variável; recurso é um documento estável que o cliente pode
 * anexar ao contexto sem gastar uma chamada. O schema do modelo e o catálogo de entidades são
 * exatamente isso — o primeiro é a forma que o modelo tem de ter antes de a primeira linha ser
 * escrita, o segundo é o que já existe. Servi-los só por tool obrigaria o agente a lembrar de
 * perguntar, e o defeito que esta camada persegue nasce justamente de não perguntar.
 */
const RESOURCES: ResourceDefinition[] = [
  {
    uri: 'microteia://domain-model/schema',
    name: 'Domain model schema',
    description:
      'The JSON Schema of the domain model this installation validates. Every enum in it is derived from the '
      + 'kernel itself — the field types, the aggregation operators, the four ways a relationship can be stored — '
      + 'so it never describes a contract other than the one installed here.',
    mimeType: 'application/json',
    read: () => pretty(domainModelJsonSchema()),
  },
  {
    uri: 'microteia://entities',
    name: 'Entities this workspace knows',
    description:
      'The entity catalog: the two the kernel declares, every collection the plugin.ts files here describe, and '
      + 'everything the organization runs when a snapshot of the installation has been exported into this directory. '
      + 'Read it BEFORE modelling: a field that belongs to another entity is a defect only if that entity exists, '
      + 'and this is where you find out. It reads no database — the snapshot is a file the Console writes, and the '
      + 'answer says when it was taken.',
    mimeType: 'application/json',
    read: (root) => pureRead('list_entities', root),
  },
  {
    uri: 'microteia://domain-model/rules',
    name: 'Domain model rules',
    description:
      'Every check the model is put through, and how each storage maps to a real mechanism. Derived from the '
      + 'validator, not written beside it.',
    mimeType: 'text/markdown',
    read: () => [
      '# Domain model rules',
      '',
      `> ${SCREEN_IS_NOT_AN_ENTITY_MODEL}`,
      '',
      'Model the domain before writing an artifact. The pipeline is: understand the request, name the entities, '
      + 'declare the relationships, pass `validate_domain_model`, then `generate_artifact_plan`, then write the '
      + 'package and run `validate_plugin`.',
      '',
      '## Duplication is allowed. Silent duplication is not.',
      '',
      'The rule is not "never duplicate". It is: data that is a source of truth stays normalized unless there is an '
      + 'explicit semantic reason to materialise or snapshot it. A line item\'s unit price is a valid snapshot — '
      + 'the price charged on the day must not change when the catalogue does. Declare it: '
      + '`{ semanticType: "snapshot", source: "Product.price", reason: "..." }`, or use the relationship\'s '
      + '`denormalize`, which is the platform\'s own mechanism and keeps the copy in step.',
      '',
      '## How a relationship is stored',
      '',
      '| storage | cardinality | what is declared | what is stored |',
      '|---|---|---|---|',
      ...STORAGE_MECHANISMS.map((one) =>
        `| \`${one.storage}\` | ${one.cardinalities.join(', ')} | ${one.declaration} | ${one.storedAs} |`),
      '',
      'A relationship is declared from the side that STORES the link. `one-to-many` is the one exception — it is '
      + 'written from the "one" side, the way the business sentence arrives, and inverted before anything reads it.',
      '',
      `Nested objects: this platform has no object field and no dotted field key, so an embedded value object is `
      + `stored flat with a section (strategy \`${EMBEDDED_STRATEGY}\`), which keeps its leaves reachable from `
      + '`compute`, `validate` and the list filter.',
      '',
      '## What HAPPENS, and how each part is really declared',
      '',
      `> ${A_STATE_IS_A_KEY}`,
      '',
      'The structure is half the request. The other half — what moves a record, when, and who may — arrives in the same '
      + 'sentence, and it goes in the `behavior` block of the same model, checked by the same gate. A state machine is '
      + 'a select served by a list; a transition is a workflow plus, when a person causes it, the record action that '
      + 'invokes it.',
      '',
      '| declares | mechanism | written as |',
      '|---|---|---|',
      ...BEHAVIOR_MECHANISMS.map((one) =>
        `| \`${one.declares}\` (${one.concern})${one.supported ? '' : ' — **REFUSED**'} | ${one.mechanism} | ${one.declaredAs} |`),
      '',
      'A row marked REFUSED has no mechanism, and the plan says so instead of translating it into something that '
      + 'looks similar. A CLOCK (`schedule`) has one: it moves records on at a time, and never stops them being '
      + 'written. A guard is a condition over the ONE record in hand: when it needs to read others, the `query` step '
      + 'is the path, not a workaround.',
      '',
      '## What cannot repeat — the one rule that is declared, never computed',
      '',
      'Uniqueness is the single rule on this platform that compares one record against the others, and it is the '
      + 'single one you must NOT write as an expression. A field `validate` and a `validate-object` step both see one '
      + 'record and never query; a workflow on `<collection>.saved` finds the duplicate AFTER it exists, and two writes '
      + 'at the same instant both pass. So it is declared:',
      '',
      '```json',
      '{ "name": "Product", "kind": "entity", "titleField": "name",',
      '  "keys": [',
      '    { "name": "sku", "kind": "primary", "fields": ["sku"], "sparse": false },',
      '    { "name": "line-name", "kind": "unique", "fields": ["line", "name"] }',
      '  ],',
      '  "fields": [{ "key": "email", "label": "Email", "semanticType": "scalar",',
      '               "unique": true }] }',
      '```',
      '',
      '`unique: true` on a field is the shorthand for a key over that one field, named `field:<key>`; reach for '
      + '`keys` when the COMBINATION of several fields is what must not repeat, or when you need a scope, a '
      + 'comparison, or a value that is required.',
      '',
      '| what you declare | what it means |',
      '|---|---|',
      '| `kind: "unique"` | forbids a second record with this value. |',
      '| `kind: "primary"` | that, plus the key becomes an ADDRESS: the import, and an `upsert` step or script `upsert()` '
      + 'with `matchPrimaryKey: true`, find the record by it and update it instead of refusing a duplicate. At most one '
      + 'per entity, and never optional. |',
      '| `scope: "parent"` | unique WITHIN one parent record — the item numbered 1 of EACH order. Needs a '
      + 'relationship with storage "child". |',
      '| `normalize` | how two values count as the same: `trim` (on by default), `caseInsensitive`, and '
      + '`formatPreset` — `digits` makes `123.456` and `123456` one value. |',
      '| `sparse` | on by default: a record with no value reserves nothing, so forty records with an empty field do '
      + 'not collide in the void. |',
      '',
      'How it holds, and what it costs: the value is written into a reservation document whose id derives from the '
      + 'value itself, in the SAME batch as the record. Creating that document is the lock — the security rules allow '
      + '`create` and not `update`, and `create` only fires when the document does not exist — so the batch fails '
      + 'whole and no duplicate is ever committed. It needs no composite index.',
      '',
      'What it is NOT: the document id. That stays random, because a natural key changes — the CPF was typed wrong — '
      + 'and moving a document would break every reference pointing at it.',
      '',
      'And a key declared on a collection that ALREADY has records does not hold on the day it is installed: it is '
      + 'born pending, somebody sweeps what is stored, and it starts holding once nothing is duplicated. The plan says '
      + 'which keys need that sweep.',
      '',
      'And a permission is only answerable when a person acts. With no actor — an automation born from a save — '
      + '`hasPermission` answers false, always, so a permission on an event trigger is a flow that never runs.',
      '',
      '## Screens — decided by rule',
      '',
      'The plan does not only say which collections must exist; it says what the SCREEN is. Those decisions are rules, '
      + 'not taste, and here they are. What the rules do NOT decide, the plan hands back named — an icon and a menu '
      + 'order are statements about the business, and a plan that guesses them looks complete and is not.',
      '',
      '| what arrives | what is decided | declared as |',
      '|---|---|---|',
      ...SCREEN_PLAN_RULES.map((one) => `| ${one.subject} | ${one.decides} | ${one.declaredAs} |`),
      '',
      'Left to a person, every time:',
      '',
      ...SCREEN_PLAN_HUMAN_DECISIONS.map((one) => `- ${one}`),
      '',
      '## Checks',
      '',
      '| code | severity | what it catches |',
      '|---|---|---|',
      ...detectorList().map((one) => `| \`${one.code}\` | ${one.severity} | ${one.summary} |`),
      '',
      'ERROR blocks the artifact plan. WARNING and INFO do not. Every problem carries a `suggestion` and a '
      + '`howToDeclareException` — when there is no exception, it says so, and that is an answer too.',
      '',
    ].join('\n'),
  },
  {
    uri: 'microteia://example-coverage',
    name: 'Which mechanism has an example, and which has none',
    description:
      'Every extension point, package artifact and manifest property of this platform, against the examples in '
      + 'examples/ — which ones show it, which have no example, and which NO example could show because they are out '
      + 'of reach for an extension. Read it before concluding that this platform cannot do something: the answer is '
      + 'usually an example you have not opened, or a different road that this report names.',
    mimeType: 'application/json',
    read: (root: string) => JSON.stringify(exampleCoverageReport(root), null, 2),
  },
  {
    uri: 'microteia://domain-model/coverage',
    name: 'What the domain model cannot say',
    description:
      'The mechanisms this platform HAS and the domain model has no vocabulary for — derived from the step catalog, '
      + 'the event catalog, the extension points and the package types themselves. Read it when a rule seems to need '
      + 'something the model will not express: the answer is probably here, with what it costs. It is a report, not a '
      + 'roadmap.',
    mimeType: 'text/markdown',
    read: () => {
      const summary = coverageSummary();
      const gaps = coverageGaps();
      return [
        '# Mechanism coverage of the domain model',
        '',
        `Of ${mechanismCoverage().length} mechanisms on this platform, the model's vocabulary reaches `
        + `${mechanismCoverage().length - gaps.length} and does NOT reach ${gaps.length}.`,
        '',
        'This list is DERIVED: the steps come from the step catalog, the events from the event catalog, the points '
        + 'from the point arrays, and the properties from the package types — which are closed by `keyof`, so a '
        + 'property added to a screen, an action, a workflow or the manifest does not compile until somebody says '
        + 'whether the model should be able to ask for it.',
        '',
        'It exists because of one defect and its whole family: a `user-action` transition produced a callable flow '
        + 'with no description, and without a description the flow is invisible to the step that picks a flow from a '
        + 'sentence. The model had no way to know — there was no description field. Nobody found out for three '
        + 'phases. A mechanism with no vocabulary is invisible until somebody trips over it, and the answer to that '
        + 'is not attention: it is a derived list, with a test.',
        '',
        '| surface | total | reached | gaps |',
        '|---|---|---|---|',
        ...summary.map((one) => `| ${one.surface} | ${one.total} | ${one.reached} | ${one.gaps} |`),
        '',
        '## What is out of reach, and what it costs',
        '',
        ...summary.filter((one) => one.gaps > 0).flatMap((line) => [
          `### ${line.surface}`,
          '',
          ...gaps.filter((one) => one.surface === line.surface)
            .map((one) => `- \`${one.id}\` — ${one.note.replace('NO VOCABULARY: ', '')}`),
          '',
        ]),
        'When a rule needs one of these, say so and hand the decision back. Translating it into something that looks '
        + 'similar is the one failure mode this whole subsystem exists to prevent.',
        '',
      ].join('\n');
    },
  },
  ...PURE_READS.map((one) => ({
    uri: PURE_READ_URIS[one.name],
    name: one.name.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase()),
    description: one.description,
    mimeType: one.name === 'list_workspace_plugins' ? 'text/plain' : 'application/json',
    read: (root: string) => one.run({}, root),
  })).filter((one) => one.uri !== 'microteia://entities'),
];

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * O laço stdio. Notificação (sem `id`) não tem resposta — responder a uma quebra o cliente, e é o
 * erro mais fácil de cometer aqui.
 */
export const serveMcp = (root: string): Promise<number> => new Promise((resolveServer) => {
  const respond = (id: unknown, result: unknown): void => {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
  };
  const respondError = (id: unknown, code: number, message: string): void => {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
  };

  const handle = (request: JsonRpcRequest): void => {
    const { id, method, params = {} } = request;

    if (method === 'initialize') {
      respond(id, {
        protocolVersion: PROTOCOL_VERSION,
        // As três declaradas, e cada uma porque um cliente correto NÃO chama o método de uma
        // capability que o servidor não declarou. Sem `resources`, o schema do modelo e o catálogo de
        // entidades ficariam servidos por um método que ninguém pergunta.
        //
        // `prompts` ficava de fora com o argumento de que "não há aqui texto para o usuário
        // escolher", e o argumento estava errado: a ORDEM de trabalhar uma regra de negócio —
        // entender, modelar, validar, planejar — é exatamente um texto para o usuário escolher, e
        // enquanto ela vivia num parágrafo do AGENTS.md ela valia para quem tinha lido o AGENTS.md.
        // Ver `prompts.ts`.
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: 'microteia-plugin', version: KERNEL_VERSION },
      });
      return;
    }

    if (method === 'notifications/initialized' || method.startsWith('notifications/')) return;

    if (method === 'tools/list') {
      respond(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
      return;
    }

    if (method === 'resources/list') {
      respond(id, {
        resources: RESOURCES.map(({ uri, name, description, mimeType }) => ({ uri, name, description, mimeType })),
      });
      return;
    }

    if (method === 'prompts/list') {
      respond(id, {
        prompts: MCP_PROMPTS.map(({ name, description, arguments: args }) => ({
          name,
          description,
          arguments: args,
        })),
      });
      return;
    }

    if (method === 'prompts/get') {
      const name = params.name as string;
      try {
        const { description, text } = renderMcpPrompt(
          name,
          (params.arguments as Record<string, string>) ?? {},
          promptContext(),
        );
        respond(id, { description, messages: [{ role: 'user', content: { type: 'text', text } }] });
      } catch (error) {
        respondError(id, -32602, error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (method === 'resources/read') {
      const uri = params.uri as string;
      const resource = RESOURCES.find((candidate) => candidate.uri === uri);
      if (resource === undefined) {
        respondError(id, -32602, `Unknown resource "${uri}". Call resources/list.`);
        return;
      }
      try {
        respond(id, { contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.read(root) }] });
      } catch (error) {
        respondError(id, -32603, error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (method === 'tools/call') {
      const name = params.name as string;
      const tool = TOOLS.find((candidate) => candidate.name === name);
      if (tool === undefined) {
        respondError(id, -32602, `Unknown tool "${name}".`);
        return;
      }
      try {
        const text = tool.run((params.arguments as Record<string, unknown>) ?? {}, root);
        respond(id, { content: [{ type: 'text', text }] });
      } catch (error) {
        // Erro de ferramenta volta como CONTEÚDO, não como erro de protocolo: é o que permite ao
        // modelo ler a mensagem e corrigir, em vez de a chamada só falhar.
        respond(id, {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        });
      }
      return;
    }

    if (id !== undefined && id !== null) respondError(id, -32601, `Method "${method}" not found.`);
  };

  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line !== '') {
        try {
          handle(JSON.parse(line) as JsonRpcRequest);
        } catch {
          respondError(null, -32700, 'Parse error.');
        }
      }
      newline = buffer.indexOf('\n');
    }
  });
  process.stdin.on('end', () => resolveServer(0));
});

/**
 * O que o prompt nomeado pode CITAR: as ferramentas e os recursos que este servidor de fato publica.
 * Derivado, e não uma lista ao lado — um prompt que mandasse chamar uma ferramenta renomeada manda o
 * agente contra uma parede, e é o tipo de erro que só aparece na máquina de quem instalou.
 */
const promptContext = (): { toolNames: string[]; resourceUris: string[] } => ({
  toolNames: TOOLS.map((tool) => tool.name),
  resourceUris: RESOURCES.map((resource) => resource.uri),
});

/** Exposto para teste: a lista de ferramentas é contrato com quem escreve o prompt do lado do cliente. */
export const mcpToolNames = (): string[] => TOOLS.map((tool) => tool.name);

/**
 * Idem para os prompts: o NOME de um prompt é o que o autor escolhe no editor, e renomeá-lo quebra o
 * gesto sem erro nenhum.
 */
export const mcpPrompts = (): { name: string; args: string[] }[] =>
  MCP_PROMPTS.map((one) => ({ name: one.name, args: one.arguments.map((arg) => arg.name) }));

export const readMcpPrompt = (name: string, args: Record<string, string> = {}): string =>
  renderMcpPrompt(name, args, promptContext()).text;

/** O esquema de entrada de cada ferramenta — é ele que prova que nenhuma delas é leitura pura. */
export const mcpTools = (): { name: string; inputSchema: Record<string, unknown> }[] =>
  TOOLS.map(({ name, inputSchema }) => ({ name, inputSchema }));

/** Idem, para os recursos: a URI é o que um cliente anexa ao contexto, e renomeá-la quebra o anexo. */
export const mcpResourceUris = (): string[] => RESOURCES.map((resource) => resource.uri);

export const readMcpResource = (uri: string, root: string): string => {
  const resource = RESOURCES.find((candidate) => candidate.uri === uri);
  if (resource === undefined) throw new Error(`Unknown resource "${uri}".`);
  return resource.read(root);
};

export const runMcpTool = (name: string, input: Record<string, unknown>, root: string): string => {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (tool === undefined) throw new Error(`Unknown tool "${name}".`);
  return tool.run(input, root);
};
