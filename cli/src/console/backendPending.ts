import type { BackendPendingReason, PluginBackendRequirement } from '../kernel/backendShape.js';

export interface PendingCause {
  reason: BackendPendingReason;
  functions: string[];
}

/** O que uma execução do `provision` sabe sobre as functions — a mesma conta que ele já faz. */
export interface PendingInputs {
  /**
   * As extensões cuja fonte EMPACOTADA não subiu nesta execução: aguardando aprovação, ou recusada por
   * não conferir. Vem antes de tudo — sem ela, a fonte "não existe" para o resto da conta, e o motivo
   * mandaria procurar a pasta que o autor nunca precisou criar.
   */
  held?: ReadonlyMap<string, BackendPendingReason>;
  /** O que existe para ser deployado: o pacote do kernel mais as fontes da instalação. */
  deployable: ReadonlySet<string>;
  /** Nome -> a extensão cuja reivindicação foi recusada por ele (plataforma, comum, portão trocado). */
  refusedClaims: ReadonlyMap<string, string>;
  /** As que estavam na fila e saíram dela por falta do portão. */
  ungated: ReadonlySet<string>;
  /** O que está no ar depois desta execução: aplicado antes, subido agora ou pulado por estar igual. */
  satisfied: ReadonlySet<string>;
}

/**
 * Por que ESTA extensão continua pendente, na ordem em que um autor teria de resolver.
 *
 * A ordem importa porque as causas se encadeiam: sem fonte não há portão a conferir, e sem portão não
 * há deploy que possa falhar. Relatar a última em vez da primeira mandaria corrigir algo que nem chegou
 * a ser tentado.
 *
 * Nulo quando nada falta — inclusive quando a extensão não exige function nenhuma: índice que não
 * converge derruba o comando inteiro, e parâmetro vazio não impede o carimbo.
 */
export const pendingCauseOf = (
  claim: { pluginId: string; backend: PluginBackendRequirement },
  inputs: PendingInputs,
): PendingCause | null => {
  const names = claim.backend.functions ?? [];
  const pick = (test: (name: string) => boolean): string[] => names.filter(test);

  const held = inputs.held?.get(claim.pluginId);
  if (held !== undefined && names.length > 0) return { reason: held, functions: [...names] };

  const missing = pick((name) => !inputs.deployable.has(name));
  if (missing.length > 0) return { reason: 'function-source-missing', functions: missing };

  const refused = pick((name) => inputs.refusedClaims.get(name) === claim.pluginId);
  if (refused.length > 0) return { reason: 'function-claim-refused', functions: refused };

  const ungated = pick((name) => inputs.ungated.has(name));
  if (ungated.length > 0) return { reason: 'gate-missing', functions: ungated };

  const failed = pick((name) => !inputs.satisfied.has(name));
  if (failed.length > 0) return { reason: 'deploy-failed', functions: failed };

  return null;
};
