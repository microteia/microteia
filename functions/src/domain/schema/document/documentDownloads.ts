// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/document/documentDownloads.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/document/documentDownloads.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Para ONDE vai o arquivo gerado — o terceiro eixo da geração, independente do modelo e da origem
 * dos dados.
 *
 * - `record`: a aba Documentos do registro. Permanente, segue a cascata de exclusão do registro.
 * - `downloads`: a tela Downloads do escritório. Temporário por padrão: o documento vence em
 *   `expiresAt`, o TTL do Firestore o apaga, e o gatilho de exclusão leva o arquivo do bucket junto.
 *
 * O motor NUNCA troca um pelo outro sozinho. Pedir `record` numa tela sem a aba Documentos é recusa:
 * uma automação que esperava o anexo seguiria em frente com um arquivo que expira. Quem oferece
 * Downloads no lugar é a tela, à vista de quem escolhe.
 */
export type DocumentDestination = 'record' | 'downloads';

export const DOCUMENT_DESTINATIONS: readonly DocumentDestination[] = ['record', 'downloads'];

export const DOWNLOADS_COLLECTION = 'downloads';

/**
 * O kernel que entende `destination` e `retentionDays` num modelo. Um kernel anterior ignora os dois
 * e anexa ao registro — por isso o campo é aditivo e o pacote que o usa declara `kernel: '^<esta>'`.
 */
export const DOCUMENT_DESTINATION_SINCE_KERNEL = '2.47.0';

/**
 * Quem enxerga um item de Downloads.
 *
 * - `owner`: só quem o gerou (e quem tem `downloads.manage`). É o caso de todo arquivo com uma
 *   pessoa por trás — o gesto, o agente, a automação disparada por alguém.
 * - `everyone` / `managers`: o arquivo gerado por automação SEM pessoa. Não há dono, e o escritório
 *   decide (`downloads.automationVisibility`) se ele fica com todos ou só com quem gerencia.
 *
 * Carimbado na GRAVAÇÃO, e não resolvido na leitura, para que a regra do Firestore decida pelo
 * próprio documento — sem ler a configuração a cada consulta.
 */
export type DownloadVisibility = 'owner' | 'everyone' | 'managers';

export type AutomationDownloadVisibility = Exclude<DownloadVisibility, 'owner'>;

export const AUTOMATION_DOWNLOAD_VISIBILITIES: readonly AutomationDownloadVisibility[] = ['managers', 'everyone'];

export const DOWNLOAD_RETENTION_SETTING = 'downloads.retentionDays';

export const DOWNLOAD_AUTOMATION_VISIBILITY_SETTING = 'downloads.automationVisibility';

export const DEFAULT_DOWNLOAD_RETENTION_DAYS = 7;

/** `0` é "não expira". Um ano é o teto: mais que isso não é arquivo temporário, é documento do registro. */
export const DOWNLOAD_RETENTION_MAX_DAYS = 365;

export const DEFAULT_AUTOMATION_DOWNLOAD_VISIBILITY: AutomationDownloadVisibility = 'managers';

export interface DownloadPolicy {
  /** Dias até vencer; `0` = não expira. */
  retentionDays: number;
  automationVisibility: AutomationDownloadVisibility;
}

export const isRetentionDays = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= DOWNLOAD_RETENTION_MAX_DAYS;

export const isDocumentDestination = (value: unknown): value is DocumentDestination =>
  (DOCUMENT_DESTINATIONS as readonly unknown[]).includes(value);

/**
 * A política do escritório a partir dos valores JÁ LIDOS de `settings/tenant`. Valor inválido cai no
 * padrão, como em `resolveSetting`: uma configuração quebrada não pode impedir a geração.
 */
export const downloadPolicyOf = (values: Readonly<Record<string, unknown>>): DownloadPolicy => {
  const retention = values[DOWNLOAD_RETENTION_SETTING];
  const visibility = values[DOWNLOAD_AUTOMATION_VISIBILITY_SETTING];
  return {
    retentionDays: isRetentionDays(retention) ? retention : DEFAULT_DOWNLOAD_RETENTION_DAYS,
    automationVisibility: (AUTOMATION_DOWNLOAD_VISIBILITIES as readonly unknown[]).includes(visibility)
      ? (visibility as AutomationDownloadVisibility)
      : DEFAULT_AUTOMATION_DOWNLOAD_VISIBILITY,
  };
};

/**
 * Quantos dias o arquivo fica: o pedido vence o modelo, que vence o escritório. Um valor fora da
 * faixa num nível é ignorado e o próximo responde — o mesmo "pula o inválido" das configurações.
 */
export const resolveRetentionDays = (
  requested: unknown,
  declared: unknown,
  policy: DownloadPolicy,
): number => {
  if (isRetentionDays(requested)) return requested;
  if (isRetentionDays(declared)) return declared;
  return policy.retentionDays;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** O instante em que o item vence, ou `null` quando não expira. */
export const downloadExpiresAt = (now: Date, retentionDays: number): Date | null =>
  retentionDays > 0 ? new Date(now.getTime() + retentionDays * DAY_MS) : null;

/**
 * Venceu, mesmo que o TTL ainda não o tenha apagado. O Firestore apaga o documento vencido "em algum
 * momento" — em geral em até um dia —, e a lista não pode mostrar como disponível o que já venceu.
 */
export const isDownloadExpired = (download: { expiresAt?: Date | null }, now: Date): boolean =>
  !!download.expiresAt && download.expiresAt.getTime() <= now.getTime();

/** De onde o arquivo saiu, quando saiu de um registro. */
export interface DownloadOrigin {
  collection: string;
  recordId: string;
}

/** Um item da tela Downloads, como o documento `tenants/{t}/downloads/{id}` o guarda. */
export interface DownloadItem {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  contentType: string;
  size: number;
  /** Quem o vê como dono. `null` no arquivo de automação sem pessoa. */
  ownerId: string | null;
  visibility: DownloadVisibility;
  templateKey?: string;
  origin?: DownloadOrigin;
  createdBy: string;
  createdByName?: string;
  createdVia: 'agent' | 'automation' | 'ui';
  createdAt: Date | null;
  expiresAt: Date | null;
}

/** O caminho no bucket: a pasta é o id do item, e é por ela que o gatilho de exclusão confere o que apaga. */
export const downloadStoragePath = (tenantId: string, downloadId: string, name: string): string =>
  `tenants/${tenantId}/${DOWNLOADS_COLLECTION}/${downloadId}/${name.replace(/\s+/g, '_')}`;

export const isDownloadStoragePath = (tenantId: string, downloadId: string, path: unknown): path is string =>
  typeof path === 'string' && path.startsWith(`tenants/${tenantId}/${DOWNLOADS_COLLECTION}/${downloadId}/`);
