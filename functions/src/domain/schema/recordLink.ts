// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordLink.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O LINK de um registro, que não sabe que tela o apresenta.
 *
 * A aba `record:<coleção>:<id>` é resolvida na hora de abrir, pela tela que descreve a coleção —
 * a mesma regra de `useOpenRecord`. É ela que viaja num aviso, num e-mail, num push ou num texto: a
 * tela que mostra o registro pode ser outra amanhã (uma extensão instalada, um editor próprio), e o
 * link continua certo.
 *
 * Fora do app, o link vira `/microteia/<aba>?tenant=<id>`: o escritório viaja junto, porque quem é
 * membro de vários abriria o registro no escritório errado.
 */

export const RECORD_LINK_TAB_PREFIX = 'record:';

const APP_DEEP_LINK_PREFIX = '/microteia/';

export const TENANT_LINK_PARAM = 'tenant';

export interface RecordLinkTarget {
  collection: string;
  recordId: string;
}

export const recordLinkTabKey = (target: RecordLinkTarget): string =>
  `${RECORD_LINK_TAB_PREFIX}${target.collection}:${target.recordId}`;

/** Coleção não tem `:` (o nome é estreitado em `screenEntity`); o id é o resto, inteiro. */
export const parseRecordLinkTabKey = (tabKey: string): RecordLinkTarget | null => {
  if (!tabKey.startsWith(RECORD_LINK_TAB_PREFIX)) return null;
  const rest = tabKey.slice(RECORD_LINK_TAB_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon <= 0 || colon === rest.length - 1) return null;
  return { collection: rest.slice(0, colon), recordId: rest.slice(colon + 1) };
};

/** O caminho, relativo à raiz do app, que abre a aba no escritório dado. */
export const appDeepLinkPath = (tabKey: string, tenantId: string): string => {
  if (!tabKey) return '';
  const tenant = tenantId ? `?${TENANT_LINK_PARAM}=${encodeURIComponent(tenantId)}` : '';
  return `${APP_DEEP_LINK_PREFIX}${encodeURIComponent(tabKey)}${tenant}`;
};
