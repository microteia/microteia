import type { AppUser, UserRole } from '../entities';

export interface IUserRepository {
  getCurrentUserProfile(userId: string): Promise<AppUser | null>;
  createUserProfile(userId: string, data: Pick<AppUser, 'email' | 'displayName' | 'photoURL'>): Promise<AppUser>;
  getUserByEmail(email: string): Promise<AppUser | null>;
  getUsers(): Promise<AppUser[]>;
  updateUserRole(userId: string, role: UserRole): Promise<void>;
}
