import { UNRESTRICTED_PERMISSION } from '../access/memberPermissions';

/**
 * A coleção dos acessos de agente. Reservada, como toda coleção que o kernel serve por regra
 * nomeada — ela não pode ser reivindicada por uma tela.
 */
export const AGENT_GRANTS_COLLECTION = 'agentGrants';

/**
 * O prefixo existe para que um segredo colado no lugar errado seja RECONHECÍVEL — por quem revisa um
 * log, e por um varredor de segredo em repositório. Um token que se parece com qualquer texto é um
 * token que ninguém percebe ter vazado.
 */
export const AGENT_TOKEN_PREFIX = 'mt_';

/**
 * 43 caracteres de um alfabeto de 64 são 258 bits. O alfabeto tem 64 símbolos de propósito: 64 divide
 * 256, então `byte & 63` é uniforme e o sorteio não precisa de rejeição para ficar sem viés.
 */
export const AGENT_SECRET_LENGTH = 43;
const SECRET_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * O que o Firestore guarda de um acesso de agente.
 *
 * O segredo NÃO está aqui, e nem em subcoleção: só o hash dele. É a diferença em relação à chave de
 * `aiConnections`, e ela é a favor — aquela precisa ser lida pelo servidor para chamar o provedor, e
 * esta nunca precisa ser lida por ninguém. Não havendo o que ler, não há como vazar.
 */
export interface AgentGrant {
  id: string;
  tenantId: string;
  /** De quem é o acesso. É o conjunto DELE que limita o do agente, a cada chamada. */
  userId: string;
  name: string;
  /**
   * O TETO que este acesso declara, em ids do catálogo que o escritório já tem.
   *
   * Não é o que o agente pode: é o que ele pode NO MÁXIMO. O que vale é a interseção com o conjunto
   * do usuário, recalculada a cada chamada — ver `effectiveAgentPermissions`.
   */
  permissions: string[];
  secretHash: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  createdBy: string;
}

export interface ParsedAgentToken {
  tenantId: string;
  grantId: string;
  secret: string;
}

/**
 * Um identificador do Firestore, e nada além disso.
 *
 * O ponto é o separador do token, então um segmento que o contenha tornaria o parse ambíguo — e um
 * parse ambíguo de credencial é o caminho para dois tokens diferentes casarem com o mesmo registro.
 */
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SECRET_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${AGENT_SECRET_LENGTH}}$`);

/**
 * O escritório viaja DENTRO do token, e é por isso que achar o acesso é uma leitura pontual em vez de
 * uma consulta por hash sobre todos os escritórios do projeto.
 *
 * Não é vazamento: quem tem o token é o dono dele, e ele já sabe de que escritório é. É o mesmo
 * arranjo de um token de Slack, que carrega o time, ou de uma chave de Stripe, que carrega o modo.
 */
export const buildAgentToken = (parsed: ParsedAgentToken): string | null => {
  if (!SEGMENT_PATTERN.test(parsed.tenantId)) return null;
  if (!SEGMENT_PATTERN.test(parsed.grantId)) return null;
  if (!SECRET_PATTERN.test(parsed.secret)) return null;
  return `${AGENT_TOKEN_PREFIX}${parsed.tenantId}.${parsed.grantId}.${parsed.secret}`;
};

/**
 * `null` para tudo o que não é exatamente um token nosso — e o chamador trata isso como recusa, nunca
 * como "então procure de outro jeito".
 */
export const parseAgentToken = (raw: unknown): ParsedAgentToken | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(AGENT_TOKEN_PREFIX)) return null;

  const parts = trimmed.slice(AGENT_TOKEN_PREFIX.length).split('.');
  if (parts.length !== 3) return null;

  const [tenantId, grantId, secret] = parts;
  if (!SEGMENT_PATTERN.test(tenantId)) return null;
  if (!SEGMENT_PATTERN.test(grantId)) return null;
  if (!SECRET_PATTERN.test(secret)) return null;

  return { tenantId, grantId, secret };
};

/**
 * Web Crypto, e não `node:crypto`: este arquivo é sincronizado para as functions E entra no bundle do
 * navegador, e `crypto.subtle` é o único SHA-256 que existe nos dois. O navegador não chama isto hoje
 * — só a callable que emite e o gateway que confere —, mas um módulo de domínio que só compila num
 * dos dois lados é uma armadilha esperando o primeiro import.
 */
export const hashAgentSecret = async (secret: string): Promise<string> => {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** Sorteia o segredo. Só quem EMITE chama isto, e emitir é sempre no servidor. */
export const generateAgentSecret = (): string => {
  const bytes = new Uint8Array(AGENT_SECRET_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => SECRET_ALPHABET[byte & 63]).join('');
};

/**
 * Comparação em tempo constante.
 *
 * Comparar hash com `===` deixa vazar, pelo tempo, quantos caracteres iniciais casaram — e um hash é
 * exatamente o valor que um atacante pode ir refinando. O custo aqui é uma varredura de 64 caracteres.
 */
export const secretHashMatches = (expected: string, actual: string): boolean => {
  if (expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
};

/**
 * Por que o acesso não vale — ou `null` quando ele vale.
 *
 * Devolve o MOTIVO e não um booleano porque quem chama precisa dizer ao agente o que corrigir:
 * "expirado" pede um token novo, "revogado" pede falar com quem revogou, e os dois são muito
 * diferentes de "não existe".
 */
export type AgentGrantRefusal = 'revoked' | 'expired';

export const grantRefusal = (
  grant: Pick<AgentGrant, 'revokedAt' | 'expiresAt'>,
  now: Date,
): AgentGrantRefusal | null => {
  if (grant.revokedAt !== null) return 'revoked';
  if (grant.expiresAt !== null && grant.expiresAt.getTime() <= now.getTime()) return 'expired';
  return null;
};

/**
 * O que o agente PODE: a interseção do que o usuário tem com o teto que o acesso declara.
 *
 * Duas propriedades saem daqui, e são elas que dispensam um segundo modelo de autorização:
 *
 * - um acesso de agente **nunca** excede o do usuário que o emitiu, mesmo que o teto peça mais —
 *   então emitir um acesso para si mesmo não concede nada de novo, e não precisa de permissão;
 * - tirar o perfil do usuário estreita o agente na chamada seguinte, sem tocar no token.
 *
 * O curinga do dono (`*` no conjunto CONCEDIDO) é a AUSÊNCIA de limite, não uma permissão — então ele
 * interseca para exatamente o teto declarado. Sem este caso, o dono do escritório receberia acesso
 * irrestrito em todo token que emitisse, que é o oposto de declarar um teto.
 *
 * O curinga do LADO do teto é recusado na emissão, e não aqui: um teto irrestrito é uma decisão de
 * quem emite, não um detalhe de resolução.
 */
export const effectiveAgentPermissions = (
  granted: readonly string[],
  ceiling: readonly string[],
): string[] => {
  const declared = [...new Set(ceiling)].filter((permission) => permission !== UNRESTRICTED_PERMISSION);
  if (granted.includes(UNRESTRICTED_PERMISSION)) return declared.sort();
  const held = new Set(granted);
  return declared.filter((permission) => held.has(permission)).sort();
};
