import type { ActionModuleTemplate, MarketplacePlugin, ScreenModuleTemplate, WorkflowModuleTemplate } from '../../domain/entities/MarketplacePlugin';
import { KERNEL_EXTENSION_POINTS } from '../../domain/schema/extensionPoints';
import type { PluginManifest } from '../../domain/schema/plugin/pluginManifest';
import type { ExtensionPointDefinition } from '../../domain/schema/plugin/extensionPoint';
import { WORKFLOW_EVENT_CATALOG } from '../../domain/schema/eventCatalog';
import { WORKFLOW_SCHEDULE_EVENT } from '../../domain/schema/workflowClock';
import {
  CONTROL_STEP_TYPES,
  CORE_STEP_CATALOG,
  CORE_STEP_DEFINITION_IDS,
  UNIMPLEMENTED_STEP_TYPES,
} from '../../domain/schema/workflowStepCatalog';
import { BEHAVIOR_MECHANISMS } from './behaviorMapping';

/**
 * O RELATÓRIO DE COBERTURA — que mecanismos desta plataforma o vocabulário do modelo NÃO alcança.
 *
 * Ele nasceu de um defeito nomeado, e o defeito é a família, não o caso. Uma transição `user-action`
 * produzia um fluxo chamável SEM descrição, e sem descrição ele é invisível para a detecção por IA — o
 * filtro está no passo e outra vez no serviço. O modelo não tinha como saber: não havia campo de
 * descrição na transição. Descobriu-se por acidente, três fases depois de a transição existir.
 *
 * A lição não é "acrescente descrição". É que **um mecanismo sem vocabulário é invisível até alguém
 * tropeçar nele**, e a resposta a isso não é atenção — é uma lista derivada, com teste. Este arquivo
 * percorre a superfície REAL: os passos registrados, os eventos do catálogo, os pontos de contribuição
 * e as propriedades que o plano poderia preencher. Cada item diz qual vocabulário do modelo o alcança,
 * ou `null`.
 *
 * Duas coisas o mantêm honesto, e as duas são mecânicas:
 *
 * - **Os `Record<keyof …>` fecham por tipo.** Uma propriedade nova em `ScreenModuleTemplate`, em
 *   `ActionModuleTemplate`, em `WorkflowModuleTemplate` ou no `PluginManifest` NÃO COMPILA até ganhar
 *   uma linha aqui — dizendo o que a alcança, ou dizendo que nada a alcança. É a mesma disciplina de
 *   `Record<DomainIssueCode, Detector>` e de `Record<CustomFieldType, string>`.
 * - **As listas de passo, de evento e de ponto são percorridas, não copiadas.** Um passo registrado
 *   amanhã aparece aqui como não classificado, que é a mesma coisa que uma lacuna.
 *
 * E o que ele NÃO faz: implementar nada do que revela. A lista É a entrega. Fechar uma lacuna é uma
 * decisão sobre o que o modelo deve saber dizer, e essa decisão não se toma dentro do relatório que a
 * revelou.
 */

export const COVERAGE_SURFACES = [
  'workflow-step',
  'step-input',
  'workflow-event',
  'extension-point',
  'package-artifact',
  'screen-property',
  'action-property',
  'workflow-property',
  'manifest-property',
] as const;
export type CoverageSurface = (typeof COVERAGE_SURFACES)[number];

export interface CoverageItem {
  surface: CoverageSurface;
  /** O identificador do mecanismo, como o kernel o chama. */
  id: string;
  /** O vocabulário do modelo que o alcança, ou `null` quando nada o alcança. */
  reachedBy: string | null;
  /** O que ele faz, e — quando é lacuna — o que custa não poder dizê-lo. */
  note: string;
}

// ─── Passos ───────────────────────────────────────────────────────────────────

/**
 * Os passos que o vocabulário do comportamento realmente pede, DERIVADOS de `BEHAVIOR_MECHANISMS`:
 * cada linha suportada da tabela cita os `stepIds` que ela produz. Nada aqui é escrito à mão, e é o
 * que impede a cobertura de afirmar que um passo é alcançado depois de a tabela deixar de citá-lo.
 */
const stepReach = (): Map<string, string> => {
  const reach = new Map<string, string>();
  for (const mechanism of BEHAVIOR_MECHANISMS) {
    if (!mechanism.supported) continue;
    for (const step of mechanism.stepIds) {
      if (!reach.has(step)) reach.set(step, `${mechanism.concern} "${mechanism.declares}"`);
    }
  }
  return reach;
};

