import type { RegistrationPolicy } from '../schema/registration';

/** O que a instalação faz com quem chega pela primeira vez, visto pelo `SYSTEM`. Ver `domain/schema/registration.ts`. */
export interface IRegistrationPolicyRepository {
  getPolicy(): Promise<RegistrationPolicy>;
  /** Grava só os campos informados: trocar um não pode reescrever o outro com o valor que a tela tinha. */
  updatePolicy(change: Partial<RegistrationPolicy>, updatedBy: string): Promise<void>;
}
