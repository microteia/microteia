import type { UserInfo } from '../entities/UserInfo';

export interface IUserRepository {
  getUserInfo(userId: string): Promise<UserInfo>;
}
