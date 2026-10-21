import type {
  ActionModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
  WorkflowModuleTemplate,
} from '../../../../domain/entities/MarketplacePlugin';
import type { QuerySpec } from '../../../../domain/schema/querySpec';
import type { UpsertStepConfig } from '../../../../domain/schema/mutationSpec';
import type { MapStepConfig } from '../../../../domain/schema/mapSpec';
import { notificationCategory } from '../../../contributionBuilders';
import { automationMessagesContribution } from './automationMessages';
import { automationPtBrContribution } from './automationMessagesPtBr';

/**
 * **Automation, by example** — the worked automation the guide could not show.
 *
 * Every other example in this package covers screens, fields, lookups, patches, views and themes.
 * None carried a workflow, an action or a script, and the guide said so out loud: for automation
 * there was prose and nothing to read. This extension is that gap closed.
 *
 * It is deliberately business-agnostic. A `request` with an amount and a status is not a legal, sales
 * or accounting concept — it is the smallest record that still has something worth automating. What
 * matters here is not the vocabulary but the six mechanics, each of which used to be undocumented:
 *
 * 1. A workflow triggered by a SAVE, with a condition evaluated before any step runs.
 * 2. A `Condition` control node — the branch that converges after, with an empty `stepDefinitionId`.
 * 3. A `query` step, which receives a whole `QuerySpec` as a `Literal`.
 * 4. An `upsert` step, which does NOT receive an `UpsertSpec` — it receives `UpsertStepConfig`, and
 *    that difference is the single most expensive trap in authoring an automation.
 * 5. A `workflow.called` flow with `parameters`, which is what an action fires.
 * 6. An action with `promptParameters`, so a person supplies the value before the flow runs.
 * 7. A notification TYPE (`notificationCategory`). A `notify` step that sets
 *    `category: 'com.microteia.automation-example/large-request'` lets each person choose, on the
 *    Notifications page, which channels bring them that type — without muting everything else.
 *
 * Read the shapes with `describe_workflow_step` on the MCP server; read the ids that exist with
 * `list_workflow_steps`. Neither answer is written here — both are derived from the kernel.
 */
const message = (key: string): string => `@com.microteia.automation-example/${key}`;

const REQUEST = message('section.request');
const HANDLING = message('section.handling');

const REQUEST_FIELDS: TemplateField[] = [
  { key: 'title', label: message('field.title'), type: 'text', required: true, order: 0, section: REQUEST, placeholder: message('field.title.placeholder') },
  { key: 'amount', label: message('field.amount'), type: 'currency', required: true, order: 1, section: REQUEST, filterable: true },
  {
    key: 'status',
    label: message('field.status'),
    type: 'select',
    required: true,
    order: 2,
    section: REQUEST,
    filterable: true,
    optionsColored: true,
    options: [
      { key: 'open', label: message('field.status.open'), color: 'warning' },
      { key: 'approved', label: message('field.status.approved'), color: 'success' },
      { key: 'rejected', label: message('field.status.rejected'), color: 'danger' },
    ],
  },
  { key: 'note', label: message('field.note'), type: 'textarea', required: false, order: 3, section: HANDLING },
];

/**
 * The summary is a MIRROR: one record per period, kept by the flow below and by nobody's hand. It is
 * the shape that proves the only property a declaration cannot assert about itself — that running it
 * again does not duplicate anything.
 */
const SUMMARY_FIELDS: TemplateField[] = [
  { key: 'period', label: message('field.period'), type: 'text', required: true, order: 0, filterable: true },
  { key: 'openTotal', label: message('field.openTotal'), type: 'currency', required: false, order: 1 },
  { key: 'openCount', label: message('field.openCount'), type: 'number', required: false, order: 2 },
];

const REQUEST_SCREEN: ScreenModuleTemplate = {
  key: 'automationRequest',
  sourceId: 'microteia:automation-example:request',
  sourceRev: 1,
  titleSingular: message('screen.request'),
  titlePlural: message('screen.request.plural'),
  icon: 'fileList',
  fields: REQUEST_FIELDS,
  titleFieldKey: 'title',
  subtitleFieldKey: 'status',
  eventPrefix: 'automationRequest',
  viewActionIds: ['act-review'],
  cardActionIds: ['act-review'],
};

const SUMMARY_SCREEN: ScreenModuleTemplate = {
  key: 'automationSummary',
  sourceId: 'microteia:automation-example:summary',
  sourceRev: 1,
  titleSingular: message('screen.summary'),
  titlePlural: message('screen.summary.plural'),
  icon: 'barChart',
  fields: SUMMARY_FIELDS,
  titleFieldKey: 'period',
  eventPrefix: 'automationSummary',
};

/**
 * The query the mirror flow runs. `op` is `'eq'`, NOT `'=='`: the operators are the `QueryOperator`
 * union, and an operator outside it falls through the engine's switch and quietly matches no rows —
 * the query returns zero results and the flow carries on as if the record did not exist.
 */
