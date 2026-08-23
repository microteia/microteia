// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/permissionPattern.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import { UNRESTRICTED_PERMISSION } from './memberPermissions';

/**
 * O PADRÃO que `hasPermission(...)` aceita, e por que ele existe.
 *
 * Escrever o identificador cru (`pet1.delete`) prende a declaração a uma tela. Uma ação que serve a
 * qualquer cadastro precisa perguntar pela permissão DA TELA EM QUE ESTÁ, e uma que serve a um
 * conjunto delas precisa dizer isso sem listar cada uma.
 *
 * | Padrão | Casa com |
 * |---|---|
 * | `pet1.delete` | exatamente `pet1.delete` |
 * | `<entity>.delete` | a exclusão da tela em que a expressão está sendo avaliada |
 * | `*.delete` | a exclusão de QUALQUER recurso |
 * | `pet1.*` | qualquer ação sobre `pet1` |
 * | `pet%.delete` | a exclusão de todo recurso começando por `pet` |
 *
 * Os curingas nunca atravessam o ponto: `*` é UM segmento inteiro e `%` é um pedaço DENTRO de um
 * segmento. Sem esse limite, `*` casaria `a.b` com `a` e a intenção do padrão deixaria de ser legível.
 *
 * O casamento é sensível a maiúsculas, e é de propósito: `Pet1` e `pet1` são coleções DIFERENTES no
 * Firestore, e casá-las concederia acesso de uma pela outra. Quem precisa acertar o identificador o
 * encontra escrito ao lado de cada permissão na tela de perfis.
 */
export const ENTITY_PLACEHOLDER = '<entity>';

const SEGMENT_ANY = '[^.]+';
const SEGMENT_LIKE = '[^.]*';

const escapeLiteral = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const segmentToRegex = (segment: string): string => {
  if (segment === '*') return SEGMENT_ANY;
  if (!segment.includes('%')) return escapeLiteral(segment);
  return segment.split('%').map(escapeLiteral).join(SEGMENT_LIKE);
};

const hasWildcard = (pattern: string): boolean => pattern.includes('*') || pattern.includes('%');

/**
 * Troca `<entity>` pela entidade do contexto. Sem entidade, o padrão fica sem resposta possível — e
 * devolver `null` faz `hasPermission` responder NÃO, em vez de casar com qualquer coisa.
 */
const resolveEntity = (pattern: string, entity: string): string | null => {
  if (!pattern.includes(ENTITY_PLACEHOLDER)) return pattern;
  if (!entity) return null;
  return pattern.split(ENTITY_PLACEHOLDER).join(entity);
};

/**
 * O padrão casa com ALGUMA das permissões concedidas?
 *
 * O curinga do dono do escritório (`*` sozinho no conjunto CONCEDIDO) responde sim a tudo — ele não
 * é padrão, é a ausência de limite.
 */
export const matchesPermission = (
  granted: readonly string[],
  pattern: string,
  entity = '',
): boolean => {
  const resolved = resolveEntity(pattern.trim(), entity.trim());
  if (resolved === null || resolved === '') return false;
  if (granted.includes(UNRESTRICTED_PERMISSION)) return true;
  if (!hasWildcard(resolved)) return granted.includes(resolved);

  const source = `^${resolved.split('.').map(segmentToRegex).join('\\.')}$`;
  const matcher = new RegExp(source);
  return granted.some((permission) => matcher.test(permission));
};
