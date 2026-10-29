import { isPortalIdentityAccount } from '../../../domain/schema/portalIdentity';

/**
 * Por que a casca não mostra o portal. `no-access-identity` é a conta aberta por um provedor sem acesso
 * nenhum: ela não tem link de e-mail a usar, e o que resolve é sair e entrar de novo pelo provedor.
 */
export type PortalAccessError =
  | 'no-access'
  | 'no-access-identity'
  | 'load-failed'
  | 'not-invited'
  | 'identity-required'
  | 'context-failed';

export interface PortalAccessState {
  userId: string | null | undefined;
  membershipsLoading: boolean;
  membershipsFailed: boolean;
  membershipCount: number;
  contextError: 'not-invited' | 'identity-required' | 'failed' | null;
}

export const portalAccessError = (state: PortalAccessState): PortalAccessError | null => {
  if (!state.membershipsLoading && state.membershipsFailed) return 'load-failed';
  if (!state.membershipsLoading && state.membershipCount === 0) {
    return isPortalIdentityAccount(state.userId) ? 'no-access-identity' : 'no-access';
  }
  if (state.contextError === 'failed') return 'context-failed';
  return state.contextError;
};

/**
 * A recusa que se resolve entrando de novo. A conta de um provedor recebe na entrada a soma dos
 * convites que a identidade satisfaz — inclusive o refeito que ainda não chegou a ela.
 */
export const portalOffersSignInAgain = (error: PortalAccessError | null, userId: string | null | undefined): boolean =>
  error === 'identity-required'
  || error === 'no-access-identity'
  || (error === 'not-invited' && isPortalIdentityAccount(userId));