const EXISTING_SUMMARY: QuerySpec = {
  table: 'automationSummary',
  where: [{ path: 'period', op: 'eq', value: { kind: 'Variable', name: 'period' } }],
  limit: 1,
  projections: ['id', 'openCount', 'openTotal'],
};

/**
 * What the `upsert` step actually receives. It is NOT an `UpsertSpec`: there is no `data` here. The
 * step reads the object from `source` (`'input'` is what the previous step handed over, `'event'` is
 * the event payload), optionally narrowing with `property`, and builds the spec itself — an `id` in
 * that object means update, no `id` means insert.
 */
const WRITE_SUMMARY: UpsertStepConfig = { table: 'automationSummary', source: 'input', property: 'summary' };

const WRITE_REVIEW: UpsertStepConfig = { table: 'automationRequest', source: 'input', property: 'review' };

/** The object the `map` step assembles, which the `upsert` after it then writes. */
const SUMMARY_OBJECT: MapStepConfig = {
  name: 'summary',
  fields: [
    { name: 'id', value: { kind: 'Expression', expression: 'output.findSummary.first.id' } },
    { name: 'period', value: { kind: 'Variable', name: 'period' } },
    { name: 'openCount', value: { kind: 'Expression', expression: 'output.countOpen.count' } },
  ],
};

const REVIEW_OBJECT: MapStepConfig = {
  name: 'review',
  fields: [
    { name: 'id', value: { kind: 'Event', path: 'requestId' } },
    { name: 'status', value: { kind: 'Event', path: 'decision' } },
    { name: 'note', value: { kind: 'Event', path: 'note' } },
  ],
};

