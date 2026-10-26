import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildAuditArchiveDay,
  canonicalJson,
  checkAuditArchiveDay,
  parseAuditArchiveDay,
  verifyAuditChain,
} from './auditArchiveChain';
import type { AuditChainLink } from '../schema/auditRetention';
import { AUDIT_ARCHIVE_GENESIS_HASH } from '../schema/auditRetention';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const log = (id: string, createdAt: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  tenantId: 't1',
  title: '@core.admin/audit.retention.changed.title',
  action: 'UPDATE',
  createdAt,
  ...extra,
});

/** Uma cadeia de verdade, dia a dia, como o exportador a escreveria. */
const chainOf = (days: { day: string; logs: Record<string, unknown>[]; complete?: boolean }[], start: AuditChainLink | null = null) => {
  const files = new Map<string, string>();
  let previous = start;
  for (const entry of days) {
    const built = buildAuditArchiveDay(
      { tenantId: 't1', day: entry.day, previous, logs: entry.logs, complete: entry.complete ?? true },
      sha256,
    );
    files.set(entry.day, built.content);
    previous = { day: entry.day, dayHash: built.header.dayHash };
  }
  return { files, head: previous };
};

const verify = (
  files: Map<string, string>,
  options: { head?: AuditChainLink | null; resume?: AuditChainLink | null; outOfTime?: () => boolean } = {},
) => verifyAuditChain({
  tenantId: 't1',
  days: [...files.keys()].sort(),
  read: async (day) => files.get(day) ?? null,
  resume: options.resume ?? null,
  expectedHead: options.head ?? null,
  protection: null,
  outOfTime: options.outOfTime ?? (() => false),
}, sha256);

const THREE_DAYS = [
  { day: '2026-10-01', logs: [log('a', '2026-10-01T10:00:00.000Z'), log('b', '2026-10-01T11:00:00.000Z')] },
  { day: '2026-10-02', logs: [] },
  { day: '2026-10-03', logs: [log('c', '2026-10-03T09:00:00.000Z')] },
];

/** Reescreve uma linha do arquivo como um atacante faria, sem saber da cadeia. */
const tamper = (content: string, row: number, change: (value: Record<string, unknown>) => void): string => {
  const rows = content.split('\n');
  const value = JSON.parse(rows[row]) as Record<string, unknown>;
  change(value);
  rows[row] = canonicalJson(value);
  return rows.join('\n');
};

describe('canonicalJson', () => {
  it('não depende da ordem de inserção das chaves', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: 'z' } }))
      .toBe(canonicalJson({ a: { c: 'z', d: [1, { x: 1, y: 2 }] }, b: 1 }));
  });

  it('descarta undefined, e escreve Date como ISO', () => {
    expect(canonicalJson({ a: undefined, b: new Date('2026-10-01T00:00:00Z') })).toBe('{"b":"2026-10-01T00:00:00.000Z"}');
  });

  it('sobrevive à ida e volta pelo JSON — é o que permite conferir o arquivo com outra ferramenta', () => {
    const value = { z: [1, 2, { q: null }], a: 'texto com "aspas" e ç' };
    expect(canonicalJson(JSON.parse(canonicalJson(value)))).toBe(canonicalJson(value));
  });
});

