// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/portal.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O PORTAL — o acesso de quem é de FORA do escritório ao que é dele, e só ao que é dele.
 *
 * O convidado do portal não é membro: é outro principal, em `tenants/{t}/portalUsers/{uid}`. Por isso
 * nenhuma regra `isMember` o deixa passar, e o que ele lê é uma PROJEÇÃO (`portalRecords`) que o
 * servidor monta só com os campos que a tela declarou expor, carimbada com quem pode vê-la. A coleção
 * original nunca é lida por ele.
 *
 * O vínculo entre o convidado e os registros é declarado pela TELA, e o kernel não conhece o nome de
 * nenhuma: a tela-sujeito (`subject: 'self'`) é aquela cujos registros recebem convidados — um
 * cliente, uma empresa —; as demais chegam a ela por um campo `reference` ou pelo pai.
 */

export const PORTAL_USERS_COLLECTION = 'portalUsers';
export const PORTAL_RECORDS_COLLECTION = 'portalRecords';
export const PORTAL_DOCUMENTS_SUBCOLLECTION = 'documents';
/** Coleção de RAIZ, só do servidor: a marca do convite que precisa existir antes da conta. */
export const PORTAL_INVITES_COLLECTION = 'portalInvites';

/** Quantos saltos de referência separam um registro da tela-sujeito, no máximo. */
export const PORTAL_SUBJECT_MAX_DEPTH = 3;

/**
 * Como os registros de uma tela chegam a quem os vê.
 *
 * - `self`: a tela É o sujeito. Cada registro dela recebe convidados.
 * - `{ field }`: um campo `reference` aponta para o sujeito — ou para outra tela do portal, que leva
 *   até ele.
 * - `parent`: herda do registro-pai (`parentEntity` / `parentFieldKey`).
 */
export type PortalSubject = 'self' | 'parent' | { field: string };

export interface PortalDeclaration {
  subject: PortalSubject;
  /** Os ÚNICOS campos que saem do escritório. O que não está aqui não chega ao portal. */
  fields: string[];
  /** Expõe os documentos do registro que alguém do escritório marcou como compartilhados. */
  documents?: boolean | null;
}

/** O mínimo de uma tela que o portal precisa ler. */
export interface PortalScreenLike {
  id: string;
  /** A coleção onde os registros vivem — `dataCollection` ou o próprio id. */
  collection: string;
  titleFieldKey?: string | null;
  fields: ReadonlyArray<{ key: string; type?: string; refEntity?: string | null }>;
  parentEntity?: string | null;
  parentFieldKey?: string | null;
  portal?: PortalDeclaration | null;
}

export const portalSubjectKey = (collection: string, recordId: string): string => `${collection}/${recordId}`;

export const parsePortalSubjectKey = (key: string): { collection: string; recordId: string } | null => {
  const slash = key.indexOf('/');
  if (slash <= 0 || slash === key.length - 1 || key.indexOf('/', slash + 1) !== -1) return null;
  return { collection: key.slice(0, slash), recordId: key.slice(slash + 1) };
};

export const portalRecordDocId = (collection: string, recordId: string): string => `${collection}__${recordId}`;

export const normalizePortalEmail = (email: string): string => email.trim().toLowerCase();

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * A declaração solta, lida com desconfiança. Malformada é AUSENTE: um portal que não sabe a quem
 * entregar não entrega a ninguém.
 */
export const asPortalDeclaration = (value: unknown): PortalDeclaration | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  let subject: PortalSubject | null = null;
  if (raw.subject === 'self' || raw.subject === 'parent') subject = raw.subject;
  else if (raw.subject && typeof raw.subject === 'object' && isNonEmptyString((raw.subject as Record<string, unknown>).field)) {
    subject = { field: ((raw.subject as Record<string, unknown>).field as string).trim() };
  }
  if (!subject) return null;

  const fields = Array.isArray(raw.fields)
    ? [...new Set(raw.fields.filter(isNonEmptyString).map((key) => key.trim()))]
    : [];

  return { subject, fields, documents: raw.documents === true };
};

export const isPortalSubjectScreen = (screen: PortalScreenLike): boolean => screen.portal?.subject === 'self';

/** Os campos expostos que a tela de fato declara — a declaração que ficou para trás não vaza nada. */
export const portalFieldKeys = (screen: PortalScreenLike): string[] => {
  const declared = new Set(screen.fields.map((field) => field.key));
  return (screen.portal?.fields ?? []).filter((key) => declared.has(key));
};

/** Só os campos expostos. É a única porta por onde dado do registro sai para o portal. */
export const projectPortalData = (
  screen: PortalScreenLike,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const projected: Record<string, unknown> = {};
  for (const key of portalFieldKeys(screen)) {
    if (data[key] !== undefined) projected[key] = data[key];
  }
  return projected;
};

/** O id gravado num campo `reference` — um só, ou a lista dos marcados. */
export const referencedIds = (value: unknown): string[] => {
  if (isNonEmptyString(value)) return [value];
  if (Array.isArray(value)) return value.filter(isNonEmptyString);
  return [];
};

export interface PortalSubjectDeps {
  /** A tela do portal declarada por esta chave de entidade (`refEntity`, `parentEntity`). */
  screenFor: (entityKey: string) => PortalScreenLike | undefined;
  getRecord: (collection: string, recordId: string) => Promise<Record<string, unknown> | undefined>;
}

/**
 * As chaves de sujeito (`colecao/id`) a que um registro pertence.
 *
 * Segue a corrente declarada até a tela-sujeito: a nota aponta para a empresa (`self`); o prazo
 * aponta para o processo, que aponta para o cliente. Uma tela no caminho que não declare portal
 * corta a corrente — e o registro fica sem sujeito, que é a resposta fechada.
 */
export const resolvePortalSubjectKeys = async (
  screen: PortalScreenLike,
  recordId: string,
  data: Record<string, unknown>,
  deps: PortalSubjectDeps,
  depth = 0,
): Promise<string[]> => {
  const subject = screen.portal?.subject;
  if (!subject) return [];
  if (subject === 'self') return [portalSubjectKey(screen.collection, recordId)];
  if (depth >= PORTAL_SUBJECT_MAX_DEPTH) return [];

  let entityKey: string | null | undefined;
  let ids: string[];
  if (subject === 'parent') {
    entityKey = screen.parentEntity;
    ids = screen.parentFieldKey ? referencedIds(data[screen.parentFieldKey]) : [];
  } else {
    const field = screen.fields.find((one) => one.key === subject.field);
    entityKey = field?.type === 'reference' ? field.refEntity : null;
    ids = field ? referencedIds(data[field.key]) : [];
  }
  if (!entityKey || ids.length === 0) return [];

  const target = deps.screenFor(entityKey);
  if (!target?.portal) return [];
  if (target.portal.subject === 'self') return ids.map((id) => portalSubjectKey(target.collection, id));

  const keys = new Set<string>();
  for (const id of ids) {
    const parent = await deps.getRecord(target.collection, id);
    if (!parent) continue;
    for (const key of await resolvePortalSubjectKeys(target, id, parent, deps, depth + 1)) keys.add(key);
  }
  return [...keys];
};

/** O campo de título do registro, como texto — o que a lista do portal mostra. */
export const portalRecordTitle = (screen: PortalScreenLike, data: Record<string, unknown>): string => {
  const value = screen.titleFieldKey ? data[screen.titleFieldKey] : undefined;
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
};
