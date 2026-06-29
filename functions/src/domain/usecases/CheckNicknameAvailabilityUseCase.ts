import type { INicknameRepository } from '../repositories/INicknameRepository';
import type { NicknameAvailability } from '../entities/NicknameInfo';

const NICKNAME_BLOCKLIST = [
  'curatino', 'admin', 'root', 'superuser', 'system',
  'suporte', 'support', 'moderador', 'moderator',
  'staff', 'oficial', 'official',
];

const isValidNicknameFormat = (nickname: string): boolean =>
  /^[a-zA-Z0-9._-]{3,30}$/.test(nickname);

const isNicknameBlocklisted = (nickname: string): boolean => {
  const lower = nickname.toLowerCase();
  return NICKNAME_BLOCKLIST.some((word) => lower.includes(word));
};

export type CheckNicknameAvailabilityUseCase = {
  execute: (nickname: string, userId: string) => Promise<NicknameAvailability>;
};

export const makeCheckNicknameAvailabilityUseCase = (
  nicknameRepository: INicknameRepository,
): CheckNicknameAvailabilityUseCase => ({
  execute: async (nickname: string, userId: string) => {
    if (!isValidNicknameFormat(nickname)) {
      return { available: false, reason: 'format' };
    }

    if (isNicknameBlocklisted(nickname)) {
      return { available: false, reason: 'blocked' };
    }

    return nicknameRepository.checkAvailability(nickname, userId);
  },
});
