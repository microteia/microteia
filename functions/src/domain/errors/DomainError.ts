/**
 * Um erro de domínio que carrega o QUE ele é, e não só o que ele diz.
 *
 * Antes, os handlers decidiam o código HTTP lendo o TEXTO da mensagem
 * (`message.includes('Apenas administradores')` → `permission-denied`). Isso funcionava por
 * coincidência e tinha duas falhas graves: reescrever a frase — corrigir uma vírgula, trocar
 * "escritório" por "organização" — mudava silenciosamente o código devolvido ao cliente; e traduzir
 * a mensagem para outro idioma quebrava o desvio inteiro, sem erro de compilação e sem teste vermelho.
 *
 * Com o código separado da frase, a mensagem passa a ser o que sempre deveria ter sido: texto para
 * uma pessoa ler, livre para mudar e para ser traduzido.
 */
export type DomainErrorCode =
  | 'permission-denied'
  | 'not-found'
  | 'invalid-argument'
  | 'already-exists'
  | 'failed-precondition';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export const permissionDenied = (message: string): DomainError =>
  new DomainError('permission-denied', message);

export const notFound = (message: string): DomainError => new DomainError('not-found', message);

export const invalidArgument = (message: string): DomainError =>
  new DomainError('invalid-argument', message);

export const alreadyExists = (message: string): DomainError =>
  new DomainError('already-exists', message);

export const failedPrecondition = (message: string): DomainError =>
  new DomainError('failed-precondition', message);

/**
 * O código de um erro qualquer, ou `null` quando ele não é de domínio. `null` é o que o handler
 * traduz para `internal` — um erro sem código declarado é, por definição, um que ninguém previu.
 */
export const domainErrorCode = (error: unknown): DomainErrorCode | null =>
  error instanceof DomainError ? error.code : null;