const WORKFLOWS: WorkflowModuleTemplate[] = [
  /**
   * Triggered by a SAVE. There are THREE ways to address the same value here, and telling them apart
   * is the most common mistake in a workflow:
   *
   * - a `condition`'s `fieldPath` is ABSOLUTE over the whole context — `event.payload.changeType`;
   * - an `{ kind: 'Event', path }` mapping is RELATIVE to the payload — `id`, not `event.payload.id`;
   * - inside an `{ kind: 'Expression' }`, `event` IS the payload — `event.title`. There is no
   *   `event.payload` to reach for in an expression, and asking for one does not read as empty: the
   *   member access throws, and the step fails to resolve its input.
   */
  {
    templateId: 'wf-on-save',
    name: message('workflow.on-save'),
    description: message('workflow.on-save.description'),
    eventName: 'automationRequest.saved',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps: [
      {
        id: 'isNew',
        stepDefinitionId: '',
        type: 'Condition',
        order: 0,
        enabled: true,
        configuration: {},
        condition: {
          kind: 'FieldComparison',
          fieldPath: 'event.payload.changeType',
          operator: '==',
          value: 'created',
          valueType: 'literal',
        },
        branches: {
          whenTrue: [{
            id: 'auditOpened',
            stepDefinitionId: 'register-audit',
            type: 'Action',
            order: 0,
            enabled: true,
            configuration: {
              title: { kind: 'Literal', value: message('workflow.on-save.created.title') },
              message: { kind: 'Expression', expression: 'concat("Opened: ", event.title)' },
              entity: { kind: 'Literal', value: 'automationRequest' },
              entityId: { kind: 'Event', path: 'id' },
            },
          }],
          whenFalse: [{
            id: 'auditChanged',
            stepDefinitionId: 'register-audit',
            type: 'Action',
            order: 0,
            enabled: true,
            configuration: {
              title: { kind: 'Literal', value: message('workflow.on-save.updated.title') },
              message: { kind: 'Expression', expression: 'concat("Changed: ", event.title)' },
              entity: { kind: 'Literal', value: 'automationRequest' },
              entityId: { kind: 'Event', path: 'id' },
            },
          }],
        },
      },
    ],
  },

  /**
   * A CALLED flow: it has no trigger of its own, and `parameters` become the `event.` it receives.
   * This is what an action fires, and `promptParameters` on that action is what turns these
   * parameters into a form a person fills in first.
   */
  {
    templateId: 'wf-review',
    name: message('workflow.review'),
    description: message('workflow.review.description'),
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    parameters: [
      { key: 'requestId', label: message('field.title'), type: 'String', required: true },
      {
        key: 'decision',
        label: message('parameter.decision'),
        type: 'select',
        required: true,
        options: [
          { value: 'approved', label: message('parameter.decision.approve') },
          { value: 'rejected', label: message('parameter.decision.reject') },
        ],
      },
      { key: 'note', label: message('parameter.note'), type: 'String' },
    ],
    steps: [
      {
        id: 'buildReview',
        stepDefinitionId: 'map',
        type: 'Action',
        order: 0,
        enabled: true,
        configuration: { map: { kind: 'Literal', value: REVIEW_OBJECT } },
      },
      {
        id: 'writeReview',
        stepDefinitionId: 'upsert',
        type: 'Action',
        order: 1,
        enabled: true,
        configuration: { upsert: { kind: 'Literal', value: WRITE_REVIEW } },
      },
      {
        id: 'auditReview',
        stepDefinitionId: 'register-audit',
        type: 'Action',
        order: 2,
        enabled: true,
        configuration: {
          title: { kind: 'Literal', value: message('workflow.review.done.title') },
          message: { kind: 'Expression', expression: 'concat("Decision: ", event.decision)' },
          entity: { kind: 'Literal', value: 'automationRequest' },
          entityId: { kind: 'Output', stepId: 'writeReview', outputId: 'id' },
        },
      },
    ],
  },

  /**
   * The MIRROR, which is the most demanding shape the platform offers: ask whether the record already
   * exists, branch on the answer, assemble the object and write it. `set-variable` publishes an output
   * under the name its own `name` input chose, which is why `period` can be read as
   * `{ kind: 'Variable' }` further down.
   */
  {
    templateId: 'wf-mirror',
    name: message('workflow.mirror'),
    description: message('workflow.mirror.description'),
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    parameters: [],
    steps: [
      {
        id: 'setPeriod',
        stepDefinitionId: 'set-variable',
        type: 'Action',
        order: 0,
        enabled: true,
        configuration: {
          name: { kind: 'Literal', value: 'period' },
          value: { kind: 'Expression', expression: 'formatDate(today(), "yyyy-MM")' },
        },
      },
      {
        id: 'countOpen',
        stepDefinitionId: 'query',
        type: 'Action',
        order: 1,
        enabled: true,
        configuration: {
          query: {
            kind: 'Literal',
            value: {
              table: 'automationRequest',
              where: [{ path: 'status', op: 'eq', value: { kind: 'Literal', value: 'open' } }],
              limit: 200,
              projections: ['id', 'amount'],
            } satisfies QuerySpec,
          },
        },
      },
      {
        id: 'findSummary',
        stepDefinitionId: 'query',
        type: 'Action',
        order: 2,
        enabled: true,
        configuration: { query: { kind: 'Literal', value: EXISTING_SUMMARY } },
      },
      {
        id: 'buildSummary',
        stepDefinitionId: 'map',
        type: 'Action',
        order: 3,
        enabled: true,
        configuration: { map: { kind: 'Literal', value: SUMMARY_OBJECT } },
      },
      {
        id: 'writeSummary',
        stepDefinitionId: 'upsert',
        type: 'Action',
        order: 4,
        enabled: true,
        configuration: { upsert: { kind: 'Literal', value: WRITE_SUMMARY } },
      },
      {
        id: 'auditSummary',
        stepDefinitionId: 'register-audit',
        type: 'Action',
        order: 5,
        enabled: true,
        configuration: {
          title: { kind: 'Literal', value: message('workflow.mirror.audit.title') },
          message: { kind: 'Expression', expression: 'concat("Open requests: ", output.countOpen.count)' },
          entity: { kind: 'Literal', value: 'automationSummary' },
          entityId: { kind: 'Output', stepId: 'writeSummary', outputId: 'id' },
        },
      },
    ],
  },
];

/**
 * The buttons. `promptParameters` opens the called flow's parameter form before firing, and
 * `parameterDefaults` maps a parameter to an expression for when the field on screen is not named
 * like the parameter in the flow — here, the record's own id feeding `requestId`.
 *
 * `hiddenWhen` and `disabledWhen` are evaluated in the UI only, against the record on screen.
 */
const ACTIONS: ActionModuleTemplate[] = [
  {
    templateId: 'act-review',
    key: 'review',
    title: message('action.review'),
    icon: 'checkboxCircle',
    workflowId: 'wf-review',
    order: 0,
    enabled: true,
    danger: false,
    hiddenWhen: 'not hasPermission("automationRequest.update")',
    disabledWhen: 'status != "open"',
    confirmMessage: message('action.review.confirm'),
    promptParameters: true,
    parameterDefaults: { requestId: 'id' },
  },
  {
    templateId: 'act-mirror',
    key: 'mirror',
    title: message('action.mirror'),
    icon: 'fileCopy',
    workflowId: 'wf-mirror',
    order: 1,
    enabled: true,
    danger: false,
  },
];

export const automationExamplePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.automation-example',
    version: '1.2.0',
    kernel: '^2.58.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    contributes: [
      automationMessagesContribution(),
      automationPtBrContribution(),
      notificationCategory({
        key: 'large-request',
        title: message('notification.large-request'),
        description: message('notification.large-request.description'),
        icon: 'notification',
      }),
    ],
  },
  summary: message('package.summary'),
  workflows: WORKFLOWS,
  screens: [REQUEST_SCREEN, SUMMARY_SCREEN],
  actions: ACTIONS,
};
