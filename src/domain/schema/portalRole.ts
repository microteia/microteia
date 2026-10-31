/**
 * O PAPEL do convidado num registro do portal (EV-38) — o sócio e o contador da mesma empresa, o
 * síndico e o morador do mesmo condomínio.
 *
 * O papel é do VÍNCULO, e não da pessoa: quem é sócio de uma empresa pode ser contador de outra. Por
 * isso ele mora ao lado de cada sujeito do convite (`subjectRoles`), e o que as expressões leem é o
 * papel do convidado nos sujeitos DO REGISTRO em questão — nunca um papel solto.
 *
 * O kernel não conhece papel nenhum: é uma chave que quem convida escreve e que a condição da tela
 * compara. Sem papel, nada muda — o convidado sem papel tem exatamente o poder que sempre teve.
 */

import type { PortalVerifiedIdentity } from './portalIdentity';

/**
 * O kernel a partir do qual o convite guarda o papel (`role`) e `portal.create.when` é lido. Um kernel
 * anterior DESCARTA as duas coisas — e o `create` sem condição deixa TODO convidado criar. Por isso o
 * pacote que as usa tem de exigir este kernel.
 */
export const PORTAL_ROLES_SINCE_KERNEL = '2.89.0';

export const PORTAL_ROLE_MAX_LENGTH = 40;

/**
 * O papel é CHAVE, não rótulo: é o que uma expressão compara com `==`, e a chave com acento, espaço ou
 * maiúscula de um lado e não do outro seria a condição que nunca vale, sem erro nenhum. Quem precisa de
 * um nome para mostrar usa o catálogo.
 */
const PORTAL_ROLE_PATTERN = new RegExp(`^[a-z0-9][a-z0-9_.-]{0,${PORTAL_ROLE_MAX_LENGTH - 1}}$`);

export const isValidPortalRole = (role: string): boolean => PORTAL_ROLE_PATTERN.test(role);

/**
 * O papel pedido num convite. Ausente (ou vazio) é `null`: o convite não mexe no papel. Qualquer outra
 * coisa que não seja uma chave válida é `false` — recusa, nunca um convite sem o papel que se pediu.
 */
export const readPortalRoleInput = (value: unknown): string | null | false => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return false;
  const role = value.trim();
  if (role === '') return null;
  return isValidPortalRole(role) ? role : false;
};

/** O papel de um convidado num sujeito do convite. */
export interface PortalSubjectRole {
  subjectKey: string;
  role: string;
}

/**
 * Os papéis gravados, lidos com desconfiança. É uma LISTA, e não um mapa por sujeito: a chave do sujeito
 * tem `/`, que o Firestore não aceita num caminho de campo — e o convite por identidade soma convites, em
 * que o mesmo sujeito pode chegar com dois papéis.
 */
export const readPortalSubjectRoles = (value: unknown): PortalSubjectRole[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry): PortalSubjectRole[] => {
    if (!entry || typeof entry !== 'object') return [];
    const { subjectKey, role } = entry as Record<string, unknown>;
    if (typeof subjectKey !== 'string' || subjectKey === '' || typeof role !== 'string' || !isValidPortalRole(role)) return [];
    const key = `${subjectKey}\n${role}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ subjectKey, role }];
  });
};

/** O papel de um sujeito trocado — num convite, o sujeito tem UM papel, o último que se pediu. */
export const withPortalSubjectRole = (
  roles: readonly PortalSubjectRole[],
  subjectKey: string,
  role: string,
): PortalSubjectRole[] => [...roles.filter((entry) => entry.subjectKey !== subjectKey), { subjectKey, role }];

/** Os papéis sem os do sujeito revogado — ou sem nenhum, com `null` (o convite inteiro). */
export const withoutPortalSubjectRoles = (
  roles: readonly PortalSubjectRole[],
  subjectKey: string | null,
): PortalSubjectRole[] => (subjectKey === null ? [] : roles.filter((entry) => entry.subjectKey !== subjectKey));

/** O papel que o convite já dá a este sujeito — `null` sem papel. */
export const portalSubjectRoleOf = (roles: readonly PortalSubjectRole[], subjectKey: string): string | null =>
  roles.find((entry) => entry.subjectKey === subjectKey)?.role ?? null;

/**
 * A soma dos papéis de vários convites (o convite por identidade aceito pela mesma conta), só dos
 * sujeitos que a conta de fato recebe. Ordenada: gravar a mesma soma duas vezes grava a mesma lista.
 */
export const mergePortalSubjectRoles = (
  lists: ReadonlyArray<readonly PortalSubjectRole[]>,
  subjectKeys: readonly string[],
): PortalSubjectRole[] => {
  const granted = new Set(subjectKeys);
  return readPortalSubjectRoles(lists.flat().filter((entry) => granted.has(entry.subjectKey)))
    .sort((a, b) => a.subjectKey.localeCompare(b.subjectKey) || a.role.localeCompare(b.role));
};

/**
 * Os papéis do convidado NUM registro: os dos sujeitos do registro que também estão no convite dele.
 * O registro de dois sujeitos — a nota de duas empresas — dá os papéis das duas: é uma lista, e a
 * condição pergunta `"socio" in actor.portalRoles`. Escolher um seria responder ao acaso.
 */
export const portalRolesOn = (
  guest: { subjectKeys: readonly string[]; subjectRoles?: readonly PortalSubjectRole[] },
  recordSubjectKeys: readonly string[],
): string[] => {
  const relevant = new Set(recordSubjectKeys.filter((key) => guest.subjectKeys.includes(key)));
  return [...new Set((guest.subjectRoles ?? []).filter((entry) => relevant.has(entry.subjectKey)).map((entry) => entry.role))].sort();
};

/** O nome com que o convidado aparece nas condições da tela avaliadas pelo servidor. */
export const PORTAL_ACTOR_VARIABLE = 'actor';

/**
 * O convidado como as condições do portal o leem (`actor.portalRoles`, `actor.verified`): quem é, o
 * que provou ao entrar e os papéis dele NO registro em questão. Permissão, nenhuma — ele não é membro.
 *
 * Não atravessa para a automação: o papel é ACESSO, como as permissões, e envelhece — a mesma razão
 * por que o ator remontado do barramento chega com `permissions: []`.
 */
export interface PortalGuestActor {
  id: string;
  via: 'portal';
  verified: PortalVerifiedIdentity | null;
  portalRoles: string[];
}

export const portalGuestActor = (
  guest: { userId: string; subjectKeys: readonly string[]; subjectRoles?: readonly PortalSubjectRole[]; identity?: PortalVerifiedIdentity },
  recordSubjectKeys: readonly string[],
): PortalGuestActor => ({
  id: guest.userId,
  via: 'portal',
  verified: guest.identity ?? null,
  portalRoles: portalRolesOn(guest, recordSubjectKeys),
});
