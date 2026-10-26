/**
 * As linhas de auditoria de um escritório num intervalo, como o Firestore as guarda — com o `id` e os
 * instantes em ISO. É a matéria-prima do arquivo, e por isso não passa por entidade nenhuma: o que vai
 * para o hash é o documento, campo a campo, inclusive o que uma versão futura acrescentar.
 */
export interface IAuditLogDaySource {
  logsBetween(tenantId: string, start: Date, end: Date): Promise<Record<string, unknown>[]>;
}
