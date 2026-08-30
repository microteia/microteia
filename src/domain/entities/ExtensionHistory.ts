import type { MarketplacePlugin } from './MarketplacePlugin';
import type { InstalledExtensionSource } from './InstalledExtension';

/**
 * Uma versão que este escritório JÁ APLICOU de uma extensão. É a entrada do histórico — o que a tela
 * lista para quem quer voltar atrás.
 *
 * A identidade é a `revision` (o conteúdo do pacote), nunca a versão declarada: uma extensão do
 * catálogo embutido troca de código com a versão parada durante o desenvolvimento — é o que
 * `builtinUpdateOf` já detecta para oferecer "Atualizar" —, e uma privada é editada em cima da mesma
 * versão. Presa à versão, a segunda aplicação sobrescreveria a primeira e o histórico passaria a
 * mentir sobre o que foi aplicado.
 */
export interface ExtensionHistoryEntry {
  revision: string;
  version: string;
  source: InstalledExtensionSource;
  appliedAt: Date;
  appliedBy: string;
  appliedByName: string;
}

/**
 * O histórico de uma extensão NESTE escritório, em `tenants/{tenantId}/extension_history/{pluginId}`.
 *
 * Só os metadados moram aqui, e é essa divisão que torna o histórico assinável: são dez entradas de
 * poucos bytes, contra dez pacotes que podem somar megabytes. O pacote de cada entrada fica na
 * subcoleção `versions/{revision}` e só é lido quando alguém escolhe voltar àquela versão.
 *
 * Coleção própria, e não um campo da cópia instalada, pela mesma razão de `extension_migrations`: o
 * documento da instalação é reescrito INTEIRO a cada aplicação, e o histórico precisa sobreviver à
 * DESINSTALAÇÃO — é ela que torna possível reaplicar a última versão que o escritório tinha.
 */
export interface ExtensionHistory {
  pluginId: string;
  tenantId: string;
  /** Mais recente primeiro. */
  entries: ExtensionHistoryEntry[];
}

/**
 * O pacote guardado por uma entrada — exatamente o que `install` precisa para reaplicá-lo, atribuição
 * de autoria inclusa. Voltar a uma versão é a MESMA instalação de sempre, só que a partir daqui: sem
 * a atribuição, a cópia restaurada perderia o autor original e o gesto de Baixar junto com ele.
 */
export interface ExtensionHistoryVersion {
  revision: string;
  package: MarketplacePlugin;
  source: InstalledExtensionSource;
  version: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
}
