import {
  AUDIT_ARCHIVE_FORMAT,
  AUDIT_ARCHIVE_FORMAT_VERSION,
  AUDIT_ARCHIVE_GENESIS_HASH,
  previousAuditDay,
} from '../schema/auditRetention';
import type {
  AuditArchiveHeader,
  AuditArchiveLine,
  AuditArchiveProtection,
  AuditChainDivergence,
  AuditChainGap,
  AuditChainLink,
  AuditChainVerification,
} from '../schema/auditRetention';

/** O SHA-256 em hexadecimal. Injetado: o domínio não importa `node:crypto`. */
export type Sha256 = (text: string) => string;

/**
 * JSON CANÔNICO — chaves em ordem, sem espaço, `undefined` fora, `Date` como ISO.
 *
 * O hash de uma linha tem de ser reproduzível por quem só tem o arquivo, anos depois e com outra
 * ferramenta. `JSON.stringify` depende da ordem em que as chaves foram inseridas, e essa ordem não
 * sobrevive a uma ida e volta pelo Firestore.
 */
export const canonicalJson = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === undefined || value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${entries.join(',')}}`;
};

export const auditLineHash = (log: Record<string, unknown>, sha256: Sha256): string => sha256(canonicalJson(log));

interface DayHashInput {
  tenantId: string;
  day: string;
  previousDay: string | null;
  previousDayHash: string;
  complete: boolean;
  lineHashes: readonly string[];
}

/**
 * O hash do dia amarra TUDO o que o cabeçalho afirma — o escritório, o dia, o elo, se está completo
 * e quantas linhas tem — e não só as linhas. Sem isso, mover o arquivo para outro dia ou outro
 * escritório, ou trocar `complete`, passaria pela conferência.
 */
export const auditDayHash = (input: DayHashInput, sha256: Sha256): string => sha256([
  AUDIT_ARCHIVE_FORMAT,
  String(AUDIT_ARCHIVE_FORMAT_VERSION),
  input.tenantId,
  input.day,
  input.previousDay ?? '',
  input.previousDayHash,
  input.complete ? 'complete' : 'partial',
  String(input.lineHashes.length),
  ...input.lineHashes,
].join('\n'));

const sortKey = (log: Record<string, unknown>): string => `${String(log.createdAt ?? '')}\u0000${String(log.id ?? '')}`;

/** A ordem do arquivo: criação, e o id como desempate — a mesma em toda reexportação. */
export const sortAuditLogs = (logs: readonly Record<string, unknown>[]): Record<string, unknown>[] =>
  [...logs].sort((left, right) => (sortKey(left) < sortKey(right) ? -1 : sortKey(left) > sortKey(right) ? 1 : 0));

export interface AuditArchiveDayInput {
  tenantId: string;
  day: string;
  /** O último dia exportado e o hash dele; `null` no primeiro dia da cadeia. */
  previous: AuditChainLink | null;
  logs: readonly Record<string, unknown>[];
  complete: boolean;
}

export interface BuiltAuditArchiveDay {
  header: AuditArchiveHeader;
  lines: AuditArchiveLine[];
  content: string;
}

export const buildAuditArchiveDay = (input: AuditArchiveDayInput, sha256: Sha256): BuiltAuditArchiveDay => {
  const previousDayHash = input.previous?.dayHash ?? AUDIT_ARCHIVE_GENESIS_HASH;
  const previousDay = input.previous?.day ?? null;
  const lines: AuditArchiveLine[] = sortAuditLogs(input.logs).map((log) => ({
    hash: auditLineHash(log, sha256),
    previousDayHash,
    log,
  }));
  const header: AuditArchiveHeader = {
    format: AUDIT_ARCHIVE_FORMAT,
    version: AUDIT_ARCHIVE_FORMAT_VERSION,
    tenantId: input.tenantId,
    day: input.day,
    previousDay,
    previousDayHash,
    count: lines.length,
    complete: input.complete,
    dayHash: auditDayHash({
      tenantId: input.tenantId,
      day: input.day,
      previousDay,
      previousDayHash,
      complete: input.complete,
      lineHashes: lines.map((line) => line.hash),
    }, sha256),
  };
  const content = `${[header, ...lines].map(canonicalJson).join('\n')}\n`;
  return { header, lines, content };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isHeader = (value: unknown): value is AuditArchiveHeader => isRecord(value)
  && typeof value.format === 'string'
  && typeof value.version === 'number'
  && typeof value.tenantId === 'string'
  && typeof value.day === 'string'
  && (value.previousDay === null || typeof value.previousDay === 'string')
  && typeof value.previousDayHash === 'string'
  && typeof value.count === 'number'
  && typeof value.complete === 'boolean'
  && typeof value.dayHash === 'string';

const isLine = (value: unknown): value is AuditArchiveLine => isRecord(value)
  && typeof value.hash === 'string'
  && typeof value.previousDayHash === 'string'
  && isRecord(value.log);

export interface ParsedAuditArchiveDay {
  header: AuditArchiveHeader;
  lines: AuditArchiveLine[];
}

/** O arquivo de um dia lido de volta, ou `null` quando ele não é um arquivo diário bem formado. */
export const parseAuditArchiveDay = (content: string): ParsedAuditArchiveDay | null => {
  const rows = content.split('\n').filter((row) => row !== '');
  if (rows.length === 0) return null;
  try {
    const [header, ...lines] = rows.map((row) => JSON.parse(row) as unknown);
    if (!isHeader(header) || !lines.every(isLine)) return null;
    return { header, lines: lines as AuditArchiveLine[] };
  } catch {
    return null;
  }
};

export type AuditArchiveDayCheck =
  | { ok: true; parsed: ParsedAuditArchiveDay }
  | { ok: false; divergence: AuditChainDivergence; claimedPreviousDay?: string | null };

/**
 * Confere UM dia contra o elo que o antecede. `expected` é `null` quando este deveria ser o primeiro
 * dia da cadeia — e então ele tem de partir do gênese, ou alguém cortou o começo.
 *
 * A ordem das perguntas é a da causa: o elo antes das linhas, porque um elo quebrado diz que o dia
 * inteiro está fora da cadeia, e apontar uma linha dele seria apontar o sintoma.
 */
export const checkAuditArchiveDay = (
  input: { tenantId: string; day: string; expected: AuditChainLink | null; content: string | null },
  sha256: Sha256,
): AuditArchiveDayCheck => {
  const { tenantId, day, expected } = input;
  const parsed = input.content === null ? null : parseAuditArchiveDay(input.content);
  if (!parsed) return { ok: false, divergence: { day, reason: 'unreadable' } };
  const { header, lines } = parsed;

  if (header.format !== AUDIT_ARCHIVE_FORMAT || header.version !== AUDIT_ARCHIVE_FORMAT_VERSION
    || header.tenantId !== tenantId || header.day !== day) {
    return { ok: false, divergence: { day, reason: 'misplaced' } };
  }

  if (expected === null) {
    if (header.previousDay !== null || header.previousDayHash !== AUDIT_ARCHIVE_GENESIS_HASH) {
      return { ok: false, divergence: { day: header.previousDay ?? day, reason: 'genesis' } };
    }
  } else if (header.previousDay !== null && header.previousDay > expected.day && header.previousDay < day) {
    return { ok: false, divergence: { day: header.previousDay, reason: 'missing-day' } };
  } else if (header.previousDay !== expected.day) {
    return { ok: false, divergence: { day, reason: 'chain-broken' }, claimedPreviousDay: header.previousDay };
  } else if (header.previousDayHash !== expected.dayHash) {
    return { ok: false, divergence: { day: expected.day, reason: 'chain-broken' } };
  }

  if (lines.length !== header.count) return { ok: false, divergence: { day, reason: 'count-mismatch' } };

  for (const [index, line] of lines.entries()) {
    if (line.previousDayHash !== header.previousDayHash || auditLineHash(line.log, sha256) !== line.hash) {
      const logId = typeof line.log.id === 'string' ? line.log.id : undefined;
      return { ok: false, divergence: { day, reason: 'line-altered', line: index + 2, ...(logId ? { logId } : {}) } };
    }
  }

  const recomputed = auditDayHash({
    tenantId,
    day,
    previousDay: header.previousDay,
    previousDayHash: header.previousDayHash,
    complete: header.complete,
    lineHashes: lines.map((line) => line.hash),
  }, sha256);
  if (recomputed !== header.dayHash) return { ok: false, divergence: { day, reason: 'day-hash' } };

  return { ok: true, parsed };
};

export interface VerifyAuditChainInput {
  tenantId: string;
  /** Os dias que o bucket tem, já em ordem. */
  days: readonly string[];
  read: (day: string) => Promise<string | null>;
  /** O último dia já atestado de uma verificação anterior. Ausente, a cadeia tem de começar no gênese. */
  resume: AuditChainLink | null;
  /** O fim da cadeia segundo o registro do escritório — o que torna visível o corte do FIM. */
  expectedHead: AuditChainLink | null;
  protection: AuditArchiveProtection | null;
  /** `true` quando o tempo acabou: a resposta volta `partial`, com o ponto de onde continuar. */
  outOfTime: () => boolean;
}

/** Quantos arquivos se baixam de uma vez. A conferência continua em ordem; só a leitura se adianta. */
const READ_AHEAD = 8;

/**
 * Percorre a cadeia do primeiro ao último dia e aponta o PRIMEIRO em que ela deixa de fechar.
 *
 * Ela só depende do arquivo e de `expectedHead`. Um bucket com retenção bloqueada não deixa ninguém
 * apagar nem regravar um dia; sem o bloqueio, é esta conferência que mostra que alguém o fez — desde
 * que o hash do último dia seja guardado também FORA do projeto (ver o modelo de ameaça no
 * `ARCHITECTURE.md`): quem pode reescrever o arquivo inteiro pode reescrever também `expectedHead`.
 */
export const verifyAuditChain = async (input: VerifyAuditChainInput, sha256: Sha256): Promise<AuditChainVerification> => {
  const days = input.resume ? input.days.filter((day) => day > input.resume!.day) : [...input.days];
  const gaps: AuditChainGap[] = [];
  const incompleteDays: string[] = [];
  let previous: AuditChainLink | null = input.resume;
  const verified: string[] = [];
  let firstDay: string | null = null;
  let daysChecked = 0;

  const report = (
    status: AuditChainVerification['status'],
    divergence: AuditChainDivergence | null,
  ): AuditChainVerification => ({
    status,
    daysChecked,
    firstDay,
    lastDay: previous?.day ?? null,
    headHash: previous?.dayHash ?? null,
    gaps,
    incompleteDays,
    divergence,
    resume: status === 'partial' ? previous : null,
    protection: input.protection,
  });

  for (let start = 0; start < days.length; start += READ_AHEAD) {
    if (input.outOfTime()) return report('partial', null);
    const batch = days.slice(start, start + READ_AHEAD);
    const contents = await Promise.all(batch.map(input.read));

    for (const [index, day] of batch.entries()) {
      const check = checkAuditArchiveDay({ tenantId: input.tenantId, day, expected: previous, content: contents[index] }, sha256);
      if (!check.ok) {
        // O dia diz que o anterior a ele é um dia mais velho que o último atestado: o que está entre os
        // dois foi INSERIDO, e é o primeiro deles que deixa de ser da cadeia — não este.
        const claimed = check.claimedPreviousDay;
        const inserted = claimed === undefined ? undefined : verified.find((verifiedDay) => verifiedDay > (claimed ?? ''));
        return report('diverged', inserted ? { day: inserted, reason: 'chain-broken' } : check.divergence);
      }

      const { header } = check.parsed;
      if (header.previousDay !== null && header.previousDay !== previousAuditDay(day)) {
        gaps.push({ after: header.previousDay, resumedAt: day });
      }
      if (!header.complete) incompleteDays.push(day);
      if (input.expectedHead?.day === day && input.expectedHead.dayHash !== header.dayHash) {
        return report('diverged', { day, reason: 'head-mismatch' });
      }
      firstDay ??= day;
      previous = { day, dayHash: header.dayHash };
      verified.push(day);
      daysChecked += 1;
    }
  }

  if (input.expectedHead && (!previous || previous.day < input.expectedHead.day)) {
    return report('diverged', { day: input.expectedHead.day, reason: 'missing-tail' });
  }
  return report(daysChecked === 0 && !input.resume ? 'empty' : 'intact', null);
};