/** O que cada passo NÃO alcançado faz, e o que custa o modelo não poder pedi-lo. */
const STEP_GAP_NOTES: Record<string, string> = {
  query: 'reads other records. It is the missing half of every rule that compares one record with the rest — the guard '
    + 'that needs other records is refused precisely because the model cannot ask for this step',
  map: 'reshapes a list before writing it. Without it the model can say "create a record", never "create one per child"',
  'set-variable': 'holds a value between steps. The model declares no intermediate value at all',
  Loop: 'repeats over a list. Every rule that says "for each" needs it, and the model has no way to say "for each"',
  script: 'runs reviewed code. Deliberately out of reach: a rule that needs code is not a rule this gate should be '
    + 'translating on its own',
  'register-audit': 'writes an audit entry. The model cannot say a passage must be recorded, and `auditActions` on the '
    + 'screen is the other half of the same gap',
  'ai-detect-workflow': 'picks a flow from a sentence. Nothing in the model asks for it — and it is the step whose '
    + 'candidate filter made the missing transition description matter in the first place',
  'ai-extract-parameters': 'pulls parameters out of a text. The model has no notion of an incoming message to read',
  'render-document': 'fills a document template with a record and attaches the file. The model has no effect for '
    + '"produce a document" — "when the order is approved, generate the receipt" cannot be said',
  'share-documents': 'shares the documents a record already has with the portal. The model has no notion of the portal, '
    + 'so "the guest sees the attachments once the order is confirmed" cannot be said',
  'portal-invite': 'gives someone from outside access to a record in the portal. The model has no notion of the portal, '
    + 'so "when the representative is approved, invite them" cannot be said',
  'portal-revoke': 'removes a guest\'s access to a record in the portal. The model has no notion of the portal, '
    + 'so "when the representative leaves, remove their access" cannot be said',
};

const stepItems = (): CoverageItem[] => {
  const reach = stepReach();
  const ids = [...CORE_STEP_DEFINITION_IDS, ...CONTROL_STEP_TYPES]
    .filter((id) => !(UNIMPLEMENTED_STEP_TYPES as readonly string[]).includes(id));

  return ids.map((id) => {
    const reachedBy = reach.get(id) ?? null;
    const metadata = CORE_STEP_CATALOG.find((one) => one.id === id);
    return {
      surface: 'workflow-step' as const,
      id,
      reachedBy,
      note: reachedBy !== null
        ? metadata?.description ?? 'a control node of the flow'
        : `NO VOCABULARY: ${STEP_GAP_NOTES[id] ?? 'nothing in the model asks for this step.'}`,
    };
  });
};

// ─── Inputs dos passos que o modelo pede ──────────────────────────────────────

/**
 * O que cada input OBRIGATÓRIO dos passos alcançados recebe do modelo. Um input não listado aqui
 * aparece como lacuna, e é o que faz um input novo no kernel chegar à lista em vez de ao acaso.
 */
const STEP_INPUT_REACH: Record<string, string | null> = {
  'upsert.upsert': null,
  'remove.remove': null,
  'notify.title': null,
  'notify.message': null,
  'validate-object.validate': null,
  'call-workflow.targetWorkflowId': 'effect "call-automation" (target)',
  'render-document.templateKey': 'effect "generate-document" (template)',
  'render-document.recordId': 'effect "generate-document" — the record of the transition',
  'query.query': 'trigger "schedule" — the collection and the `from` of the transition, as the filter',
  'map.map': 'trigger "user-action" — the answer the button reads (status and actions), fixed by the plan',
};

const STEP_INPUT_NOTES: Record<string, string> = {
  'upsert.upsert': 'an UpsertStepConfig: the collection, WHICH record, and the data. The model says entity, field and '
    + 'value — never which record. "when the class ends, every enrollment of it is completed" has no way to name "of '
    + 'it", and the plan cannot write the step without a person choosing',
  'remove.remove': 'a RemoveStepConfig: which records go. Same gap as the upsert, and worse — a delete with the wrong '
    + 'selector is not recoverable',
  'notify.title': 'the title a person reads. The model has no text for it, and it is user-visible text, so it also has '
    + 'to travel through the message catalog',
  'notify.message': 'the body a person reads. Same as the title: the effect "notify" says a notification happens and '
    + 'nothing about what it says',
  'validate-object.validate': 'a ValidateStepConfig: which object, against which schema. The record-scope invariant '
    + 'carries the expression, not the object to validate',
};

