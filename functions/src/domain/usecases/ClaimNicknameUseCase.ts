import type { INicknameRepository } from '../repositories/INicknameRepository';
import { alreadyExists, invalidArgument } from '../errors/DomainError';

const isValidNicknameFormat = (nickname: string): boolean =>
  /^[a-zA-Z0-9._-]{3,30}$/.test(nickname);

const NICKNAME_BLOCKLIST = [
  'microteia', 'admin', 'root', 'superuser', 'system',
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
      throw invalidArgument('Formato de apelido inválido.');
    }

    if (isNicknameBlocklisted(nickname)) {
      throw invalidArgument('Este apelido não é permitido.');
    }

    const profile = await nicknameRepository.getUserProfile(userId);
    if (profile?.nicknameSetAt) {
      throw alreadyExists('Você já possui um apelido e não pode alterá-lo.');
    }

    await nicknameRepository.claim(nickname, userId);
  },
});
