import type { BackendResidue } from '../entities/BackendResidue';

/**
 * Somente leitura, e é o contrato inteiro: o documento é escrito pelo Microteia Console com credencial
 * de administrador, e a regra do Firestore nega escrita ao cliente. Um método de escrita aqui prometeria
 * o que as regras recusam.
 */
export interface IBackendResidueRepository {
  /** `null` quando o Console nunca rodou neste projeto, ou quando a leitura foi recusada. */
  get: () => Promise<BackendResidue | null>;
}
