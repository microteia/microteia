import type { ReportDefinition } from '../entities/Report';
import type { ReportDefinitionInput } from './IReportDefinitionRepository';

/** O que se grava de um relatório pessoal: o autor vem à parte, e é ele que a regra confere. */
export type PersonalReportInput = Omit<ReportDefinitionInput, 'ownerId' | 'createdBy'>;

/**
 * Os relatórios PESSOAIS de um membro — `tenants/{tenantId}/personalReports`, só os dele.
 *
 * Repositório à parte, e não métodos a mais em `IReportDefinitionRepository`, porque é outra coleção com
 * outra regra, e o instalador de pacotes — que fala com os relatórios do escritório — não tem nada a
 * fazer aqui: um pacote nunca traz relatório pessoal.
 */
export interface IPersonalReportRepository {
  subscribe(tenantId: string, ownerId: string, onUpdate: (reports: ReportDefinition[]) => void): () => void;
  getAll(tenantId: string, ownerId: string): Promise<ReportDefinition[]>;
  create(tenantId: string, ownerId: string, data: PersonalReportInput): Promise<ReportDefinition>;
  update(tenantId: string, reportId: string, data: Partial<PersonalReportInput>): Promise<void>;
  delete(tenantId: string, reportId: string): Promise<void>;
  /**
   * Leva o relatório para os do escritório, com o id `key`, e apaga o pessoal — num lote só, para não
   * existir o instante em que ele está nos dois lugares ou em nenhum. Chave tomada é recusa.
   */
  share(tenantId: string, reportId: string, key: string): Promise<void>;
}
