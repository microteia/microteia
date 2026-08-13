import type { MessageCatalog, MessageParams } from './messages';
import { translate } from './messages';

/**
 * A REFERÊNCIA de mensagem dentro de um rótulo declarativo.
 *
 * Uma extensão embarca `titleSingular: 'Processo'` — texto cru, gravado no escritório na instalação.
 * Para traduzir isso sem inventar um campo paralelo em cada tipo de template, qualquer rótulo passa a
 * aceitar uma referência: `'@com.microteia.processo/screen.title'`.
 *
 * A regra única resolve os DOIS lados do problema de uma vez:
 *
 * - o que a EXTENSÃO declara começa com `@` e traduz;
 * - o que o ESCRITÓRIO digitou no Form Design ("Contrato de Locação") não começa com `@` e volta
 *   literal, intocado.
 *
 * Sem isso seria preciso um `titleSingularKey` ao lado de cada `titleSingular`, em telas, campos,
 * listas, ações, widgets e configurações — dobrando o contrato inteiro para resolver metade dele.
 */
export const MESSAGE_REF_SIGIL = '@';

const REF_PATTERN = /^@([a-z0-9][a-z0-9.-]*)\/([a-z0-9][a-z0-9.-]*)$/i;

export const isMessageRef = (value: unknown): boolean =>
  typeof value === 'string' && REF_PATTERN.test(value);

export interface ParsedMessageRef {
  namespace: string;
  key: string;
  /** A chave plena, como o catálogo a indexa. */
  full: string;
}

export const parseMessageRef = (value: unknown): ParsedMessageRef | null => {
  if (typeof value !== 'string') return null;
  const match = REF_PATTERN.exec(value);
  if (!match) return null;
  return { namespace: match[1], key: match[2], full: `${match[1]}/${match[2]}` };
};

/**
 * Resolve um rótulo declarativo. Texto comum passa intacto; referência vira tradução; referência cuja
 * chave não existe volta ao TEXTO CRU da referência, e não a vazio — o mesmo princípio de `translate`.
 *
 * Um `@` no meio da frase ("suporte@microteia.app") não é referência: o padrão exige o `@` na
 * primeira posição e a barra separando namespace e chave.
 */
export const resolveLabel = (
  catalog: MessageCatalog,
  value: string | null | undefined,
  params?: MessageParams,
): string => {
  if (value === null || value === undefined) return '';
  const ref = parseMessageRef(value);
  if (!ref) return value;
  return translate(catalog, ref.full, params);
};

/** A versão para campo opcional: preserva `null`/`undefined` em vez de virar string vazia. */
export const resolveOptionalLabel = (
  catalog: MessageCatalog,
  value: string | null | undefined,
): string | null | undefined => {
  if (value === null || value === undefined) return value;
  return resolveLabel(catalog, value);
};
