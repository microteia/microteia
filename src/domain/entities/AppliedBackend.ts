/**
 * O que o PROJETO Firebase tem aplicado de backend de extensão, por fingerprint.
 *
 * O carimbo de cada cópia (`InstalledExtension.backendState`) só é gravado nas cópias que existem
 * quando o Microteia Console roda. A cópia que chega depois — outro escritório atualizando para a
 * versão que o projeto já roda — ficava pendente até alguém rodar o `provision` de novo, que não
 * decidia nada: só copiava o registro. Este documento é esse registro, uma vez por projeto.
 *
 * Escrito só pelo Console, a cada `provision`, com credencial de administrador; o cliente lê e nunca
 * escreve. Não carrega dado de escritório: só id de extensão e o que ela exige do projeto.
 */
export interface AppliedBackendEntry {
  pluginId: string;
  /** O `backendFingerprint` que o projeto roda para esta extensão. */
  fingerprint: string;
  approvedHash: string | null;
  approvedBy: string | null;
}

export interface AppliedBackend {
  /** Quando o Console gravou, ou `null` quando a data não veio. */
  writtenAt: Date | null;
  consoleVersion: string;
  extensions: AppliedBackendEntry[];
}
