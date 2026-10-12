import { describe, expect, it } from 'vitest';
import { readRecordKeyAdoptionState } from '../schema/recordKeyAdoption';
import type { RecordKeyAdoptionState } from '../schema/recordKeyAdoption';
import { NOTICE_MAX_VALUES, recordKeyAdoptionNotices } from './recordKeyAdoptionNotice';

const state = (over: Partial<RecordKeyAdoptionState>): RecordKeyAdoptionState => ({
  ...readRecordKeyAdoptionState({}),
  pending: { email: 's' },
  ...over,
});

const label = (name: string): string => name.toUpperCase();

describe('recordKeyAdoptionNotices', () => {
  it('sem chave em adoção não há o que dizer — nem sobre a passada que acabou de adotar', () => {
    expect(recordKeyAdoptionNotices(null, label)).toEqual([]);
    expect(recordKeyAdoptionNotices(state({ pending: {}, status: 'done' }), label)).toEqual([]);
  });

  it('em curso: informa, e diz que o valor novo repetido já é recusado', () => {
    expect(recordKeyAdoptionNotices(state({ status: 'running', processed: 40 }), label)).toEqual([
      { messageKey: 'key.adoption.running', params: { keys: 'EMAIL', count: '40' }, variant: 'info' },
    ]);
  });

  it('duplicatas: cita os valores repetidos, sem repetir o mesmo, com teto', () => {
    const issues = Array.from({ length: NOTICE_MAX_VALUES + 2 }, (_, index) => ({
      key: 'email', kind: 'duplicate' as const, recordId: `r${index}`, holderId: 'a', values: [`v${index}`],
    }));
    issues.push({ ...issues[0], recordId: 'outro' });
    const [notice] = recordKeyAdoptionNotices(state({ status: 'done', issues, issueCount: issues.length }), label);
    expect(notice.messageKey).toBe('key.adoption.duplicates');
    expect(notice.params.values.split(', ')).toHaveLength(NOTICE_MAX_VALUES + 1);
    expect(notice.params.values.startsWith('v0, v1')).toBe(true);
  });

  it('valor ausente e falha viram avisos próprios', () => {
    const notices = recordKeyAdoptionNotices(state({
      status: 'done',
      failed: 2,
      issueCount: 1,
      issues: [{ key: 'email', kind: 'missing', recordId: 'r', values: [] }],
    }), label);
    expect(notices.map((notice) => notice.messageKey)).toEqual(['key.adoption.missing', 'key.adoption.failed']);
  });

  it('bloqueada: diz qual formatação falta', () => {
    expect(recordKeyAdoptionNotices(state({ status: 'blocked', blocked: [{ key: 'email', preset: 'x/doc' }] }), label))
      .toEqual([{ messageKey: 'key.adoption.blocked', params: { key: 'EMAIL', preset: 'x/doc' }, variant: 'warning' }]);
  });
});
