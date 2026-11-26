import type {
  ActionModuleTemplate,
  ReportModuleTemplate,
  ScriptModuleTemplate,
  WorkflowModuleTemplate,
} from '../../entities/MarketplacePlugin';

/**
 * Tudo o que o PACOTE declara num artefato de id gerado. É um `Record` sobre as chaves do template, e não
 * uma lista, para que o compilador cobre a propriedade nova: esquecida aqui, ela voltaria a ser mesclada
 * na atualização — e foi exatamente assim que nasceu a #38.
 */
type ContentKeys<T, Excluded extends PropertyKey = never> = Record<Exclude<keyof T, 'templateId' | Excluded>, true>;

const ACTION_CONTENT: ContentKeys<ActionModuleTemplate> = {
  key: true,
  title: true,
  icon: true,
  workflowId: true,
  command: true,
  hiddenWhen: true,
  disabledWhen: true,
  activeWhen: true,
  confirmMessage: true,
  promptParameters: true,
  parameterDefaults: true,
  danger: true,
  enabled: true,
  order: true,
  ownerPluginIds: true,
  sourceId: true,
  sourceRev: true,
};

const WORKFLOW_CONTENT: ContentKeys<WorkflowModuleTemplate> = {
  name: true,
  description: true,
  eventName: true,
  lookupCollection: true,
  parameters: true,
  schedule: true,
  dateReached: true,
  changeType: true,
  changedFields: true,
  mailFilter: true,
  subscribable: true,
  access: true,
  ownerPluginIds: true,
  sourceId: true,
  sourceRev: true,
  version: true,
  condition: true,
  steps: true,
};

const SCRIPT_CONTENT: ContentKeys<ScriptModuleTemplate> = {
  name: true,
  description: true,
  sourceTs: true,
  compiledJs: true,
  inputParams: true,
  outputParams: true,
  ownerPluginIds: true,
  sourceId: true,
  sourceRev: true,
};

// `view` aponta para código do pacote e nunca chega ao documento (`reportInputFromTemplate`).
const REPORT_CONTENT: ContentKeys<ReportModuleTemplate, 'view'> = {
  key: true,
  title: true,
  description: true,
  icon: true,
  spec: true,
  origin: true,
  sourceId: true,
  sourceRev: true,
  managed: true,
  enabled: true,
  hideFromSidebar: true,
  sidebarOrder: true,
};

/**
 * O artefato da extensão é SUBSTITUÍDO na atualização, não mesclado (#38).
 *
 * A gravação é um `updateDoc`, e o Firestore descarta `undefined`: uma propriedade que a versão nova
 * deixou de declarar simplesmente não chegava à gravação, e a da versão anterior ficava no documento. O
 * autor que tirava `confirmMessage` de uma ação via o diálogo sobreviver em todo escritório que
 * atualizava — e só a instalação nova recebia a remoção. `null` é o "limpe" que os quatro repositórios já
 * entendem, e os mapeadores, dos dois lados, o leem como ausente.
 *
 * Só serve à REESCRITA: na criação não há o que limpar.
 */
const asReplacement = <T extends object>(input: T, content: Record<string, true>): T => {
  const replaced = { ...input } as Record<string, unknown>;
  for (const key of Object.keys(content)) {
    if (replaced[key] === undefined) replaced[key] = null;
  }
  return replaced as T;
};

export const actionReplacement = <T extends object>(input: T): T => asReplacement(input, ACTION_CONTENT);
export const workflowReplacement = <T extends object>(input: T): T => asReplacement(input, WORKFLOW_CONTENT);
export const scriptReplacement = <T extends object>(input: T): T => asReplacement(input, SCRIPT_CONTENT);
export const reportReplacement = <T extends object>(input: T): T => asReplacement(input, REPORT_CONTENT);
