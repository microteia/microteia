/**
 * Um erro cuja mensagem é uma REFERÊNCIA (`@core.records/screen.delete.system`) em vez da frase.
 *
 * Existe porque `Error.message` é uma string e não tem onde carregar os valores que a frase
 * interpola — e o domínio, que lança o erro, não conhece o idioma de quem vai lê-lo. Quem exibe
 * resolve os dois com `useLabel()`; quem só registra em log guarda a chave, que identifica a causa.
 */
export class LocalizedError extends Error {
  readonly messageParams?: Record<string, string>;

  constructor(
    message: string,
    messageParams?: Record<string, string>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'LocalizedError';
    this.messageParams = messageParams;
  }
}

/** Os valores de interpolação de um erro, quando ele os tiver. */
export const errorParamsOf = (error: unknown): Record<string, string> | undefined =>
  error instanceof LocalizedError ? error.messageParams : undefined;

/**
 * Os parâmetros de uma frase que EMBRULHA um erro: o `{detail}` mais o que a frase de DENTRO
 * interpola.
 *
 * `errorParamsOf` sozinho não bastava. Quem embrulha um erro numa frase sua — "Não foi possível
 * concluir a operação: {detail}" — lembrava de passar o `{detail}` e esquecia os irmãos, e a recusa
 * chegava à tela com os próprios `{kind}`, `{id}` e `{plugin}` crus no meio dela: o motor de idioma
 * desce para a mensagem aninhada apenas os parâmetros que a de fora recebeu. Os dois saem juntos
 * daqui para que esquecer um deixe de ser possível.
 *
 * Erro que não é `LocalizedError` continua funcionando: não há parâmetro nenhum para descer, e o
 * `{detail}` fica com a mensagem dele — ou com `fallbackDetail`, quando o que foi lançado não é nem
 * um `Error`.
 */
export const wrappedErrorParams = (
  error: unknown,
  fallbackDetail?: string,
): Record<string, string> => ({
  ...errorParamsOf(error),
  detail: error instanceof Error ? error.message : (fallbackDetail ?? String(error)),
});
