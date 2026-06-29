export interface NicknameAvailability {
  available: boolean;
  reason?: 'format' | 'blocked' | 'taken';
}

export interface NicknameData {
  userId: string;
  nickname: string;
  nicknameSetAt: Date;
}
