/**
 * RETENÇÃO DA AUDITORIA E ARQUIVO COM CADEIA DE HASH.
 *
 * Duas perguntas diferentes, e por isso duas peças:
 *
 * 1. **Por quanto tempo a linha fica à mão** — `retentionDays`, o `expiresAt` que o TTL do Firestore lê.
 *    É a tela de Auditoria, a busca, o gatilho `audit.recorded`. Padrão: os 30 dias de sempre.
 * 2. **O que prova que ela existiu e não mudou** — o ARQUIVO: uma cópia diária, em JSON Lines, num
 *    bucket que a instalação declara (`AUDIT_ARCHIVE_BUCKET`) e que deve ter retenção BLOQUEADA. Cada
 *    linha leva o próprio SHA-256 e o hash encadeado do dia anterior; cada dia fecha com o hash dele.
 *
 * As duas são escolha do escritório, e nenhuma muda nada para quem não as liga: sem documento em
 * `auditRetention/{tenantId}`, a política é `DEFAULT_AUDIT_RETENTION_POLICY` — exatamente o que valia
 * antes de ela existir.
 *
 * O dia é o dia UTC. Um dia do fuso do escritório mudaria de fronteira quando o fuso mudasse, e dois
 * arquivos consecutivos passariam a se sobrepor ou a deixar um buraco — numa cadeia que existe para
 * provar que não há buraco.
 */

export const AUDIT_RETENTION_COLLECTION = 'auditRetention';

/**
 * O mínimo É o padrão. Abaixo dele, uma linha poderia expirar antes de o arquivo copiá-la mesmo com a
 * exportação em dia — e é esse piso que permite ao exportador dizer, sem ler nada, se um dia atrasado
 * ainda está inteiro no Firestore (`isAuditDayStillComplete`).
 */
export const DEFAULT_AUDIT_RETENTION_DAYS = 30;

/** Dez anos. A partir daí a pergunta não é mais de consulta rápida: é de arquivo. */
export const AUDIT_RETENTION_MAX_DAYS = 3650;

export const DEFAULT_AUDIT_ARCHIVE_YEARS = 5;

export const AUDIT_ARCHIVE_MAX_YEARS = 30;

export interface AuditArchivePolicy {
  enabled: boolean;
  /** Anos que cada arquivo diário fica travado, quando o bucket aceita retenção por objeto. */
  retentionYears: number;
}

export interface AuditRetentionPolicy {
  retentionDays: number;
  archive: AuditArchivePolicy;
}

export const DEFAULT_AUDIT_RETENTION_POLICY: AuditRetentionPolicy = {
  retentionDays: DEFAULT_AUDIT_RETENTION_DAYS,
  archive: { enabled: false, retentionYears: DEFAULT_AUDIT_ARCHIVE_YEARS },
};

const isIntegerBetween = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export const isAuditRetentionDays = (value: unknown): value is number =>
  isIntegerBetween(value, DEFAULT_AUDIT_RETENTION_DAYS, AUDIT_RETENTION_MAX_DAYS);

export const isAuditArchiveYears = (value: unknown): value is number =>
  isIntegerBetween(value, 1, AUDIT_ARCHIVE_MAX_YEARS);

