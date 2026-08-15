/**
 * Um erro cuja mensagem é uma REFERÊNCIA (`@core.records/screen.delete.system`) em vez da frase.
 *
 * Existe porque `Error.message` é uma string e não tem onde carregar os valores que a frase
 * interpola — e o domínio, que lança o erro, não conhece o idioma de quem vai lê-lo. Quem exibe
 * resolve os dois com `useLabel()`; quem só registra em log guarda a chave, que identifica a causa.
 */
export class LocalizedError extends Error {
  readonly messageParams?: Record<string, string>;

  constructor(message: string, messageParams?: Record<string, string>) {
    super(message);
    this.name = 'LocalizedError';
    this.messageParams = messageParams;
  }
}

/** Os valores de interpolação de um erro, quando ele os tiver. */
export const errorParamsOf = (error: unknown): Record<string, string> | undefined =>
  error instanceof LocalizedError ? error.messageParams : undefined;
