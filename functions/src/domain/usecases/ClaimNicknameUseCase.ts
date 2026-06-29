import type { INicknameRepository } from '../repositories/INicknameRepository';

const isValidNicknameFormat = (nickname: string): boolean =>
  /^[a-zA-Z0-9._-]{3,30}$/.test(nickname);

const NICKNAME_BLOCKLIST = [
  'curatino', 'admin', 'root', 'superuser', 'system',
  'suporte', 'support', 'moderador', 'moderator',
  'staff', 'oficial', 'official',
];

const isNicknameBlocklisted = (nickname: string): boolean => {
  const lower = nickname.toLowerCase();
  return NICKNAME_BLOCKLIST.some((word) => lower.includes(word));
};

export type ClaimNicknameUseCase = {
  execute: (nickname: string, userId: string) => Promise<void>;
};

export const makeClaimNicknameUseCase = (
  nicknameRepository: INicknameRepository,
): ClaimNicknameUseCase => ({
  execute: async (nickname: string, userId: string) => {
    if (!isValidNicknameFormat(nickname)) {
      throw new Error('Formato de apelido inválido.');
    }

    if (isNicknameBlocklisted(nickname)) {
      throw new Error('Este apelido não é permitido.');
    }

    const profile = await nicknameRepository.getUserProfile(userId);
    if (profile?.nicknameSetAt) {
      throw new Error('Você já possui um apelido e não pode alterá-lo.');
    }

    await nicknameRepository.claim(nickname, userId);
  },
});