const stepInputItems = (): CoverageItem[] => {
  const reach = stepReach();
  return CORE_STEP_CATALOG
    .filter((step) => reach.has(step.id))
    .flatMap((step) => step.inputs
      .filter((input) => input.required)
      .map((input) => {
        const key = `${step.id}.${input.id}`;
        const reachedBy = key in STEP_INPUT_REACH ? STEP_INPUT_REACH[key] : null;
        return {
          surface: 'step-input' as const,
          id: key,
          reachedBy,
          note: reachedBy !== null
            ? `${input.type}, filled from the model`
            : `NO VOCABULARY: ${STEP_INPUT_NOTES[key] ?? `a required "${input.type}" input the model cannot fill.`}`,
        };
      }));
};

// ─── Eventos ──────────────────────────────────────────────────────────────────

/**
 * Os eventos do catálogo ESTÁTICO. Os eventos de coleção — `<collection>.saved` / `.deleted` — não
 * estão aqui: `buildWorkflowEventCatalog` os deriva das telas da instalação, e o gatilho
 * `entity-event` os alcança por construção. O que sobra no catálogo estático é o que o modelo não tem
 * como pedir.
 */
const EVENT_GAP_NOTES: Record<string, string> = {
  'lookup.saved': 'fires when the office edits an option of a list. A rule like "renaming a status re-labels the open '
    + 'records" has no trigger in the model — and there is no vocabulary for "when a list changes"',
  'lookup.deleted': 'fires when an option is removed. The records that stored that key keep it, and the model cannot '
    + 'declare what happens to them',
  'audit.recorded': 'fires when a person causes an Audit trail entry. A rule like "a critical deletion alerts the '
    + 'owner" has no trigger in the model — it speaks of record states, not of the trail that watches them',
};

const eventItems = (): CoverageItem[] => WORKFLOW_EVENT_CATALOG.map((entry) => {
  const reached = entry.name === 'workflow.called'
    ? 'trigger "user-action"'
    : entry.name === WORKFLOW_SCHEDULE_EVENT
      ? 'trigger "schedule"'
      : /\.(saved|deleted)$/.test(entry.name) && !entry.name.startsWith('lookup.')
      ? 'trigger "entity-event"'
      : null;
  return {
    surface: 'workflow-event' as const,
    id: entry.name,
    reachedBy: reached,
    note: reached !== null
      ? `${entry.fields.length} field(s) in the payload`
      : `NO VOCABULARY: ${EVENT_GAP_NOTES[entry.name] ?? 'nothing in the model declares this trigger.'}`,
  };
});

// ─── Pontos de contribuição ───────────────────────────────────────────────────

const ALL_POINTS: ExtensionPointDefinition[] = KERNEL_EXTENSION_POINTS;

/** O único ponto que o modelo alcança, e o vocabulário que o alcança. */
const POINT_REACH: Record<string, string> = {
  'access.permission': 'transition.permission',
};

const pointItems = (): CoverageItem[] => ALL_POINTS.map((point) => {
  const reachedBy = POINT_REACH[point.id] ?? null;
  return {
    surface: 'extension-point' as const,
    id: point.id,
    reachedBy,
    note: reachedBy !== null
      ? `${point.apiVersion}, declared from the model`
      : `NO VOCABULARY: ${point.id} (${point.apiVersion}) accepts `
        + `${point.allowedImplKinds.length === 0 ? 'a declaration only' : point.allowedImplKinds.join('/')}, and the `
        + 'model has no way to ask for it. Everything a rule needs beyond data and passages — a page, a widget, a '
        + 'menu entry, a translation, a theme, an external lookup, a sign-in provider — is outside this vocabulary',
  };
});

// ─── Propriedades que o plano poderia preencher ───────────────────────────────

/**
 * Fechado por `keyof`, e é aqui que o compilador faz o trabalho: uma propriedade nova em qualquer um
 * destes quatro tipos não compila até dizer o que a alcança — ou `null`, que também é uma resposta, e
 * a única que aparece no relatório.
 */
