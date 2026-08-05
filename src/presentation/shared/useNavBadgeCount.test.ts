import { describe, expect, it } from 'vitest';
import { countBadgeRecords } from './useNavBadgeCount';
import type { EntityRecord } from '../../domain/entities';

const record = (values: Record<string, unknown>): EntityRecord => ({
  id: String(values.id ?? 'r1'),
  tenantId: 't1',
  collection: 'pushes',
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  ...values,
} as EntityRecord);

const pushes = [
  record({ id: '1', status: 'pending' }),
  record({ id: '2', status: 'pending' }),
  record({ id: '3', status: 'reviewed' }),
  record({ id: '4', status: 'archived' }),
];

describe('countBadgeRecords', () => {
  it('conta só os registros que satisfazem a expressão', () => {
    expect(countBadgeRecords(pushes, { collection: 'pushes', when: 'status == "pending"' })).toBe(2);
    expect(countBadgeRecords(pushes, { collection: 'pushes', when: 'status != "archived"' })).toBe(3);
  });

  it('sem expressão, conta todos', () => {
    expect(countBadgeRecords(pushes, { collection: 'pushes' })).toBe(4);
    expect(countBadgeRecords(pushes, { collection: 'pushes', when: '   ' })).toBe(4);
  });

  /**
   * Expressão quebrada não pode derrubar o menu: o selo some, e a barra lateral continua de pé. É a
   * mesma tolerância de `hiddenWhen` numa Action, e pelo mesmo motivo — a declaração vem de fora.
   */
  it('expressão inválida não estoura: conta zero', () => {
    expect(countBadgeRecords(pushes, { collection: 'pushes', when: 'status ==' })).toBe(0);
    expect(countBadgeRecords(pushes, { collection: 'pushes', when: 'campoQueNaoExiste' })).toBe(0);
  });

  it('coleção vazia conta zero', () => {
    expect(countBadgeRecords([], { collection: 'pushes', when: 'status == "pending"' })).toBe(0);
  });
});
