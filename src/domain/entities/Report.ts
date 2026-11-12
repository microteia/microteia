// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/entities/Report.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldOrigin } from '../schema/fieldRules';
import type { ReportSpec } from '../schema/report/reportSpec';

/**
 * O relatório como DOCUMENTO do escritório: `tenants/{tenantId}/reports/{id}`.
 *
 * O `ReportSpec` fica separado daqui de propósito, e o molde é `QuerySpec` × `WorkflowDefinition`:
 * puro, portátil e sem identidade de tenant, o spec viaja sozinho — no `.json` de um pacote, no
 * payload da callable, na pré-visualização da autoria e, quando existir, no agendamento. O que esta
 * entidade acrescenta é só o que pertence a ESTA instalação.
 */
export interface ReportDefinition {
  id: string;
  tenantId: string;
  /**
   * O endereço ESTÁVEL do relatório: a aba (`rep:<key>`), o deep link, o ⌘K e o nó `report` do
   * Widget DSL o citam. Não é nome de coleção — um relatório não tem dados próprios.
   */
  key: string;
  title: string;
  description?: string | null;
  /** Chave do catálogo curado de ícones de tela, nunca um componente. */
  icon?: string | null;
  spec: ReportSpec;
  /**
   * Onde o relatório foi declarado. `plugin` não pode ser EXCLUÍDO pelo escritório; um relatório de
   * pacote só aparece nesta coleção depois de instalado, e o gesto de EDITAR um deles é duplicar
   * (nasce uma cópia `design`), nunca mesclar — ver o comentário de `managed`.
   */
  origin: FieldOrigin;
  ownerPluginId?: string | null;
  /** Conjunto de extensões que compartilham este relatório (refcount); removido só quando vazio. */
  ownerPluginIds?: string[] | null;
  /** Id UNIVERSAL de origem — chave de deduplicação na instalação. */
  sourceId?: string | null;
  /**
   * Revisão de ORIGEM do artefato, carimbada no empacotamento. A instalação só reescreve o conteúdo
   * quando a revisão que chega é estritamente maior que a materializada.
   */
  sourceRev?: number | null;
  /**
   * O relatório é GERENCIADO pela extensão dona: o spec é somente-leitura na autoria.
   *
   * Um `ReportSpec` NÃO se mescla com a edição do escritório, e é o oposto do que vale para telas.
   * Uma tela mescla porque o campo é unidade independente com dono próprio; um relatório é uma
   * afirmação só, e metade do pacote com metade do escritório produziria um número que ninguém
   * escreveu. Por isso o gesto é duplicar para editar.
   */
  managed?: boolean | null;
  enabled?: boolean;
  hideFromSidebar?: boolean | null;
  sidebarOrder?: number | null;
  createdBy?: string | null;
  /**
   * O relatório é PESSOAL: só este membro o vê, e ele mora em `personalReports`. Ausente, é do
   * escritório. Fora das automações por decisão: uma automação roda como sistema e avisa outras
   * pessoas, e o relatório privado vazaria pela notificação.
   */
  ownerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Um relatório do pacote. `templateId` é o endereço estável antes de a instalação gerar o `id`. */
export type ReportModuleTemplate = { templateId: string } & Omit<
  ReportDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'ownerPluginId' | 'ownerPluginIds' | 'ownerId'
>;
