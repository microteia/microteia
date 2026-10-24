import { describe, expect, it } from 'vitest';
import { RECORD_KEY_CONFLICTS_CATEGORY, recordKeyConflictNotice } from './recordKeyConflictNotice';
import type { RecordKeyAdoptionState } from '../schema/recordKeyAdoption';

const state = (over: Partial<RecordKeyAdoptionState> = {}): RecordKeyAdoptionState => ({
  status: 'done',
  pending: { cpf: 'sig' },
  adopted: {},
  generation: 3,
  round: 1,
  cursor: null,
  leaseUntil: null,
  touchedAt: 0,
  attempts: 0,
  processed: 100,
  reserved: 97,
  failed: 0,
  failedIds: [],
  issues: [],
  issueCount: 3,
  blocked: [],
  recheck: false,
  ...over,
});

const input = (over: Partial<RecordKeyAdoptionState> = {}) => ({
  tenantId: 't1',
  collection: 'persons',
  state: state(over),
  screenId: 'pessoas',
  screenTitle: 'Pessoa',
  keyLabels: ['CPF', 'CNPJ'],
});

describe('aviso de valores repetidos encontrados pela adoção', () => {
  it('avisa quem tem `screens.manage`, pelo tipo que cada pessoa silencia, e leva à listagem', () => {
    expect(recordKeyConflictNotice(input())).toMatchObject({
      tenantId: 't1',
      category: RECORD_KEY_CONFLICTS_CATEGORY,
      params: { screen: 'Pessoa', keys: 'CPF, CNPJ', count: '3' },
      link: 'dyn:pessoas',
      recipientPermissions: ['screens.manage'],
      channels: { audit: false, inApp: true, email: true, push: true },
    });
  });

  it('um aviso por passada, não por gatilho', () => {
    expect(recordKeyConflictNotice(input())?.dedupKey).toBe('record-key-conflicts:persons:3');
    expect(recordKeyConflictNotice(input({ generation: 4 }))?.dedupKey).toBe('record-key-conflicts:persons:4');
  });

  it('não avisa sem nada a corrigir: chave adotada, ou pendente só por falha de leitura', () => {
    expect(recordKeyConflictNotice(input({ pending: {}, issueCount: 0 }))).toBeNull();
    expect(recordKeyConflictNotice(input({ issueCount: 0, failed: 2 }))).toBeNull();
  });
});
