import type {
  ActionModuleTemplate,
  ScreenModuleTemplate,
  ScriptModuleTemplate,
  WorkflowModuleTemplate,
} from '../../entities/MarketplacePlugin';
import type { WorkflowDefinition, WorkflowStep } from '../../entities/Workflow';
import type { Script } from '../../entities/Script';
import type { ActionDefinitionInput } from '../../repositories/IActionRepository';
import { mapSteps } from '../../services/stepTree';
import { isArtifactRef } from '../../schema/plugin/artifactRef';
import { childRecordEventName, splitChildRecordEventName, splitEntityEventName } from '../../schema/eventCatalog';
import { installedScreenKey, screenEventPrefix } from './screenModule';

export type IdMap = Map<string, string>;

/**
 * Reescreve, recursivamente (inclui ramos e corpos de laço), o valor Literal de um input de Step
 * pelo id remapeado. É como as referências a script (`scriptId`) e a outro workflow
 * (`targetWorkflowId`) migram do id de template para o id real gerado na instalação.
 *
 * A referência QUALIFICADA a outra extensão (`com.acme.utils/normalizar-cpf`) passa intacta, de
 * propósito: ela já é universal, e é o motor que a resolve por nome a cada execução. Reescrevê-la
 * para o id local de hoje é o que a deixaria pendurada quando a extensão dona fosse reinstalada e
 * renumerasse os artefatos. A guarda é explícita porque, sem ela, o comportamento certo dependia de
 * o mapa ERRAR — e "acidentalmente correto" foi exatamente como nasceu a trava `0 > 0` de
 * `shouldRewriteContent`.
 */
export const rewriteStepLiteral = (steps: WorkflowStep[], inputId: string, map: IdMap): WorkflowStep[] =>
  mapSteps(steps, (step) => {
    const mapping = step.configuration?.[inputId];
    if (!mapping || mapping.kind !== 'Literal' || typeof mapping.value !== 'string'
      || isArtifactRef(mapping.value)) {
      return step;
    }
    const mapped = map.get(mapping.value);
    if (!mapped) return step;
    return { ...step, configuration: { ...step.configuration, [inputId]: { ...mapping, value: mapped } } };
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
 * `prefixoNoPacote → prefixoInstalado`, para os gatilhos dos workflows.
 *
 * Só entra aqui a tela cujo evento leva a CHAVE dela: é a única que pode mudar de nome na instalação
 * (sufixo por nome ocupado, ou a chave de uma tela que já existia no escritório). Prefixo declarado —
 * direto ou pela coleção que a tela descreve — é nome global e atravessa a instalação intacto;
 * reescrevê-lo faria a automação escutar um evento que ninguém publica.
 */
export const buildScreenEventMap = (
  screens: ScreenModuleTemplate[],
  screenKeyMap: IdMap,
): IdMap => {
  const eventMap: IdMap = new Map();
  for (const screen of screens) {
    const prefix = screenEventPrefix(screen);
    if (prefix !== screen.key) continue;
    const installed = screenKeyMap.get(screen.key);
    if (installed && installed !== prefix) eventMap.set(prefix, installed);
  }
  return eventMap;
};

/**
 * A coleção de cada tela do pacote que leva o nome DELA: é a que muda quando a chave ganha sufixo na
 * instalação. A tela com `dataCollection` descreve uma coleção de nome global, que não muda.
 */
export const buildScreenCollectionMap = (screens: ScreenModuleTemplate[], screenKeyMap: IdMap): IdMap => {
  const collectionMap: IdMap = new Map();
  for (const screen of screens) {
    if (screen.dataCollection) continue;
    const installed = screenKeyMap.get(screen.key);
    if (installed && installed !== screen.key) collectionMap.set(screen.key, installed);
  }
  return collectionMap;
};

/**
 * Passada 1 do workflow: remove `templateId`, marca o dono, nasce habilitado, reescreve `scriptId`
 * pelos ids reais dos scripts, a coleção de `share-documents` e a de `portal-invite`/`portal-revoke` pela
 * tela instalada e acerta o gatilho
 * pela tela instalada. `targetWorkflowId` continua em template (só é remapeado na passada 2, quando
 * todos os workflows já têm id).
 */
export const workflowInputFromTemplate = (
  template: WorkflowModuleTemplate,
  pluginId: string,
  scriptMap: IdMap,
  screenEventMap: IdMap,
  screenCollectionMap: IdMap = new Map(),
): WorkflowInput => {
  const rest = withoutTemplateId(template);
  const steps = rewriteStepLiteral(
    rewriteStepLiteral(
      rewriteStepLiteral(rest.steps ?? [], 'scriptId', scriptMap),
      'collection',
      screenCollectionMap,
    ),
    'subjectCollection',
    screenCollectionMap,
  );
  const event = splitEntityEventName(rest.eventName);
  const child = splitChildRecordEventName(rest.eventName);
  const childParent = child ? screenEventMap.get(child.parentPrefix) : undefined;
  const eventName = event && screenEventMap.has(event.prefix)
    ? `${screenEventMap.get(event.prefix)}.${event.action}`
    : child && childParent !== undefined
      ? childRecordEventName(childParent, child.kind, child.action)
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
    // Referência qualificada a outra extensão nunca está no mapa (ele é dos `templateId` deste
    // pacote, e nenhum deles tem `/`), então ela cai no fallback e viaja intacta até o motor.
    // A ação de `command` pode chegar sem `workflowId`; gravada, a entidade o tem sempre, vazio.
    workflowId: rest.workflowId ? workflowMap.get(rest.workflowId) ?? rest.workflowId : '',
    ownerPluginId: pluginId,
    ownerPluginIds: [pluginId],
    sourceId: template.templateId,
    sourceRev: template.sourceRev ?? null,
    createdBy,
  }) as ActionDefinitionInput;
};

/** Resolução da chave instalada da tela — reexportada para o materializador orquestrar. */
export { installedScreenKey };