const PACKAGE_REACH: Record<keyof MarketplacePlugin, string | null> = {
  manifest: 'model.extensionId (id) and the plan\'s versionBump (version)',
  summary: null,
  workflows: 'one per transition',
  screens: 'one per entity of kind "entity" or "child"',
  screenPatches: 'a collection owned by another extension',
  lookups: 'entities of kind "lookup", plus every list a select field points at',
  tagLists: 'entity.tabs of kind "tags"',
  actions: 'one per transition triggered by user-action',
  scripts: null,
  reports: null,
  views: null,
  startup: null,
  migrations: 'plan.migrationsRequired names the conversion; the routine itself is code',
  // Não é o plano que a preenche: é o build, a partir de `functions/` ao lado do `plugin.ts`.
  backendSource: null,
  overview: null,
};

const PACKAGE_NOTES: Record<string, string> = {
  summary: 'the one-line description of the extension in the Marketplace. It is product text, and no model field says it',
  scripts: 'reviewed code the office can run. Out of reach on purpose — see the "script" step',
  reports: 'a question asked of the data — what to cover, how to fold it, how to show it. The model describes what the\n    business IS, not what one wants to know about it, and no field of it says either',
  views: 'a code page. A rule that needs a screen the platform cannot draw is outside this vocabulary',
  startup: 'code that runs when the extension loads. Same reason',
  overview: 'the rich description of the extension. Product text, like the summary',
};

const PLUGIN_MANIFEST_REACH: Record<keyof PluginManifest, string | null> = {
  id: 'model.extensionId',
  version: 'plan.versionBump — the number itself is a human decision (patch, minor, major)',
  kernel: null,
  name: null,
  description: null,
  category: null,
  icon: null,
  image: null,
  homepage: null,
  publisher: null,
  prefix: null,
  license: null,
  dependencies: null,
  exports: null,
  provides: null,
  consumes: null,
  permissions: 'transition.permission',
  extensionPoints: null,
  contributes: 'accessPermissionContribution for each permission a transition asks for',
  lifecycle: null,
  backend: null,
};

const MANIFEST_NOTES: Record<string, string> = {
  kernel: 'the contract range this extension was written against. It is a fact about the toolchain, not about the rule',
  name: 'the name a person reads in the Marketplace. Product text, and it travels through the message catalog',
  description: 'the paragraph a person reads before installing. Product text, like the name',
  category: 'how the extension is filed in the Marketplace. A choice about the catalog, not about any rule',
  icon: 'the icon of the extension in the Marketplace. HUMAN, and a visual choice',
  homepage: 'a URL for the extension. Nothing in a business rule implies one',
  publisher: 'who wrote the extension, and how the office reaches them',
  prefix: 'the start of every name the extension creates. It belongs to whoever writes the extension, never to a rule',
  license: 'the terms the author sets with the office. A legal decision, never a derived one',
  dependencies: 'other extensions this one needs. A model that referenced another extension\'s collection would imply '
    + 'one, and nothing in the vocabulary says so',
  exports: 'the automations, actions and scripts this extension declares public, for another extension to reference. '
    + 'Which of them are a contract with someone else is the author\'s decision, and no rule of this extension implies it',
  provides: 'a capability this extension offers to other extensions',
  consumes: 'a capability this extension requires from another extension',
  extensionPoints: 'a point of your OWN, for others to contribute to. Far outside a rule',
  lifecycle: 'the install and uninstall hooks of the extension, which are code',
  backend: 'what the extension needs from the Firebase project: a function, an index, a parameter. A rule that filters '
    + 'a large collection implies an index, and the model has no way to say which',
};

const SCREEN_REACH: Record<keyof ScreenModuleTemplate, string | null> = {
  key: 'the entity\'s collection',
  sourceId: 'the extension id plus the collection — the screen plan emits it, and a value the ledger or the package '
    + 'already holds is used as recorded instead of being derived again',
  sourceRev: null,
  titleSingular: 'the entity name — as a raw name, which still has to become a message reference',
  titlePlural: 'idem',
  icon: null,
  fields: 'the entity\'s fields, translated',
  keys: 'entity.keys — and field.unique, which is the one-field shorthand for the same thing',
  titleFieldKey: 'entity.titleField',
  subtitleFieldKey: null,
  imageFieldKey: null,
  hasNotes: 'entity.tabs of kind "notes"',
  hasDocuments: 'entity.tabs of kind "documents"',
  hasTags: 'entity.tabs of kind "tags"',
  tagCollection: 'entity.tabs of kind "tags"',
  dataCollection: 'an entity whose collection already exists here',
  eventPrefix: null,
  auditActions: null,
  recordTabPrefix: null,
  memberWritableFields: null,
  authorCanDelete: null,
  editWindow: null,
  memberVisibility: null,
  portal: null,
  listActions: null,
  sidebarOrder: null,
  enabled: 'plan.deactivations — false when the rule no longer needs the screen',
  hideFromSidebar: 'kind "child": a child is a tab of its parent, never an entry of the menu',
  hideFromParentTabs: null,
  hideRecordsFromCommandPalette: null,
  parentEntity: 'the relationship with storage "child"',
  parentFieldKey: 'idem',
  parentRelation: 'the ownership of that relationship',
  viewActionIds: 'the actions the screen plan places in the detail header',
  cardActionIds: 'the actions the screen plan places on the list card',
  cardTemplate: null,
  seed: null,
};

