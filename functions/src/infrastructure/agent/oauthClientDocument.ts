import type { OAuthClientMetadata } from '../../domain/schema/agent/agentOAuth';
import { parseClientMetadata } from '../../domain/schema/agent/agentOAuth';

/**
 * Dez segundos, que é o mesmo orçamento que o cliente dá aos NOSSOS endpoints.
 *
 * Buscar a identidade de quem está pedindo autorização não pode ser o que trava o `/authorize`: um
 * documento que não responde é um cliente que não se identifica, e a saída é recusar, não esperar.
 */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Quanto do documento se aceita ler.
 *
 * Um `client_id` é uma URL de terceiro, e buscá-la é o único momento em que este backend vai à
 * internet por ordem de quem chama. Sem teto, a URL apontada decide quanta memória a function gasta.
 */
const MAX_BYTES = 64 * 1024;

const readCapped = async (response: Response): Promise<string | null> => {
  const text = await response.text();
  return text.length > MAX_BYTES ? null : text;
};

/**
 * O documento de identidade do cliente (CIMD), buscado e conferido.
 *
 * `null` para tudo o que não for exatamente um documento válido que se identifique pela URL de onde
 * veio — e quem chama trata isso como recusa, nunca como "então siga sem saber quem é". É a
 * identidade que a pessoa lê na tela antes de autorizar: aceitar um documento que reivindica outro
 * `client_id` faria a tela dizer "Claude" para qualquer um que hospede um JSON.
 */
export const fetchClientMetadata = async (clientId: string): Promise<OAuthClientMetadata | null> => {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const body = await readCapped(response);
    if (body === null) return null;

    return parseClientMetadata(clientId, JSON.parse(body) as unknown);
  } catch {
    // Rede, tempo esgotado, JSON quebrado, redirecionamento: todos dizem a mesma coisa sobre o
    // pedido em curso — este cliente não se identificou. Distinguir os motivos aqui só ofereceria a
    // quem sonda um mapa de quais URLs o backend alcança.
    return null;
  }
};
