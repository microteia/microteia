import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { AppliedBackend } from '../../entities/AppliedBackend';
import { AGENT_MCP_FUNCTION } from '../../schema/agent/agentBackend';
import type { BackendFunctionAvailability } from '../plugins/backendFunctionAvailability';
import { backendFunctionAvailability } from '../plugins/backendFunctionAvailability';

/** Em que estado o acesso de agente está NESTE escritório — o do endpoint `agentMcp`. */
export type AgentAvailability = BackendFunctionAvailability;

export const agentAvailability = (
  installed: readonly InstalledExtension[],
  projectApplied: AppliedBackend | null,
): AgentAvailability => backendFunctionAvailability(installed, projectApplied, AGENT_MCP_FUNCTION);
