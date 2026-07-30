import type {
  ActionModuleTemplate,
  ScriptModuleTemplate,
  WorkflowModuleTemplate,
} from '../../entities/MarketplacePlugin';
import type { WorkflowDefinition, WorkflowStep } from '../../entities/Workflow';
import type { Script } from '../../entities/Script';
import type { ActionDefinitionInput } from '../../repositories/IActionRepository';
import { splitEntityEventName } from '../../schema/eventCatalog';
import { installedScreenKey } from './screenModule';

export type IdMap = Map<string, string>;

/**
 * Reescreve, recursivamente (inclui ramos e corpos de laço), o valor Literal de um input de Step
 * pelo id remapeado. É como as referências a script (`scriptId`) e a outro workflow
 * (`targetWorkflowId`) migram do id de template para o id real gerado na instalação.
 */
export const rewriteStepLiteral = (steps: WorkflowStep[], inputId: string, map: IdMap): WorkflowStep[] =>
  steps.map((step) => {
    let next = step;
    const mapping = step.configuration?.[inputId];
    if (mapping && mapping.kind === 'Literal' && typeof mapping.value === 'string') {
      const mapped = map.get(mapping.value);
      if (mapped) {
        next = { ...next, configuration: { ...next.configuration, [inputId]: { ...mapping, value: mapped } } };
      }
    }
    if (next.branches) {
      next = {
        ...next,
        branches: {
          whenTrue: rewriteStepLiteral(next.branches.whenTrue, inputId, map),
          whenFalse: rewriteStepLiteral(next.branches.whenFalse, inputId, map),
        },
      };
    }
    if (next.loop) {
      next = { ...next, loop: { ...next.loop, body: rewriteStepLiteral(next.loop.body, inputId, map) } };
    }
    return next;
  });

const withoutTemplateId = <T extends { templateId: string }>(template: T): Omit<T, 'templateId'> => {
  const clone = { ...template } as Record<string, unknown>;
  delete clone.templateId;
  return clone as Omit<T, 'templateId'>;
};

const stripUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    ) as T;
  }
  return value;
};

export type ScriptInput = Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
export type WorkflowInput = Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;

export const scriptInputFromTemplate = (template: ScriptModuleTemplate, pluginId: string): ScriptInput => {
  const rest = withoutTemplateId(template);
  return stripUndefined({ ...rest, ownerPluginId: pluginId, ownerPluginIds: [pluginId], sourceId: template.templateId, sourceRev: template.sourceRev ?? null });
};

/**
 * Passada 1 do workflow: remove `templateId`, marca o dono, nasce habilitado, reescreve `scriptId`
 * pelos ids reais dos scripts e namespaceia a tela-gatilho. `targetWorkflowId` continua em template
 * (só é remapeado na passada 2, quando todos os workflows já têm id).
 */
export const workflowInputFromTemplate = (
  template: WorkflowModuleTemplate,
  pluginId: string,
  scriptMap: IdMap,
  screenKeyMap: IdMap,
): WorkflowInput => {
  const rest = withoutTemplateId(template);
  const steps = rewriteStepLiteral(rest.steps ?? [], 'scriptId', scriptMap);
  // O gatilho é `<coleção>.saved`: a coleção é a chave de template da tela e vira a instalada.
  const event = splitEntityEventName(rest.eventName);
  const eventName = event && screenKeyMap.has(event.collection)
    ? `${screenKeyMap.get(event.collection)}.${event.action}`
    : rest.eventName;
  return stripUndefined({
    ...rest, steps, eventName, ownerPluginId: pluginId, ownerPluginIds: [pluginId], sourceId: template.templateId, sourceRev: template.sourceRev ?? null, enabled: true,
  });
};

export const actionInputFromTemplate = (
  template: ActionModuleTemplate,
  pluginId: string,
  workflowMap: IdMap,
  createdBy: string,
): ActionDefinitionInput => {
  const rest = withoutTemplateId(template);
  return stripUndefined({
    ...rest,
    workflowId: workflowMap.get(rest.workflowId) ?? rest.workflowId,
    ownerPluginId: pluginId,
    ownerPluginIds: [pluginId],
    sourceId: template.templateId,
    sourceRev: template.sourceRev ?? null,
    createdBy,
  }) as ActionDefinitionInput;
};

/** Resolução da chave instalada da tela — reexportada para o materializador orquestrar. */
export { installedScreenKey };
