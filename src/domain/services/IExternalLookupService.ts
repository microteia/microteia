export interface ExternalLookupResult {
  ok: boolean;
  values: Record<string, unknown>;
  error?: string;
}

/**
 * Busca de dados numa fonte externa para preencher campos do formulário. É a contraparte assíncrona
 * do `logic.onChange`, que é síncrono por ser expressão.
 *
 * O contrato devolve um objeto plano de chave → valor, mesclado no formulário pelo mesmo caminho do
 * `onChange` síncrono. Erro nunca lança: devolve `ok: false` com a mensagem, para que uma busca
 * falha não trave o preenchimento manual.
 */
export interface IExternalLookupService {
  readonly key: string;
  readonly label: string;
  // Descreve o que o provedor devolve — usado na UI de autoria para orientar o `targetPrefix`.
  readonly outputKeys: string[];
  lookup: (input: string) => Promise<ExternalLookupResult>;
}