describe('buildAuditArchiveDay', () => {
  it('o primeiro dia parte do gênese; cada linha leva o próprio hash e o do dia anterior', () => {
    const built = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-01', previous: null, logs: THREE_DAYS[0].logs, complete: true }, sha256);
    expect(built.header.previousDay).toBeNull();
    expect(built.header.previousDayHash).toBe(AUDIT_ARCHIVE_GENESIS_HASH);
    expect(built.header.count).toBe(2);
    expect(built.lines[0].hash).toBe(sha256(canonicalJson(THREE_DAYS[0].logs[0])));
    expect(built.lines.every((line) => line.previousDayHash === AUDIT_ARCHIVE_GENESIS_HASH)).toBe(true);
  });

  it('é determinístico: a mesma entrada em outra ordem gera o MESMO arquivo — a reexportação é idempotente', () => {
    const forward = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-01', previous: null, logs: THREE_DAYS[0].logs, complete: true }, sha256);
    const reversed = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-01', previous: null, logs: [...THREE_DAYS[0].logs].reverse(), complete: true }, sha256);
    expect(reversed.content).toBe(forward.content);
  });

  it('linhas no mesmo instante desempatam pelo id', () => {
    const built = buildAuditArchiveDay({
      tenantId: 't1', day: '2026-10-01', previous: null, complete: true,
      logs: [log('z', '2026-10-01T10:00:00.000Z'), log('m', '2026-10-01T10:00:00.000Z')],
    }, sha256);
    expect(built.lines.map((line) => line.log.id)).toEqual(['m', 'z']);
  });

  it('o hash do dia amarra o escritório e o dia: o mesmo conteúdo em outro lugar tem outro hash', () => {
    const here = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-01', previous: null, logs: [], complete: true }, sha256);
    const elsewhere = buildAuditArchiveDay({ tenantId: 't2', day: '2026-10-01', previous: null, logs: [], complete: true }, sha256);
    const otherDay = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-02', previous: null, logs: [], complete: true }, sha256);
    const partial = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-01', previous: null, logs: [], complete: false }, sha256);
    expect(new Set([here, elsewhere, otherDay, partial].map((built) => built.header.dayHash)).size).toBe(4);
  });

  it('o arquivo lido de volta é o que foi escrito', () => {
    const built = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-01', previous: null, logs: THREE_DAYS[0].logs, complete: true }, sha256);
    expect(parseAuditArchiveDay(built.content)).toEqual({ header: built.header, lines: built.lines });
    expect(parseAuditArchiveDay('não é json\n')).toBeNull();
    expect(parseAuditArchiveDay('')).toBeNull();
  });
});

describe('verifyAuditChain — a cadeia íntegra', () => {
  it('atesta todos os dias e devolve o hash do último', async () => {
    const { files, head } = chainOf(THREE_DAYS);
    const result = await verify(files, { head });
    expect(result).toMatchObject({ status: 'intact', daysChecked: 3, firstDay: '2026-10-01', lastDay: '2026-10-03', headHash: head!.dayHash, divergence: null });
  });

  it('sem arquivo nenhum é vazia — não é falha', async () => {
    expect((await verify(new Map())).status).toBe('empty');
  });

  it('o período com o arquivo desligado é uma lacuna DECLARADA, e não uma divergência', async () => {
    const before = chainOf([THREE_DAYS[0]]);
    const after = chainOf([{ day: '2026-10-20', logs: [] }], before.head);
    const files = new Map([...before.files, ...after.files]);
    const result = await verify(files, { head: after.head });
    expect(result.status).toBe('intact');
    expect(result.gaps).toEqual([{ after: '2026-10-01', resumedAt: '2026-10-20' }]);
  });

  it('lista os dias exportados tarde demais para estarem completos', async () => {
    const { files } = chainOf([{ ...THREE_DAYS[0], complete: false }, THREE_DAYS[1]]);
    expect((await verify(files)).incompleteDays).toEqual(['2026-10-01']);
  });

  it('sem tempo, devolve o ponto de onde continuar — e continuar dali fecha a cadeia', async () => {
    const twelveDays = Array.from({ length: 12 }, (_, index) => ({ day: `2026-10-${String(index + 1).padStart(2, '0')}`, logs: [] }));
    const { files, head } = chainOf(twelveDays);
    let calls = 0;
    const partial = await verify(files, { head, outOfTime: () => calls++ > 0 });
    expect(partial.status).toBe('partial');
    expect(partial.daysChecked).toBe(8);
    expect(partial.resume).toEqual(chainOf(twelveDays.slice(0, 8)).head);

    const resumed = await verify(files, { resume: partial.resume, head });
    expect(resumed).toMatchObject({ status: 'intact', daysChecked: 4, lastDay: '2026-10-12', headHash: head!.dayHash });
  });
});

