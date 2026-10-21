import type { UserInfo } from '../entities/UserInfo';

export interface CreateUserInput {
  email: string;
  displayName: string;
  photoURL: string | null;
  /** `portal` quando a conta nasceu de um convite do portal — ela não ganha escritório próprio. */
  origin?: 'portal';
}

export interface IUserRepository {
  getUserInfo(userId: string): Promise<UserInfo>;
  getUserRole(userId: string): Promise<string | null>;
  /** Idempotente — não sobrescreve e retorna false se o documento já existir. */
  createUserIfMissing(userId: string, data: CreateUserInput): Promise<boolean>;
  /** Idempotente — não sobrescreve se o documento já existir. */
  createUserProfileIfMissing(userId: string): Promise<void>;
}
