import type { ActorVia, WorkflowActor } from '../entities/WorkflowContext';
import { asPortalVerifiedIdentity, type PortalVerifiedIdentity } from '../schema/portalIdentity';

/**
 * A metade do ator que atravessa o barramento de eventos: a IDENTIDADE, sem as permissões.
 *
 * Quem apertou o botão é um fato, e continua verdadeiro na invocação que roda o fluxo depois. O
 * conjunto de permissões é um retrato do acesso naquele instante — gravá-lo no evento seria
 * persistir um acesso que envelhece, e por isso o ator remontado daqui chega com `permissions: []`
 * (`hasPermission(...)` responde NÃO, como respondia antes).
 */
export interface PublishedActor {
  userId: string;
  name: string;
  photoURL: string;
  via: ActorVia;
  /**
   * A identidade que o convidado do portal PROVOU ao entrar. É identidade, não acesso — um fato do
   * login, que não envelhece —, e por isso atravessa: sem ela, o que o fluxo gravasse em nome do
   * convidado sairia sem `portalVerified`, como se ele tivesse entrado só pelo link de e-mail.
   */
  verified?: PortalVerifiedIdentity;
}

/** O que as expressões do fluxo leem em `actor`. `null` quando não há pessoa por trás da execução. */
export interface ExpressionActor {
  id: string;
  name: string;
  via: ActorVia;
  /** A identidade que o convidado do portal provou; `null` em todo outro caso — e lê-la não estoura. */
  verified: PortalVerifiedIdentity | null;
}

const ACTOR_VIAS: readonly ActorVia[] = ['ui', 'agent', 'portal', 'import'];

export const toPublishedActor = (actor: WorkflowActor): PublishedActor => ({
  userId: actor.userId,
  name: actor.name,
  photoURL: actor.photoURL,
  via: actor.via,
  ...(actor.via === 'portal' && actor.verified ? { verified: actor.verified } : {}),
});

/**
 * O ator gravado num evento, de volta. Qualquer forma inesperada vira AUSÊNCIA de ator, nunca um
 * ator parcial: um uid sem `via` não diz se a gravação foi de uma pessoa ou de um agente, e inventar
 * a resposta é o que este campo existe para não fazer.
 */
export const actorFromPublished = (raw: unknown): WorkflowActor | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const data = raw as Record<string, unknown>;
  if (typeof data.userId !== 'string' || data.userId === '') return undefined;
  if (!ACTOR_VIAS.includes(data.via as ActorVia)) return undefined;
  // Só o convidado prova identidade por provedor; num ator de dentro, a chave seria forjada.
  const verified = data.via === 'portal' ? asPortalVerifiedIdentity(data.verified) : null;
  return {
    userId: data.userId,
    name: typeof data.name === 'string' ? data.name : '',
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
    via: data.via as ActorVia,
    permissions: [],
    ...(verified ? { verified } : {}),
  };
};

export const toExpressionActor = (actor: WorkflowActor | undefined): ExpressionActor | null =>
  actor ? { id: actor.userId, name: actor.name, via: actor.via, verified: actor.verified ?? null } : null;