const recordOf = (value: unknown): Record<string, unknown> =>
  (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/**
 * A política a partir do que está gravado — TOLERANTE: o valor inválido cai no padrão. Quem lê é a
 * gravação de toda linha de auditoria, e uma política malformada não pode impedir que a auditoria
 * aconteça.
 */
export const auditRetentionPolicyOf = (raw: unknown): AuditRetentionPolicy => {
  const stored = recordOf(raw);
  const archive = recordOf(stored.archive);
  return {
    retentionDays: isAuditRetentionDays(stored.retentionDays) ? stored.retentionDays : DEFAULT_AUDIT_RETENTION_DAYS,
    archive: {
      enabled: archive.enabled === true,
      retentionYears: isAuditArchiveYears(archive.retentionYears) ? archive.retentionYears : DEFAULT_AUDIT_ARCHIVE_YEARS,
    },
  };
};

/**
 * A política que alguém quer gravar — ESTRITA: o que não está na faixa é recusa, com a referência de
 * mensagem que diz por quê. O tolerante acima é para ler; gravar um valor que seria lido como outro
 * esconderia de quem configurou o que de fato vale.
 */
export const auditRetentionPolicyIssue = (raw: unknown): string | null => {
  const policy = recordOf(raw);
  if (!isAuditRetentionDays(policy.retentionDays)) return '@core.admin/audit.retention.days-invalid';
  const archive = recordOf(policy.archive);
  if (typeof archive.enabled !== 'boolean') return '@core.admin/audit.retention.archive-invalid';
  if (!isAuditArchiveYears(archive.retentionYears)) return '@core.admin/audit.retention.years-invalid';
  return null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const auditLogExpiresAt = (createdAt: Date, retentionDays: number): Date =>
  new Date(createdAt.getTime() + retentionDays * DAY_MS);

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `AAAA-MM-DD` que é uma data de verdade — `2026-02-30` não é. */
export const isAuditDay = (value: unknown): value is string =>
  typeof value === 'string' && DAY_PATTERN.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export const auditDayOf = (instant: Date): string => instant.toISOString().slice(0, 10);

export const auditDayStart = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

export const nextAuditDay = (day: string): string => auditDayOf(new Date(auditDayStart(day).getTime() + DAY_MS));

export const previousAuditDay = (day: string): string => auditDayOf(new Date(auditDayStart(day).getTime() - DAY_MS));

/**
 * Quanto se espera depois da meia-noite UTC para fechar o dia. A linha é carimbada com a hora da
 * function que a escreve e chega ao banco um instante depois; exportar no primeiro minuto deixaria de
 * fora a que foi carimbada às 23:59:59 e gravada às 00:00:01.
 */
export const AUDIT_ARCHIVE_EXPORT_LAG_MS = 60 * 60 * 1000;

/** O dia mais recente que já pode ser exportado em `now`. */
export const lastClosedAuditDay = (now: Date): string =>
  previousAuditDay(auditDayOf(new Date(now.getTime() - AUDIT_ARCHIVE_EXPORT_LAG_MS)));

/**
 * O dia ainda está INTEIRO no Firestore: nenhuma linha dele pode ter expirado, porque nenhuma
 * retenção é menor que o piso. Exportado depois disso, o arquivo é gravado do mesmo jeito — com
 * `complete: false`, para que a ausência de uma linha não pareça prova de que ela não existiu.
 */
export const isAuditDayStillComplete = (day: string, now: Date): boolean =>
  now.getTime() < auditDayStart(day).getTime() + DEFAULT_AUDIT_RETENTION_DAYS * DAY_MS;

export const AUDIT_ARCHIVE_FORMAT = 'microteia.audit-archive';

export const AUDIT_ARCHIVE_FORMAT_VERSION = 1;

/** O "dia anterior" do primeiro dia da cadeia. Só o primeiro arquivo de um escritório o carrega. */
export const AUDIT_ARCHIVE_GENESIS_HASH = '0'.repeat(64);

/**
 * A primeira linha do arquivo de um dia. `previousDay` é DECLARADO, e não suposto como "ontem": um
 * período com o arquivo desligado vira uma lacuna que a própria cadeia anuncia — e que, por estar dentro
 * do hash, ninguém pode criar nem esconder depois.
 */
export interface AuditArchiveHeader {
  format: typeof AUDIT_ARCHIVE_FORMAT;
  version: number;
  tenantId: string;
  day: string;
  previousDay: string | null;
  previousDayHash: string;
  count: number;
  complete: boolean;
  dayHash: string;
}

/** Cada linha seguinte: o log como estava no Firestore, o SHA-256 dele e o elo com o dia anterior. */
export interface AuditArchiveLine {
  hash: string;
  previousDayHash: string;
  log: Record<string, unknown>;
}

const yearOf = (day: string): string => day.slice(0, 4);

/** Um arquivo por dia, numa pasta por ano: a listagem por prefixo já sai em ordem cronológica. */
export const auditArchivePath = (tenantId: string, day: string): string =>
  `tenants/${tenantId}/${yearOf(day)}/${day}.jsonl`;

export const auditArchivePrefix = (tenantId: string): string => `tenants/${tenantId}/`;

/** O dia de um caminho do arquivo, ou `null` para o que não é um arquivo diário daquele escritório. */
export const auditDayOfArchivePath = (tenantId: string, path: string): string | null => {
  const match = path.match(/^tenants\/([^/]+)\/(\d{4})\/(\d{4}-\d{2}-\d{2})\.jsonl$/);
  if (!match || match[1] !== tenantId || !isAuditDay(match[3]) || yearOf(match[3]) !== match[2]) return null;
  return match[3];
};

/**
 * O que protege o bucket, como ele mesmo diz. Vai em cada resposta de estado e de verificação: a
 * cadeia DETECTA a adulteração; só o bloqueio a IMPEDE — e quem lê o resultado precisa saber qual
 * das duas garantias está valendo.
 */
export interface AuditArchiveProtection {
  bucketRetentionLocked: boolean;
  bucketRetentionDays: number | null;
  objectRetentionLock: boolean;
}

export const isAuditArchiveLocked = (protection: AuditArchiveProtection | null): boolean =>
  !!protection && (protection.bucketRetentionLocked || protection.objectRetentionLock);

export interface AuditArchiveFailure {
  day: string;
  message: string;
  attempts: number;
  firstFailedAt: string;
  lastAlertedAt: string;
}

export interface AuditArchiveState {
  /** O dia a partir do qual o arquivo foi (re)ligado. A exportação nunca começa antes dele. */
  startDay: string | null;
  firstDay: string | null;
  lastDay: string | null;
  headHash: string | null;
  lastExportedAt: string | null;
  failure: AuditArchiveFailure | null;
}

export const EMPTY_AUDIT_ARCHIVE_STATE: AuditArchiveState = {
  startDay: null,
  firstDay: null,
  lastDay: null,
  headHash: null,
  lastExportedAt: null,
  failure: null,
};

export interface AuditRetentionStatus {
  policy: AuditRetentionPolicy;
  /** A instalação declarou um bucket de arquivo. Sem ele, o arquivo não pode ser ligado. */
  archiveAvailable: boolean;
  protection: AuditArchiveProtection | null;
  state: AuditArchiveState;
}

export interface AuditArchiveDayPage {
  day: string;
  exported: boolean;
  header: AuditArchiveHeader | null;
  lines: AuditArchiveLine[];
  offset: number;
  total: number;
}

export const AUDIT_ARCHIVE_PAGE_MAX = 200;

/**
 * Por que a verificação parou. Todas apontam o PRIMEIRO dia em que a cadeia deixou de fechar — o que
 * vem depois dele não pode ser atestado por ela.
 */
export type AuditChainDivergenceReason =
  | 'unreadable'
  | 'misplaced'
  | 'genesis'
  | 'missing-day'
  | 'chain-broken'
  | 'line-altered'
  | 'count-mismatch'
  | 'day-hash'
  | 'missing-tail'
  | 'head-mismatch';

/**
 * A frase de cada motivo, por extenso: a tela e o registro na Auditoria dizem a MESMA coisa, e uma
 * referência montada em tempo de execução seria invisível para `verify-messages`.
 */
export const AUDIT_CHAIN_DIVERGENCE_MESSAGES: Record<AuditChainDivergenceReason, string> = {
  unreadable: '@core.admin/audit.archive.reason.unreadable',
  misplaced: '@core.admin/audit.archive.reason.misplaced',
  genesis: '@core.admin/audit.archive.reason.genesis',
  'missing-day': '@core.admin/audit.archive.reason.missing-day',
  'chain-broken': '@core.admin/audit.archive.reason.chain-broken',
  'line-altered': '@core.admin/audit.archive.reason.line-altered',
  'count-mismatch': '@core.admin/audit.archive.reason.count-mismatch',
  'day-hash': '@core.admin/audit.archive.reason.day-hash',
  'missing-tail': '@core.admin/audit.archive.reason.missing-tail',
  'head-mismatch': '@core.admin/audit.archive.reason.head-mismatch',
};

export interface AuditChainDivergence {
  day: string;
  reason: AuditChainDivergenceReason;
  /** A linha do arquivo, contando o cabeçalho como 1, quando a divergência é de uma linha. */
  line?: number;
  logId?: string;
}

/** O ponto de onde uma verificação interrompida continua — o último dia atestado e o hash dele. */
export interface AuditChainLink {
  day: string;
  dayHash: string;
}

export interface AuditChainGap {
  after: string;
  resumedAt: string;
}

export type AuditChainStatus = 'intact' | 'diverged' | 'empty' | 'partial';

export interface AuditChainVerification {
  status: AuditChainStatus;
  daysChecked: number;
  firstDay: string | null;
  lastDay: string | null;
  headHash: string | null;
  gaps: AuditChainGap[];
  incompleteDays: string[];
  divergence: AuditChainDivergence | null;
  /** Presente em `partial`: mande-o de volta para continuar de onde parou. */
  resume: AuditChainLink | null;
  protection: AuditArchiveProtection | null;
}
