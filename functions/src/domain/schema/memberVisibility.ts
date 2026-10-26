// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/memberVisibility.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * VISIBILIDADE POR REGISTRO — o membro que só lê o registro que o nomeia.
 *
 * O RBAC do produto responde por COLEÇÃO: quem tem `<coleção>.read` lê todos os registros dela. Há
 * caso em que isso é demais — a resposta sigilosa que só o servidor emissor lê, o atendimento
 * "atribuído a", o prontuário do paciente de um médico. A tela DECLARA:
 *
 *   memberVisibility: { userFields: ['emissor', 'responsavel'], bypassPermission?: 'x.supervise' }
 *
 * e um membro passa a ler um registro só quando o próprio uid está num desses campos (referência a
 * membro, simples ou `multi`), ou quando tem a permissão de supervisão. Sem `bypassPermission`, a
 * supervisão é a permissão DERIVADA `<coleção>.read-all`, que o catálogo oferece sozinho na tela de
 * Perfis. O dono do escritório e o `SYSTEM` leem tudo, pelas razões de `can()`.
 *
 * Vale em três pontas, todas lendo a declaração do documento `screenDefinitions/<coleção>`:
 *
 * 1. o `firestore.rules` (e o `storage.rules`, para os arquivos) recusa a leitura, a alteração e a
 *    exclusão do registro que não nomeia quem pede — é a garantia, e a única que alcança quem lê direto
 *    do banco;
 * 2. o front acrescenta o filtro à assinatura da coleção (`memberVisibilityClauses`), porque a regra
 *    não é filtro: uma consulta sem ele seria recusada INTEIRA;
 * 3. o servidor filtra nas portas que entregam o registro a uma PESSOA — agente (MCP), relatório,
 *    geração de documento —, pelo `RecordReader` que cada uma monta. A automação lê como o escritório.
 *
 * As funções daqui espelham a regra linha a linha, inclusive no que ela faz com a declaração
 * malformada: FECHA para quem não supervisiona.
 */

import type { SchemaContext } from './screenEntity';
import { isValidAccessPermissionId } from './access/permission';

/**
 * O kernel a partir do qual `memberVisibility` é lido. Um kernel anterior DESCARTA a chave ao
 * materializar a tela, e o registro que a extensão quis restringir seria lido por todo membro com a
 * permissão da coleção, sem aviso. Por isso o pacote que a declara tem de exigir este kernel.
 */
export const MEMBER_VISIBILITY_SINCE_KERNEL = '2.75.0';

/**
 * Quantos campos uma declaração nomeia. A linguagem das regras não tem laço, e a regra lê os campos
 * por POSIÇÃO — este é o número de posições que ela lê. Um quinto campo nunca seria consultado.
 */
export const MEMBER_VISIBILITY_MAX_FIELDS = 4;

/** A ação da permissão de supervisão derivada: `<coleção>.read-all`. */
export const READ_ALL_ACTION = 'read-all';

/** A entidade cujo id É o uid do membro — `tenants/{t}/members/{uid}`. */
export const MEMBER_REFERENCE_ENTITY = 'members';

/** O curinga do conjunto efetivo de quem não tem limite: o dono do escritório e o `SYSTEM`. */
const UNRESTRICTED = '*';

export interface MemberVisibilitySpec {
  /** Campos de referência a membro (simples ou `multi`) que nomeiam quem lê. Até quatro. */
  userFields: string[];
  /** Quem lê todos. Ausente = a permissão derivada `<coleção>.read-all`. */
  bypassPermission?: string | null;
}

/**
 * A PESSOA a quem uma leitura do servidor é entregue: o uid e o conjunto EFETIVO de permissões dela
 * (`*` para o dono e o `SYSTEM`). Ausente numa leitura, quem lê é o próprio escritório — a automação.
 */
export interface RecordReader {
  uid: string;
  permissions: readonly string[];
}

/** A restrição de uma assinatura do cliente: quem lê, e a declaração que o restringe. */
export interface MemberVisibilityFilter {
  uid: string;
  spec: MemberVisibilitySpec;
}

/** Um termo do filtro que a consulta do cliente acrescenta: um por campo e por forma de gravação. */
export interface MemberVisibilityClause {
  field: string;
  op: '==' | 'array-contains';
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readAllPermissionId = (collection: string): string => `${collection}.${READ_ALL_ACTION}`;

/**
 * A declaração como a REGRA a enxerga. Ausente → `null` (sem restrição). Malformada → restrita a
 * ninguém além de quem supervisiona: um `userFields` que não é lista não nomeia membro nenhum, e só as
 * quatro primeiras posições contam, cada uma só se for texto. É exatamente o que a regra faz.
 */
export const readMemberVisibility = (value: unknown): MemberVisibilitySpec | null => {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) return { userFields: [] };
  const fields = Array.isArray(value.userFields) ? value.userFields.slice(0, MEMBER_VISIBILITY_MAX_FIELDS) : [];
  const bypass = value.bypassPermission;
  return {
    userFields: fields.filter((field): field is string => typeof field === 'string'),
    ...(typeof bypass === 'string' ? { bypassPermission: bypass } : {}),
  };
};

/** A permissão que lê todos: a declarada, ou a derivada da coleção. */
export const memberVisibilityBypass = (spec: MemberVisibilitySpec, collection: string): string =>
  spec.bypassPermission ?? readAllPermissionId(collection);

/** A declaração não nomeia permissão de supervisão — o catálogo deriva `<coleção>.read-all`. */
export const derivesReadAllPermission = (value: unknown): boolean => {
  const spec = readMemberVisibility(value);
  return spec !== null && spec.bypassPermission === undefined;
};

