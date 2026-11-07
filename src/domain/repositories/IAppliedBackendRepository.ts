import type { AppliedBackend } from '../entities/AppliedBackend';

/**
 * Somente leitura: o documento é escrito pelo Microteia Console, e a regra do Firestore nega escrita
 * ao cliente.
 *
 * Assinatura, e não leitura única, porque é ela que tira a extensão de "Backend pendente" na tela de
 * quem está esperando o `provision` terminar, sem recarregar a página.
 */
export interface IAppliedBackendRepository {
  /** `null` quando o Console nunca gravou o documento neste projeto, ou quando a leitura foi recusada. */
  subscribe: (onChange: (applied: AppliedBackend | null) => void) => () => void;
}
