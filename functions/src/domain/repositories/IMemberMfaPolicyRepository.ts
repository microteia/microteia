import type { MemberMfaPolicy } from '../schema/memberMfa';

/**
 * `memberMfaPolicies/{tenantId}` — o que o escritório exige. Coleção na RAIZ, como `auditRetention`:
 * nenhuma regra de coleção de tela a alcança, e só o servidor grava (`write: false` nas regras).
 *
 * `get` nunca devolve "nada": o escritório sem documento tem a política desligada, que é o que valia
 * antes de ela existir.
 */
export interface IMemberMfaPolicyRepository {
  get(tenantId: string): Promise<MemberMfaPolicy>;
  save(tenantId: string, policy: MemberMfaPolicy, authorId: string): Promise<void>;
}

/** Quem abre a sessão que carrega a prova — `createCustomToken`, com a claim da verificação. */
export interface IMfaSessionMinter {
  mint(userId: string, verifiedAt: number): Promise<string>;
}
