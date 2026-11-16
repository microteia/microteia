import type { RegistrationPolicy } from '../schema/registration';

/** O que a instalação faz com quem chega pela primeira vez, visto pelo `SYSTEM`. Ver `domain/schema/registration.ts`. */
export interface IRegistrationPolicyRepository {
  getPolicy(): Promise<RegistrationPolicy>;
  /** Grava só os campos informados: trocar um não pode reescrever o outro com o valor que a tela tinha. */
  updatePolicy(change: Partial<Omit<RegistrationPolicy, 'defaultExtensions'>>, updatedBy: string): Promise<void>;
  /**
   * Põe ou tira UMA extensão da lista de padrão, sem reescrever a lista: dois administradores marcando
   * extensões diferentes ao mesmo tempo não apagam a marca um do outro.
   */
  setDefaultExtension(pluginId: string, isDefault: boolean, updatedBy: string): Promise<void>;
}
