import type { AppUser, UserRole } from '../entities';

export interface IUserRepository {
  getCurrentUserProfile(userId: string): Promise<AppUser | null>;
  /**
   * Aguarda o provisionamento do usuário (users/{uid} + primeiro tenant) feito pela
   * Cloud Function onUserCreated (Admin SDK) logo após o cadastro no Firebase Auth.
   * O client não cria mais o próprio documento — só espera ele aparecer.
   */
  waitForProvisioning(userId: string, timeoutMs?: number): Promise<AppUser>;
  getUserByEmail(email: string): Promise<AppUser | null>;
  getUsers(): Promise<AppUser[]>;
  updateUserRole(userId: string, role: UserRole): Promise<void>;
}
