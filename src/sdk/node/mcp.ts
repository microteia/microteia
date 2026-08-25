import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { UI_EXTENSION_POINTS } from '../../domain/schema/ui/uiExtensionPoints';
import { DATA_EXTENSION_POINTS } from '../../domain/schema/dataExtensionPoints';
import { I18N_EXTENSION_POINTS } from '../../domain/schema/i18n/extensionPoints';
import { THEME_EXTENSION_POINTS } from '../../domain/schema/theme/extensionPoints';
import { ACCESS_EXTENSION_POINTS } from '../../domain/schema/access';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { THIRD_PARTY_IMPL_KINDS } from '../../domain/schema/plugin/extensionPoint';
import { parsePackage } from '../../domain/usecases/plugins/packageSerialization';
import { validatePluginPackage } from '../validate';
import { buildPlugin } from './compile';
import { hostModuleBlock, hostModuleNames, hostTypesPath, readHostTypes } from './hostTypes';
import { referencedSymbols, sdkDeclaration, sdkSurfaceNames, sdkTypesRoot } from './sdkTypes';
import { FIELD_EXPRESSION_FUNCTION_NAMES } from '../../domain/schema/fieldExpression';
import { describeMessage } from './messages';
import {
  CONTROL_STEP_TYPES,
  CORE_STEP_CATALOG,
  CORE_STEP_DEFINITION_IDS,
  UNIMPLEMENTED_STEP_TYPES,
  coreStepMetadata,
  isCoreStepDefinitionId,
} from '../../domain/schema/workflowStepCatalog';
import { RECORD_ACTION_METADATA } from '../../domain/schema/ui/recordActionMetadata';
import {
  ENTITY_EVENT_ACTIONS,
  NESTED_EVENT_SUFFIXES,
  WORKFLOW_CALLED_EVENT,
} from '../../domain/schema/eventCatalog';

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


const ALL_POINTS = [
  ...UI_EXTENSION_POINTS,
  ...DATA_EXTENSION_POINTS,
  ...I18N_EXTENSION_POINTS,
  ...THEME_EXTENSION_POINTS,
  ...ACCESS_EXTENSION_POINTS,
];

const describeIssues = (issues: ReturnType<typeof validatePluginPackage>): string =>
  issues.length === 0
    ? 'No problems. This package would install.'
    : `${issues.length} problem(s):\n${issues
      .map((issue) => `- [${issue.source}] ${describeMessage(issue.message, issue.messageParams)}`)
      .join('\n')}`;

const findFiles = (dir: string, name: string, depth = 3): string[] => {
  if (depth < 0 || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(path, name, depth - 1);
    return entry.name === name ? [path] : [];
  });
};

