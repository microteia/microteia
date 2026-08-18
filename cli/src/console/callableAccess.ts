/**
 * Uma callable no ar não é o mesmo que uma callable alcançável. O deploy concede a `allUsers` o papel
 * `roles/run.invoker` em cada uma, mas a concessão pode ser RECUSADA — é o que uma política de
 * Domain Restricted Sharing faz — e o `firebase deploy` termina com sucesso mesmo assim.
 *
 * O resultado é a pior forma de defeito: a aplicação abre, o login funciona, e toda chamada ao
 * servidor falha no navegador como se fosse CORS. Parece problema de front, e manda procurar no lugar
 * errado; o 403 do Cloud Run não carrega cabeçalho de CORS, e é só isso que o navegador reporta.
 *
 * Por isso a verificação é feita de fora, pelo mesmo caminho que o navegador usa: um preflight de
 * verdade contra o endpoint da região. É a única prova que vale, porque é a única que reproduz a
 * chamada que falharia.
 */

export type CallableAccess = 'reachable' | 'blocked' | 'missing' | 'unknown';

export interface CallableCheck {
  name: string;
  access: CallableAccess;
  status: number | null;
}

export interface CallableProbeOptions {
  projectId: string;
  region: string;
  origin: string;
}

const PROBE_TIMEOUT_MS = 10_000;

/** O host é por REGIÃO: fora da região do pacote, a callable simplesmente não existe neste endereço. */
export const callableEndpoint = (region: string, projectId: string, name: string): string =>
  `https://${region}-${projectId}.cloudfunctions.net/${name}`;

/**
 * Uma function de 2ª geração é um serviço do Cloud Run, e lá ela aparece com o nome em MINÚSCULAS
 * (`getUserInfo` → `getuserinfo`). Errar isso devolve "service not found", que parece indicar que a
 * function não subiu.
 */
export const invokerGrantCommand = (region: string, projectId: string, name: string): string =>
  `gcloud run services add-iam-policy-binding ${name.toLowerCase()}`
  + ` --region=${region} --project=${projectId} --member=allUsers --role=roles/run.invoker`;

/**
 * O 403 é a assinatura do IAM negando a invocação: o Cloud Run responde antes de a function existir
 * para o mundo, e sem cabeçalho de CORS. Um 2xx sem `access-control-allow-origin` não conta como
 * alcançável — é exatamente o caso em que o navegador recusa a resposta que o `curl` aceitaria.
 */
export const accessFromPreflight = (status: number, allowOrigin: string | null): CallableAccess => {
  if (status === 403) return 'blocked';
  if (status === 404) return 'missing';
  if (status >= 200 && status < 300) return allowOrigin === null ? 'unknown' : 'reachable';
  return 'unknown';
};

const probe = async (name: string, options: CallableProbeOptions): Promise<CallableCheck> => {
  try {
    const response = await fetch(callableEndpoint(options.region, options.projectId, name), {
      method: 'OPTIONS',
      headers: {
        Origin: options.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    return {
      name,
      access: accessFromPreflight(response.status, response.headers.get('access-control-allow-origin')),
      status: response.status,
    };
  } catch {
    // Rede indisponível não é veredito: quem instala pode estar atrás de proxy, e acusar bloqueio
    // aqui mandaria mexer em IAM que está correto.
    return { name, access: 'unknown', status: null };
  }
};

export const checkCallables = (
  names: string[],
  options: CallableProbeOptions,
): Promise<CallableCheck[]> => Promise.all(names.map((name) => probe(name, options)));