/** Quem lê todos os registros da coleção, sem precisar ser nomeado. */
export const readerSeesAll = (
  spec: MemberVisibilitySpec,
  collection: string,
  permissions: readonly string[],
): boolean => permissions.includes(UNRESTRICTED) || permissions.includes(memberVisibilityBypass(spec, collection));

/**
 * O registro nomeia o membro num dos campos: o uid gravado no campo simples, ou contido no `multi`.
 * Só no campo de PRIMEIRO nível, como a regra lê (`data.get(campo)`).
 */
export const recordNamesMember = (
  record: Record<string, unknown>,
  spec: MemberVisibilitySpec,
  uid: string,
): boolean =>
  uid !== '' && spec.userFields.some((field) => {
    const value = record[field];
    return value === uid || (Array.isArray(value) && value.includes(uid));
  });

/**
 * A resposta inteira: sem declaração, sem pessoa (a automação) ou com a supervisão, lê; do contrário,
 * só o registro que a nomeia.
 */
export const readerSeesRecord = (
  spec: MemberVisibilitySpec | null,
  collection: string,
  reader: RecordReader | null | undefined,
  record: Record<string, unknown>,
): boolean =>
  spec === null
  || !reader
  || readerSeesAll(spec, collection, reader.permissions)
  || recordNamesMember(record, spec, reader.uid);

/**
 * A restrição que vale para o LEITOR nesta coleção, ou `null` quando ele lê tudo. É a pergunta que o
 * front e o servidor fazem antes de consultar: com `null`, a consulta segue como sempre.
 */
export const readerRestriction = (
  spec: MemberVisibilitySpec | null,
  collection: string,
  reader: RecordReader | null | undefined,
): MemberVisibilitySpec | null =>
  spec === null || !reader || readerSeesAll(spec, collection, reader.permissions) ? null : spec;

/** O filtro da assinatura do cliente para este leitor, ou `null` quando ele lê a coleção inteira. */
export const memberVisibilityFilter = (
  spec: MemberVisibilitySpec | null,
  collection: string,
  reader: RecordReader | null | undefined,
): MemberVisibilityFilter | null => {
  const restriction = readerRestriction(spec, collection, reader);
  return restriction && reader ? { uid: reader.uid, spec: restriction } : null;
};

/** A declaração da coleção no schema — a do documento que a regra lê (`withRuleDeclarations`). */
export const resolveMemberVisibility = (ctx: SchemaContext, collection: string): MemberVisibilitySpec | null =>
  ctx.screens.get(collection)?.memberVisibility ?? null;

/**
 * Os termos do filtro, um `==` e um `array-contains` por campo.
 *
 * Os dois, e não o que o campo declara hoje: um campo que passou de simples a `multi` no Form Design
 * guarda texto nos registros antigos e lista nos novos, e a consulta precisa achar os dois. Cada termo
 * é uma disjunção do `or()`, e cada disjunção é provada por um termo da regra — o `==` pelo campo
 * simples, o `array-contains` pelo `hasAny` do `multi`. Nenhum pede índice composto.
 */
export const memberVisibilityClauses = (spec: MemberVisibilitySpec): MemberVisibilityClause[] =>
  spec.userFields.flatMap((field) => [
    { field, op: '==' as const },
    { field, op: 'array-contains' as const },
  ]);

/** O campo pode nomear um membro: referência à entidade cujo id é o uid. */
export const isMemberReferenceField = (field: { type?: unknown; refEntity?: unknown }): boolean =>
  field.type === 'reference' && field.refEntity === MEMBER_REFERENCE_ENTITY;

export type MemberVisibilityIssueCode =
  | 'shape'
  | 'fields-empty'
  | 'fields-too-many'
  | 'field-duplicate'
  | 'field-unknown'
  | 'field-not-member'
  | 'bypass-invalid';

export interface MemberVisibilityIssue {
  code: MemberVisibilityIssueCode;
  /** O campo ou a permissão de que o defeito fala, quando ele fala de um. */
  subject?: string;
}

/**
 * Os defeitos de uma declaração contra os campos da tela — o que o `check` do pacote e o Form Design
 * cobram antes de gravar. Vazio = válida.
 */
export const memberVisibilityIssues = (
  value: unknown,
  fields: readonly { key: string; type?: unknown; refEntity?: unknown }[],
): MemberVisibilityIssue[] => {
  if (!isPlainObject(value) || !Array.isArray(value.userFields)) return [{ code: 'shape' }];
  const issues: MemberVisibilityIssue[] = [];
  const declared = value.userFields;
  if (declared.length === 0) issues.push({ code: 'fields-empty' });
  if (declared.length > MEMBER_VISIBILITY_MAX_FIELDS) issues.push({ code: 'fields-too-many' });

  const byKey = new Map(fields.map((field) => [field.key, field]));
  const seen = new Set<string>();
  for (const key of declared) {
    if (typeof key !== 'string' || key.trim() === '') {
      issues.push({ code: 'shape' });
      continue;
    }
    if (seen.has(key)) issues.push({ code: 'field-duplicate', subject: key });
    seen.add(key);
    const field = byKey.get(key);
    if (!field) issues.push({ code: 'field-unknown', subject: key });
    else if (!isMemberReferenceField(field)) issues.push({ code: 'field-not-member', subject: key });
  }

  const bypass = value.bypassPermission;
  if (bypass !== undefined && bypass !== null && (typeof bypass !== 'string' || !isValidAccessPermissionId(bypass))) {
    issues.push({ code: 'bypass-invalid', subject: typeof bypass === 'string' ? bypass : '' });
  }
  return issues;
};
