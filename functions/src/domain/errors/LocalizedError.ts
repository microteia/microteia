// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/errors/LocalizedError.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

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

/**
 * Os valores que a frase de um erro interpola, quando ele os tiver — de qualquer uma das DUAS
 * origens que existem.
 *
 * `LocalizedError` os carrega em `messageParams`, e é o caminho de quem lança dentro do navegador.
 * Uma callable os manda no terceiro argumento do `HttpsError`, que chega ao cliente como `details` —
 * é assim que `requirePermission` diz QUAL permissão faltou.
 *
 * A segunda origem faltava, e o efeito era silencioso: a frase chegava à tela com o próprio
 * `{permission}` cru no meio dela, porque o backend passava o valor e o front não o procurava. O
 * mecanismo já existia nas duas pontas; o que não existia era a ponte.
 *
 * Só entra o que é um mapa de valores simples. `details` é livre por contrato do Firebase, e um
 * objeto aninhado ali viraria `[object Object]` dentro de uma frase.
 */
export const errorParamsOf = (error: unknown): Record<string, string> | undefined => {
  if (error instanceof LocalizedError) return error.messageParams;

  const details = (error as { details?: unknown } | null)?.details;
  if (typeof details !== 'object' || details === null || Array.isArray(details)) return undefined;

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (typeof value === 'string') params[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') params[key] = String(value);
  }
  return Object.keys(params).length > 0 ? params : undefined;
};

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
