import type { AgentToolDefinition } from '../schema/agent/agentOps';
import { AGENT_TOOLS } from '../schema/agent/agentOps';
import { grants } from '../schema/access/memberPermissions';
import type { AssistantWriteMode } from '../schema/assistant/assistantConversation';

/**
 * As ferramentas que o modelo recebe. Fora as de escrita quando o escritório desligou a escrita, e
 * fora as de permissão FIXA que a pessoa não tem — cada definição custa contexto em toda chamada, e
 * oferecer uma ferramenta que certamente recusa só ensina o modelo a tentar. As de coleção ficam: se
 * a pessoa pode ou não, depende da coleção que o modelo escolher, e a recusa explica.
 */
export const assistantTools = (permissions: string[], writeMode: AssistantWriteMode): AgentToolDefinition[] =>
  AGENT_TOOLS.filter((tool) => !(tool.writes && writeMode === 'off'))
    .filter((tool) => tool.permission.kind !== 'fixed' || grants(permissions, tool.permission.id));

/** Só `confirm` pede decisão, e só para o que grava. */
export const toolNeedsApproval = (tool: AgentToolDefinition | null, writeMode: AssistantWriteMode): boolean =>
  writeMode === 'confirm' && tool?.writes === true;
