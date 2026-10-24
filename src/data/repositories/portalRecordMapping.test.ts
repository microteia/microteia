import { afterEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { mapPortalRecord } from './portalRecordMapping';
import { toPlainValues } from '../utils/plainValues';
import { dayOf, formatDate, today } from '../../utils/formatters';
import { resetAmbientInstant, setAmbientInstant, setAmbientTimeZone } from '../../domain/schema/clockGate';

/**
 * O caso real: os cartões da home do portal compararam a data da audiência com hoje, e a projeção
 * entregava o Timestamp cru — "Próximas audiências" vazio com audiências marcadas, sem erro nenhum.
 * Um campo de data é gravado como o dia ao meio-dia UTC; os dois caminhos até a view (a projeção do
 * portal e os registros do escritório) precisam entregá-lo na MESMA forma.
 */
const hearing = Timestamp.fromDate(new Date('2026-12-15T12:00:00.000Z'));

describe('campo de data na fronteira com a view', () => {
  afterEach(() => resetAmbientInstant());

  it('a projeção do portal entrega Date, inclusive aninhado e em lista', () => {
    const record = mapPortalRecord('hearings__h1', {
      collection: 'hearings',
      recordId: 'h1',
      data: { date: hearing, notes: 'x', history: [{ at: hearing }] },
    });
    expect(record.data.date).toEqual(new Date('2026-12-15T12:00:00.000Z'));
    expect((record.data.history as Array<{ at: unknown }>)[0].at).toBeInstanceOf(Date);
    expect(record.data.notes).toBe('x');
  });

  it('o registro do escritório e a projeção do portal entregam o mesmo valor', () => {
    const office = toPlainValues({ date: hearing }) as Record<string, unknown>;
    const portal = mapPortalRecord('hearings__h1', { data: { date: hearing } });
    expect(portal.data.date).toEqual(office.date);
  });

  it('o dia lido pela view é o dia gravado, e compara com today() no fuso do escritório', () => {
    setAmbientTimeZone('America/Sao_Paulo');
    setAmbientInstant(new Date('2026-12-16T01:30:00.000Z'));
    const portal = mapPortalRecord('hearings__h1', { data: { date: hearing } });
    expect(dayOf(portal.data.date)).toBe('2026-12-15');
    expect(today()).toBe('2026-12-15');
    expect(dayOf(portal.data.date) >= today()).toBe(true);
  });

  it('formatDate lê as três formas — o Timestamp antes virava vazio', () => {
    expect(formatDate(hearing)).not.toBe('');
    expect(formatDate(hearing)).toBe(formatDate(hearing.toDate()));
    expect(formatDate('2026-12-15')).toBe(formatDate(hearing.toDate()));
  });
});

describe('dayOf', () => {
  afterEach(() => resetAmbientInstant());

  it('um dia em texto passa intacto, e o irreconhecível vira vazio', () => {
    expect(dayOf('2026-12-15')).toBe('2026-12-15');
    expect(dayOf('não é data')).toBe('');
    expect(dayOf(null)).toBe('');
    expect(dayOf(undefined)).toBe('');
  });

  it('um instante é lido no relógio do escritório, não em UTC', () => {
    setAmbientTimeZone('America/Sao_Paulo');
    expect(dayOf(new Date('2026-12-16T01:30:00.000Z'))).toBe('2026-12-15');
    setAmbientTimeZone('UTC');
    expect(dayOf(new Date('2026-12-16T01:30:00.000Z'))).toBe('2026-12-16');
  });
});
