import type { Firestore } from 'firebase-admin/firestore';
import {
  businessCalendarOf,
  createBusinessCalendarSet,
  type BusinessCalendar,
  type BusinessCalendarSet,
} from '../../domain/schema/time/businessDays';

/** Quantos calendários uma coleção declarada entrega à conta. Um escritório tem dezenas, não milhares. */
export const BUSINESS_CALENDAR_LOAD_LIMIT = 500;

/**
 * Os calendários de dias úteis de um escritório, lidos das coleções que as extensões ligadas declaram.
 *
 * SEM cache entre execuções, e de propósito: o dia que o escritório acabou de marcar tem de valer na
 * próxima conta, e um cache por instância não fica sabendo de uma gravação que caiu noutra. O custo é
 * pequeno porque só se lê quando a execução cita uma das contas (`mentionsBusinessDays`) — e o
 * conjunto lido serve a execução inteira.
 */
export class BusinessCalendarLoader {
  constructor(
    private readonly db: Firestore,
    private readonly collectionsOf: (tenantId: string) => Promise<string[]>,
  ) {}

  async load(tenantId: string): Promise<BusinessCalendarSet | null> {
    const collections = await this.collectionsOf(tenantId);
    if (collections.length === 0) return null;

    const snapshots = await Promise.all(
      collections.map((collection) =>
        this.db.collection(`tenants/${tenantId}/${collection}`).limit(BUSINESS_CALENDAR_LOAD_LIMIT).get(),
      ),
    );
    const calendars: BusinessCalendar[] = snapshots.flatMap((snapshot) =>
      snapshot.docs.map((doc) => businessCalendarOf(doc.id, doc.data() as Record<string, unknown>)),
    );
    return createBusinessCalendarSet(calendars);
  }
}
