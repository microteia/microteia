import type { RegistrationPolicy } from '../schema/registration';

/** A conta recém-criada no Firebase Auth que a trava de contas novas recusou. */
export interface RefusedAccount {
  userId: string;
  email: string;
}

/** O que a instalação faz com quem chega pela primeira vez. Ver `domain/schema/registration.ts`. */
export interface IRegistrationRepository {
  /** Documento ausente: conta nova aceita, e com escritório próprio. */
  getPolicy(): Promise<RegistrationPolicy>;
  /**
   * Grava a recusa que o navegador lê e APAGA a conta do Firebase Auth — nessa ordem: apagada antes, a
   * sessão que ainda espera o provisionamento não teria o que ler, e esperaria até o tempo-limite.
   */
  refuse(account: RefusedAccount): Promise<void>;
}
