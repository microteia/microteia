import { describe, it, expect } from 'vitest';
import { normalizeFirestoreValue } from './normalizeFirestoreValue';

const fakeTimestamp = (date: Date): { toDate: () => Date } => ({ toDate: () => date });

describe('normalizeFirestoreValue', () => {
  it('converte um Timestamp-like em Date', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(normalizeFirestoreValue(fakeTimestamp(date))).toEqual(date);
  });

  it('converte a forma serializada firestore/timestamp/1.0 em Date', () => {
    const serialized = { type: 'firestore/timestamp/1.0', seconds: 1767225600, nanoseconds: 0 };
    expect(normalizeFirestoreValue(serialized)).toEqual(new Date(1767225600 * 1000));
  });

  it('normaliza recursivamente dentro de objetos', () => {
    const date = new Date('2026-02-01T00:00:00.000Z');
    const input = { draftedAt: fakeTimestamp(date), nested: { dueDate: fakeTimestamp(date) } };
    const result = normalizeFirestoreValue(input);
    expect(result.draftedAt).toEqual(date);
    expect(result.nested.dueDate).toEqual(date);
  });

  it('normaliza recursivamente dentro de arrays', () => {
    const date = new Date('2026-03-01T00:00:00.000Z');
    const result = normalizeFirestoreValue([fakeTimestamp(date), { at: fakeTimestamp(date) }]);
    expect(result[0]).toEqual(date);
    expect((result[1] as unknown as { at: Date }).at).toEqual(date);
  });

  it('mantém Date nativo, primitivos e null intactos', () => {
    const date = new Date('2026-04-01T00:00:00.000Z');
    expect(normalizeFirestoreValue(date)).toBe(date);
    expect(normalizeFirestoreValue('texto')).toBe('texto');
    expect(normalizeFirestoreValue(42)).toBe(42);
    expect(normalizeFirestoreValue(null)).toBe(null);
    expect(normalizeFirestoreValue(undefined)).toBe(undefined);
  });

  it('não recursa em objetos não-plain (ex: instâncias de classe)', () => {
    class NotPlain {
      value = 'x';
    }
    const instance = new NotPlain();
    expect(normalizeFirestoreValue(instance)).toBe(instance);
  });
});
