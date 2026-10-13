import type { BusinessCalendarSet } from '../../domain/schema/time/businessDays';
import { getDI } from '../di/container';

/**
 * Os calendários de dias úteis do escritório no SERVIDOR — o par de `tenantTimeZone` para quem monta
 * `WorkflowServices` à mão (relatório, Script, agente). Sem cache: ver `BusinessCalendarLoader`.
 */
export const tenantBusinessCalendars = (tenantId: string): Promise<BusinessCalendarSet | null> =>
  getDI().getBusinessCalendarLoader().load(tenantId);