const SCREEN_NOTES: Record<string, string> = {
  sourceRev: 'the origin revision of the screen, stamped at packaging',
  icon: 'HUMAN: it names the business to whoever looks at the menu',
  subtitleFieldKey: 'HUMAN: which second field identifies a record',
  imageFieldKey: 'HUMAN: which file field replaces the icon',
  eventPrefix: 'the prefix of this collection\'s events. It changes the name every automation listens to',
  auditActions: 'which actions of this collection write an audit entry. A collection a machine writes would flood the '
    + 'audit, and the model cannot say the collection is machine-written',
  recordTabPrefix: 'the prefix of the workspace tab that opens one record of this collection',
  memberWritableFields: 'which fields any member may write regardless of permission. It is authorization, and the model '
    + 'expresses authorization only on a transition',
  authorCanDelete: 'whether the author deletes what they created. Also authorization',
  editWindow: 'how long after creation a record may still be changed — and, with `delete`, deleted. A guarantee '
    + 'about evidence, enforced by the security rules, and the model has no vocabulary for a record that freezes '
    + 'after a while',
  memberVisibility: 'which members read EACH record — the ones it names in a member reference, plus whoever '
    + 'supervises. Authorization per record, enforced by the security rules, and a confidentiality decision the model '
    + 'cannot make on behalf of the organization',
  portal: 'what an outside guest sees of this collection, and through which link to the subject record. Authorization '
    + 'again, and an exposure decision the model cannot make on behalf of the organization',
  listActions: 'the built-in gestures of the card, in the order it shows them — copy link, manage tags, delete',
  sidebarOrder: 'HUMAN: an order is a statement about what matters most here',
  hideFromParentTabs: 'a child that should NOT show up as a tab. The model has one reading of "child" and it is the tab',
  hideRecordsFromCommandPalette: 'whether the records of this collection stay out of the command palette search. Like '
    + 'auditActions, it is what a collection a machine writes needs, and the model cannot say the collection is '
    + 'machine-written',
  cardTemplate: 'HUMAN: how the list card is drawn, and whether the list is a grid or one card per line. A '
    + 'presentation decision, and the model says what a record is, never how it looks',
  seed: 'HUMAN: the records the extension delivers ready to use — a catalog. Content the author chooses, not something a '
    + 'rule implies',
};

const ACTION_REACH: Record<keyof ActionModuleTemplate, string | null> = {
  templateId: 'the transition',
  key: 'trigger.action',
  title: null,
  icon: null,
  workflowId: 'the workflow of the same transition',
  command: null,
  hiddenWhen: 'the permission the transition asks for',
  disabledWhen: 'the transition\'s `from` plus every invariant with enforcement "blocks"',
  activeWhen: null,
  confirmMessage: null,
  promptParameters: null,
  parameterDefaults: null,
  danger: null,
  enabled: 'plan.deactivations',
  order: null,
  ownerPluginIds: null,
  sourceId: null,
  sourceRev: null,
};

const ACTION_NOTES: Record<string, string> = {
  title: 'the label on the button. It is user-visible text, and the transition has a description of what it DOES, never '
    + 'a name for the button. It is the same family as the missing transition description, and it is still open',
  icon: 'HUMAN, like every icon on this platform',
  command: 'a system gesture instead of a flow (copy link, clone, delete). A rule that says "the manager may delete" '
    + 'means this, and the model reads it as a transition',
  activeWhen: 'turns the button into a switch showing the current state. A two-state rule ("active/inactive") is '
    + 'exactly this, and the model produces two transitions and two buttons instead',
  confirmMessage: 'asks before firing. Every irreversible passage wants one, and the model cannot say a passage is '
    + 'irreversible — `terminal` says a state has no way out, which is not the same thing',
  promptParameters: 'asks the person for the flow\'s parameters first. The model declares no parameter of a passage',
  parameterDefaults: 'pre-fills the form promptParameters opens, by expression — and only that form: without it the '
    + 'map is never evaluated. The record of the button needs neither, it always reaches the flow as recordId',
  danger: 'draws the button as destructive. A visual consequence of "irreversible", which is also missing',
  order: 'HUMAN: the order gestures appear in',
  ownerPluginIds: 'the refcount of extensions sharing the action, set by the installation',
  sourceId: 'the universal identity of the action, like the screen\'s — how an update recognises it across offices',
  sourceRev: 'the origin revision, stamped at packaging so an update only rewrites what is genuinely newer',
};

