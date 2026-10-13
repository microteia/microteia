import type { WorkflowServices } from '../entities/WorkflowContext';
import type { BusinessCalendarSet } from '../schema/time/businessDays';

/**
 * Os calendários que uma avaliação precisa — carregados SÓ se ela cita uma das contas.
 *
 * `needed` é a resposta de `mentionsBusinessDays` (ou de `tableMentionsBusinessDays`) sobre o que vai
 * ser avaliado. Sem necessidade, devolve o que a execução já tiver (normalmente nada), e a gravação de
 * um registro que não conta dia útil não paga leitura nenhuma. Com necessidade e sem carregador, é
 * `null`: a conta recusa nomeando a falta, nunca conta sem os dias não úteis.
 */
export const businessCalendarsFor = async (
  services: Pick<WorkflowServices, 'businessCalendars' | 'businessCalendarsOf'>,
  tenantId: string,
  needed: boolean,
): Promise<BusinessCalendarSet | null | undefined> => {
  if (services.businessCalendars !== undefined || !needed) return services.businessCalendars;
  return services.businessCalendarsOf ? services.businessCalendarsOf(tenantId) : null;
};

/** Os serviços com os calendários já resolvidos, para a execução inteira enxergar a mesma leitura. */
export const withBusinessCalendars = async (
  services: WorkflowServices,
  tenantId: string,
  needed: boolean,
): Promise<WorkflowServices> => {
  const businessCalendars = await businessCalendarsFor(services, tenantId, needed);
  return businessCalendars === undefined || services.businessCalendars !== undefined
    ? services
    : { ...services, businessCalendars };
};