describe('verifyAuditChain — o que a cadeia denuncia', () => {
  it('uma linha alterada, mesmo com o hash da linha recalculado: o hash do dia não fecha', async () => {
    const { files } = chainOf(THREE_DAYS);
    files.set('2026-10-01', tamper(files.get('2026-10-01')!, 1, (line) => {
      (line.log as Record<string, unknown>).action = 'CREATE';
      line.hash = sha256(canonicalJson(line.log));
    }));
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-01', reason: 'day-hash' });
  });

  it('uma linha alterada sem recalcular o hash aponta a linha e o log', async () => {
    const { files } = chainOf(THREE_DAYS);
    files.set('2026-10-03', tamper(files.get('2026-10-03')!, 1, (line) => {
      (line.log as Record<string, unknown>).title = 'outra coisa';
    }));
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-03', reason: 'line-altered', line: 2, logId: 'c' });
  });

  it('uma linha removida', async () => {
    const { files } = chainOf(THREE_DAYS);
    const rows = files.get('2026-10-01')!.split('\n');
    rows.splice(2, 1);
    files.set('2026-10-01', rows.join('\n'));
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-01', reason: 'count-mismatch' });
  });

  it('um dia reescrito por inteiro, com tudo recalculado: o dia SEGUINTE não reconhece o elo', async () => {
    const { files } = chainOf(THREE_DAYS);
    const forged = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-01', previous: null, logs: [THREE_DAYS[0].logs[0]], complete: true }, sha256);
    files.set('2026-10-01', forged.content);
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-01', reason: 'chain-broken' });
  });

  it('um dia do meio apagado', async () => {
    const { files } = chainOf(THREE_DAYS);
    files.delete('2026-10-02');
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-02', reason: 'missing-day' });
  });

  it('um dia INSERIDO entre dois é apontado, e não o dia legítimo depois dele', async () => {
    const { files } = chainOf([THREE_DAYS[0], THREE_DAYS[2]]);
    const first = chainOf([THREE_DAYS[0]]);
    const inserted = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-02', previous: first.head, logs: [], complete: true }, sha256);
    files.set('2026-10-02', inserted.content);
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-02', reason: 'chain-broken' });
  });

  it('o começo cortado: o primeiro arquivo que sobrou não parte do gênese', async () => {
    const { files } = chainOf(THREE_DAYS);
    files.delete('2026-10-01');
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-01', reason: 'genesis' });
  });

  it('o fim cortado: o registro do escritório diz que a cadeia ia além', async () => {
    const { files, head } = chainOf(THREE_DAYS);
    files.delete('2026-10-03');
    expect((await verify(files, { head })).divergence).toEqual({ day: '2026-10-03', reason: 'missing-tail' });
  });

  it('o último dia reescrito por inteiro: só o hash guardado fora do arquivo o denuncia', async () => {
    const { files, head } = chainOf(THREE_DAYS);
    const second = chainOf(THREE_DAYS.slice(0, 2));
    const forged = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-03', previous: second.head, logs: [], complete: true }, sha256);
    files.set('2026-10-03', forged.content);
    expect((await verify(files)).status).toBe('intact');
    expect((await verify(files, { head })).divergence).toEqual({ day: '2026-10-03', reason: 'head-mismatch' });
  });

  it('o arquivo de outro dia (ou de outro escritório) posto no lugar', async () => {
    const { files } = chainOf(THREE_DAYS);
    files.set('2026-10-02', files.get('2026-10-03')!);
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-02', reason: 'misplaced' });
  });

  it('o arquivo ilegível', async () => {
    const { files } = chainOf(THREE_DAYS);
    files.set('2026-10-02', '{quebrado');
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-02', reason: 'unreadable' });
  });

  it('trocar "completo" por "incompleto" (ou o contrário) quebra o hash do dia', async () => {
    const { files } = chainOf(THREE_DAYS);
    files.set('2026-10-02', tamper(files.get('2026-10-02')!, 0, (header) => { header.complete = false; }));
    expect((await verify(files)).divergence).toEqual({ day: '2026-10-02', reason: 'day-hash' });
  });
});

describe('checkAuditArchiveDay', () => {
  it('confere um dia isolado contra o elo esperado', () => {
    const { files, head } = chainOf(THREE_DAYS.slice(0, 1));
    const next = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-02', previous: head, logs: [], complete: true }, sha256);
    expect(checkAuditArchiveDay({ tenantId: 't1', day: '2026-10-02', expected: head, content: next.content }, sha256).ok).toBe(true);
    expect(checkAuditArchiveDay({ tenantId: 't1', day: '2026-10-01', expected: null, content: files.get('2026-10-01')! }, sha256).ok).toBe(true);
    expect(checkAuditArchiveDay({ tenantId: 't1', day: '2026-10-02', expected: null, content: null }, sha256))
      .toEqual({ ok: false, divergence: { day: '2026-10-02', reason: 'unreadable' } });
  });
});