const WORKFLOW_REACH: Record<keyof WorkflowModuleTemplate, string | null> = {
  templateId: 'the transition',
  name: 'the transition name',
  description: 'transition.description — and a callable flow without it is invisible to ai-detect-workflow',
  eventName: 'the trigger',
  version: null,
  lookupCollection: null,
  parameters: 'recordId, as a reference to the collection — the record the button always sends, and what the '
    + 'condition of a user-action flow reads the state field through',
  schedule: 'trigger "schedule" — its `when`, as cron',
  dateReached: 'trigger "date-reached" — its field, offset and time',
  changeType: null,
  changedFields: null,
  steps: 'the guard, the state write and the effects, in order — and, on a user-action flow, the map that answers '
    + 'the button',
  condition: 'the `from` of the transition',
  ownerPluginIds: null,
  sourceId: null,
  sourceRev: null,
};

const WORKFLOW_NOTES: Record<string, string> = {
  version: 'the revision of the flow definition itself, bumped when the office edits it in the Automations screen',
  lookupCollection: 'which list fires a `lookup.saved`. It is the other half of the missing lookup trigger',
  changeType: 'narrows a save trigger to creation or to change. A transition fires on the move INTO its target state, '
    + 'which the guard already writes, so the model never needs it',
  changedFields: 'narrows a save trigger to a change of the named fields. Same reason as changeType: the transition '
    + 'guard compares the state field, and that IS the field that changed',
  ownerPluginIds: 'the refcount of extensions sharing the flow, set by the installation',
  sourceId: 'the universal identity of the flow — how an update recognises it across offices',
  sourceRev: 'the origin revision, stamped at packaging so an update only rewrites what is genuinely newer',
};

const propertyItems = (
  surface: CoverageSurface,
  reach: Record<string, string | null>,
  notes: Record<string, string>,
  what: string,
): CoverageItem[] => Object.entries(reach).map(([id, reachedBy]) => ({
  surface,
  id,
  reachedBy,
  note: reachedBy !== null
    ? `${what}: filled from ${reachedBy}`
    : `NO VOCABULARY: ${notes[id] ?? `${what} the plan leaves empty.`}`,
}));

/**
 * A superfície inteira, num lugar só. A ordem é a das superfícies declaradas, e é estável: quem lê o
 * relatório duas vezes lê a mesma lista na mesma ordem.
 */
export const mechanismCoverage = (): CoverageItem[] => [
  ...stepItems(),
  ...stepInputItems(),
  ...eventItems(),
  ...pointItems(),
  ...propertyItems('package-artifact', PACKAGE_REACH, PACKAGE_NOTES, 'a package artifact'),
  ...propertyItems('screen-property', SCREEN_REACH, SCREEN_NOTES, 'a screen property'),
  ...propertyItems('action-property', ACTION_REACH, ACTION_NOTES, 'a record-action property'),
  ...propertyItems('workflow-property', WORKFLOW_REACH, WORKFLOW_NOTES, 'a workflow property'),
  ...propertyItems('manifest-property', PLUGIN_MANIFEST_REACH, MANIFEST_NOTES, 'a manifest property'),
];

/** Só as lacunas: o que existe na plataforma e o modelo não sabe pedir. */
export const coverageGaps = (): CoverageItem[] => mechanismCoverage().filter((one) => one.reachedBy === null);

export interface CoverageSummary {
  surface: CoverageSurface;
  total: number;
  reached: number;
  gaps: number;
}

export const coverageSummary = (): CoverageSummary[] => COVERAGE_SURFACES.map((surface) => {
  const items = mechanismCoverage().filter((one) => one.surface === surface);
  return {
    surface,
    total: items.length,
    reached: items.filter((one) => one.reachedBy !== null).length,
    gaps: items.filter((one) => one.reachedBy === null).length,
  };
});