const TOOLS: ToolDefinition[] = [
  {
    name: 'validate_plugin',
    description:
      'Validate an extension package against the exact same checks the platform runs on install: '
      + 'manifest shape, referential integrity, size limits and migrations. Accepts a path to a '
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
        return describeIssues(validatePluginPackage(parsed.package));
      }
      const path = resolve(root, asString(input.path, 'path'));
      if (path.endsWith('.json')) {
        const parsed = parsePackage(readFileSync(path, 'utf8'));
        if (!parsed.ok) return `Not a valid package: ${describeMessage(parsed.error)}`;
        return describeIssues(validatePluginPackage(parsed.package));
      }
      const result = buildPlugin({ entry: path });
      return `${result.package.manifest.id} v${result.package.manifest.version}\n${describeIssues(result.issues)}`;
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
    name: 'list_workspace_plugins',
    description: 'The extensions authored in this workspace, with their id, version and current problems.',
    inputSchema: { type: 'object', properties: {} },
    run: (_input, root) => {
      const entries = findFiles(root, 'plugin.ts');
      if (entries.length === 0) return 'No plugin.ts found. Create one with "microteia-plugin new <id>".';
      return entries.map((entry) => {
        try {
          const result = buildPlugin({ entry });
          const { manifest } = result.package;
          return `${relative(root, entry)}\n  ${manifest.id} v${manifest.version} — ${describeIssues(result.issues)}`;
        } catch (error) {
          return `${relative(root, entry)}\n  does not compile: ${error instanceof Error ? error.message : String(error)}`;
        }
      }).join('\n\n');
    },
  },
  {
    name: 'describe_sdk_type',
    description:
      'The exact declaration of an AUTHORING type, read from the .d.ts this installation carries — '
      + 'the shape a package must have for the platform to accept it. Ask for `AuthoredPlugin`, '
      + '`PluginManifest`, `ScreenModuleTemplate`, `TemplateField`, `FieldDefinition`, `WidgetSpec`, '
      + '`WorkflowDefinition`, `WorkflowStep`, `InputMapping`, `ActionDefinition`, `Script`, '
      + '`PluginMigration`, `SettingsSection`, `QuerySpec`, or any other symbol the SDK publishes. '
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
        + 'and accepts the patterns "<entity>.delete", "*.delete", "invoices.*" and "invoice%.read".',
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
    name: 'describe_workflow_step',
    description:
      'Everything one step of the catalog needs in `configuration`: each input, whether it is '
      + 'required, its type, which InputMapping kinds it accepts, its options and its default — plus '
      + 'the outputs later steps can read through `{ kind: "Output" }`. Call with no id to list the '
      + 'ids. For a composite input (Query, Upsert, Remove, Map, Validate) the value is a '
      + 'Literal wrapping the matching *StepConfig — ask `describe_sdk_type` for its shape.',
    inputSchema: {
      type: 'object',
      properties: { stepDefinitionId: { type: 'string', description: "e.g. 'upsert'" } },
    },
    run: (input) => {
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
          shape: COMPOSITE_INPUT_SHAPE[one.type] ?? null,
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
        dynamicOutputs: step.dynamicOutputs ?? null,
      });
    },
  },
  {
    name: 'list_workflow_events',
    description:
      'The event names a workflow may declare in `eventName` — the GRAMMAR, derived from the engine, '
      + 'because the collection half of the name is yours (your screen, a screen the organization '
      + 'designed, a collection that already exists). Also says what `event.` carries in each case, '
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
        ...NESTED_EVENT_SUFFIXES.map((suffix) => ({
          eventName: `<parent>${suffix}.${ENTITY_EVENT_ACTIONS.join(` | <parent>${suffix}.`)}`,
          fires: `a ${suffix.slice(1)} of a record of that parent collection changes`,
          eventPayload: `the ${suffix.slice(1)}, and the id of the record it hangs from`,
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
      ],
      notes: [
        'The collection half is not enumerable from here on purpose: it is the collection of the '
        + 'screen that declares it, and the kernel knows none by name. Use your own screen\'s '
        + 'collection, or the `eventPrefix` it declares.',
        `"${WORKFLOW_CALLED_EVENT}" is the trigger an action fires. That workflow declares `
        + '`parameters`, and `promptParameters` on the action opens their form before firing.',
        'In `condition` and in an Expression mapping the path is ABSOLUTE over the whole context '
        + '(`event.payload.x`); in an `{ kind: "Event", path }` mapping it is RELATIVE to '
        + 'event.payload (`x`). Mixing the two is the most common mistake in a workflow.',
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
        'In an action, `command` and `workflowId` are exclusive and `command` wins. A screen offers '
        + 'the action by naming its templateId in `cardActionIds` or `viewActionIds`.',
    }),
  },
  {
    name: 'read_authoring_guide',
    description:
      'The authoring manual for this platform: package anatomy, extension points, the curated API, '
      + 'code trust, translation rules and size limits. Read it before writing an extension. Pass a '
      + 'query to get only the matching sections.',
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
  {
    name: 'workspace_info',
    description:
      'What this workspace is bound to: the kernel contract version, whether an installation is '
      + 'connected, and where the curated type declarations live.',
    inputSchema: { type: 'object', properties: {} },
    run: (_input, root) => {
      const configPath = join(root, '../.microteia/firebase-config.json');
      const connected = existsSync(configPath);
      return pretty({
        kernelVersion: KERNEL_VERSION,
        workspace: root,
        hostTypes: hostTypesPath(root),
        installationConnected: connected,
        // O projeto Firebase é do escritório; o servidor o REPORTA, nunca o usa para escrever.
        firebaseProjectId: connected
          ? (JSON.parse(readFileSync(configPath, 'utf8')) as { projectId?: string }).projectId ?? null
          : null,
        plugins: findFiles(root, 'plugin.ts').map((entry) => relative(root, entry)),
      });
    },
  },
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
        capabilities: { tools: {} },
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

/** Exposto para teste: a lista de ferramentas é contrato com quem escreve o prompt do lado do cliente. */
export const mcpToolNames = (): string[] => TOOLS.map((tool) => tool.name);

export const runMcpTool = (name: string, input: Record<string, unknown>, root: string): string => {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (tool === undefined) throw new Error(`Unknown tool "${name}".`);
  return tool.run(input, root);
};
