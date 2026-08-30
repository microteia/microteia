import type {
  ExtensionHistory,
  ExtensionHistoryEntry,
  ExtensionHistoryVersion,
} from '../entities/ExtensionHistory';

/**
 * O histórico de versões aplicadas das extensões de um escritório
 * (`tenants/{tenantId}/extension_history/{pluginId}`, com o pacote de cada entrada em
 * `versions/{revision}`).
 *
 * `subscribe` traz só o ÍNDICE — os metadados —, que é o que a tela precisa para saber que há
 * histórico. O pacote de uma entrada custa uma leitura própria (`getVersion`), paga apenas por quem
 * escolhe voltar àquela versão.
 *
 * `record` é idempotente pela `revision`: aplicar de novo uma versão que já está no histórico não
 * cria item nenhum. É isso que faz o rollback passar pela MESMA porta de instalação sem precisar
 * avisá-la de que é um rollback.
 */
export interface IExtensionHistoryRepository {
  subscribe(tenantId: string, onChange: (histories: ExtensionHistory[]) => void): () => void;
  record(
    tenantId: string,
    pluginId: string,
    entry: ExtensionHistoryEntry,
    version: ExtensionHistoryVersion,
  ): Promise<void>;
  getVersion(tenantId: string, pluginId: string, revision: string): Promise<ExtensionHistoryVersion | null>;
  /** Apaga o histórico inteiro — índice e pacotes. Só a EXCLUSÃO da extensão chega aqui. */
  deleteAll(tenantId: string, pluginId: string): Promise<void>;
}
