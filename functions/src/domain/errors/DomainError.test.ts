import { describe, it, expect } from 'vitest';
import {
  DomainError,
  alreadyExists,
  domainErrorCode,
  failedPrecondition,
  invalidArgument,
  notFound,
  permissionDenied,
} from './DomainError';

describe('DomainError', () => {
  it('carrega o código separado da frase', () => {
    const error = permissionDenied('Apenas administradores podem revogar contas Gmail.');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('permission-denied');
    expect(error.message).toBe('Apenas administradores podem revogar contas Gmail.');
  });

  it('cobre os construtores de cada código', () => {
    expect(notFound('x').code).toBe('not-found');
    expect(invalidArgument('x').code).toBe('invalid-argument');
    expect(alreadyExists('x').code).toBe('already-exists');
    expect(failedPrecondition('x').code).toBe('failed-precondition');
  });
});

describe('domainErrorCode', () => {
  it('lê o código de um erro de domínio', () => {
    expect(domainErrorCode(notFound('sumiu'))).toBe('not-found');
  });

  /** Erro sem código declarado é, por definição, um que ninguém previu — vira `internal`. */
  it('devolve null para o que não é erro de domínio', () => {
    expect(domainErrorCode(new Error('Apenas administradores podem tudo.'))).toBeNull();
    expect(domainErrorCode('texto solto')).toBeNull();
    expect(domainErrorCode(null)).toBeNull();
  });

  /**
   * A regressão que este arquivo existe para impedir: antes, o handler decidia o código HTTP lendo o
   * TEXTO da mensagem. Reescrever a frase — ou traduzi-la — mudava o código devolvido ao cliente sem
   * erro de compilação e sem teste vermelho. O código agora sobrevive a qualquer reescrita.
   */
  it('não depende do texto da mensagem', () => {
    expect(domainErrorCode(permissionDenied('Only admins may do this.'))).toBe('permission-denied');
    expect(domainErrorCode(permissionDenied(''))).toBe('permission-denied');
  });

  it('sobrevive ao instanceof depois de serializado como Error comum', () => {
    const error = new DomainError('not-found', 'sumiu');
    expect(error.name).toBe('DomainError');
    expect(domainErrorCode(error)).toBe('not-found');
  });
});
