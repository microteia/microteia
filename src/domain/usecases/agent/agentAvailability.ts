import type { InstalledExtension } from '../../entities/InstalledExtension';
import { AGENT_MCP_FUNCTION } from '../../schema/agent/agentBackend';
import { isExtensionBackendApplied } from '../plugins/extensionBackendState';

/**
 * Em que estado o acesso de agente está NESTE escritório.
 *
 * - `disabled` — nenhuma extensão instalada e ativa reivindica a function. Nada está no ar.
 * - `pending` — alguma reivindica, mas o projeto Firebase ainda não foi provisionado. O endpoint não
 *   existe, e é isso que separa "instalado" de "alcançável". Sem este estado, a tela diria "pronto" e
 *   toda chamada voltaria 404 — o defeito que `isExtensionBackendPending` existe para não repetir.
 * - `ready` — o endpoint está no ar.
 */
export type AgentAvailability = 'disabled' | 'pending' | 'ready';

/**
 * A pergunta é pelo NOME DA FUNCTION, nunca pelo id de um plugin.
 *
 * É a mesma inversão que `agentMcp` faz do lado do servidor, e pela mesma razão: o kernel nomeia só o
 * que é dele. Escrever `com.microteia.agent` aqui prenderia a tela do núcleo a um pacote específico —
 * e quem bifurcasse a extensão para um pacote próprio veria a tela dizer que nada está ligado.
 */
export const agentAvailability = (installed: readonly InstalledExtension[]): AgentAvailability => {
  const claimants = installed.filter(
    (extension) => extension.active
      && (extension.package.manifest.backend?.functions ?? []).includes(AGENT_MCP_FUNCTION),
  );
  if (claimants.length === 0) return 'disabled';
  return claimants.some(isExtensionBackendApplied) ? 'ready' : 'pending';
};
