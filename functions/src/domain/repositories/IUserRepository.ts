import type { UserInfo } from '../entities/UserInfo';

export interface CreateUserInput {
  email: string;
  displayName: string;
  photoURL: string | null;
  /**
   * `portal` quando a conta nasceu de um convite do portal; `invitation` quando a instalação desligou o
   * autocadastro de escritório (`SELF_SERVICE_TENANTS=false`). Nas duas, a conta não ganha escritório
   * próprio — e o carimbo é o que diz ao navegador que o provisionamento terminou mesmo assim.
   */
  origin?: 'portal' | 'invitation';
}

/** O que a criação fez. `firstUser`: a primeira conta da instalação, que nasce `SYSTEM`. */
export interface CreatedUser {
  firstUser: boolean;
}

/** A conta como `users/{uid}` a guarda — o bastante para abrir um escritório em nome dela. */
export interface StoredUser {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  origin: 'portal' | 'invitation' | null;
}

export interface IUserRepository {
  getUserInfo(userId: string): Promise<UserInfo>;
  getUserRole(userId: string): Promise<string | null>;
  /** Quem, entre estas contas, é o administrador global (`role: 'SYSTEM'`) — numa leitura só. */
  getSystemAccounts(userIds: string[]): Promise<Set<string>>;
  /** Idempotente — não sobrescreve e devolve `null` se o documento já existir. */
  createUserIfMissing(userId: string, data: CreateUserInput): Promise<CreatedUser | null>;
  /**
   * Carimba a origem DEPOIS da criação. Existe para `invitation`: só a transação de criação sabe se a
   * conta é a primeira da instalação — que ganha escritório mesmo com o autocadastro desligado —, então
   * o carimbo não pode ir junto com ela.
   */
  setOrigin(userId: string, origin: 'invitation'): Promise<void>;
  /** A conta pelo e-mail, exato e depois em minúsculas — é como o cadastro o gravou. */
  findByEmail(email: string): Promise<StoredUser | null>;
  /** Os escritórios de que a pessoa participa (`users/{uid}.tenantIds`). */
  getTenantIds(userId: string): Promise<string[]>;
  /** Idempotente — não sobrescreve se o documento já existir. */
  createUserProfileIfMissing(userId: string): Promise<void>;
}
