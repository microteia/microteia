import React, { useEffect, useMemo, useRef } from 'react';
import {
  businessCalendarOf,
  createBusinessCalendarSet,
  type BusinessCalendar,
  type BusinessCalendarSet,
} from '../../domain/schema/time/businessDays';
import { setAmbientBusinessCalendars } from '../../domain/schema/time/businessDaysGate';
import { BUSINESS_CALENDAR_POINT, businessCalendarCollectionsOf } from '../../domain/schema/time/extensionPoints';
import { storeEvents, StoreEvents } from '../../infrastructure/events/StoreEventEmitter';
import { useContributions } from '../../stores/useKernel';
import { useRecords } from '../../stores/useRecords';
import { useRecordDemand } from '../../stores/useRecordDemand';

/**
 * Os calendários de dias úteis, do `RecordStore` para o gate das expressões.
 *
 * A ponte PEDE ao `RecordStore` as coleções que as extensões declaram (`time.business.calendar`) e
 * entrega os documentos delas à conta. Ela vive enquanto o escritório está aberto, e por isso os
 * calendários ficam assinados o tempo todo — a conta de um prazo não pode esperar alguém abrir a tela.
 *
 * Enquanto alguma coleção declarada não respondeu, o conjunto é "carregando" — e a conta recusa com
 * esse nome, em vez de contar sem os dias. Sem nenhuma declaração, é `null`: nenhuma extensão os traz.
 *
 * A conta só é refeita quando o CONTEÚDO muda (a impressão digital abaixo). Reassinar os registros
 * relê esta mesma coleção, e comparar por identidade de array viraria um laço.
 */
export const BusinessCalendarBridge: React.FC = () => {
  const contributions = useContributions(BUSINESS_CALENDAR_POINT);
  const { recordsByCollection } = useRecords();

  const collections = useMemo(() => businessCalendarCollectionsOf(contributions), [contributions]);
  // A conta de dias úteis precisa dos calendários o tempo todo, e a ponte vive enquanto o escritório.
  useRecordDemand(collections);

  const { set, fingerprint } = useMemo((): { set: BusinessCalendarSet | null; fingerprint: string } => {
    if (collections.length === 0) return { set: null, fingerprint: '' };
    const ready = collections.every((collection) => recordsByCollection[collection] !== undefined);
    const calendars: BusinessCalendar[] = collections.flatMap((collection) =>
      (recordsByCollection[collection] ?? []).map((record) =>
        businessCalendarOf(record.id, record as unknown as Record<string, unknown>),
      ),
    );
    return { set: createBusinessCalendarSet(calendars, ready), fingerprint: JSON.stringify([ready, calendars]) };
  }, [collections, recordsByCollection]);

  const pushed = useRef<string | null>(null);

  useEffect(() => {
    if (pushed.current === fingerprint) return;
    const hadCalendars = pushed.current !== null && pushed.current !== '';
    pushed.current = fingerprint;
    setAmbientBusinessCalendars(set);
    // Os registros já lidos se refazem quando há uma resposta nova a dar: o conjunto ficou PRONTO (ou
    // mudou depois disso), ou a extensão saiu. Durante o "carregando" não há o que refazer.
    if (set ? set.ready : hadCalendars) storeEvents.emit(StoreEvents.BUSINESS_CALENDARS_UPDATED);
  }, [set, fingerprint]);

  useEffect(() => () => setAmbientBusinessCalendars(null), []);

  return null;
};
