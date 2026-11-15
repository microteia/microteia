import type {
  CatalogSide,
  InstalledCopySide,
  PublicationProof,
} from '../schema/plugin/publicationProof';
import type { AppliedBackendFingerprint } from '../schema/plugin/backendRequirement';

/** O que a publicação lê do escritório que publica e do projeto, antes de decidir. */
export interface PublicationReading {
  installed: InstalledCopySide | null;
  siblings: ReadonlyMap<string, { source: string }>;
  appliedMigrationIds: ReadonlySet<string>;
  projectBackend: readonly AppliedBackendFingerprint[];
  /** O catálogo SEM esta extensão, e só a parte que a régua lê — nunca os pacotes inteiros. */
  catalog: readonly CatalogSide[];
}

/** A entrada atual do catálogo sob o domínio, lida DENTRO da transação. */
export interface CatalogEntry {
  ownerTenantId: string;
  version: string;
  status: string;
  package: unknown;
  proof: PublicationProof | null;
}

export interface CatalogEntryWrite {
  package: InstalledCopySide['package'];
  ownerTenantId: string;
  ownerName: string;
  ownerPhotoURL: string | null;
  version: string;
  hasCode: boolean;
  publishedBy: string;
  proof: PublicationProof;
}

/** `publish` grava a entrada inteira; `prove` só acrescenta a prova a uma entrada que não mudou. */
export type PublicationWrite =
  | { kind: 'publish'; entry: CatalogEntryWrite }
  | { kind: 'prove'; proof: PublicationProof };

/**
 * A ÚNICA porta de escrita de `public_extensions`. As Rules recusam a escrita do cliente, e é isso que
 * faz da prova uma garantia: ninguém afirma ter instalado — o servidor lê a cópia instalada e publica
 * exatamente ela.
 */
export interface IExtensionPublicationRepository {
  read(tenantId: string, pluginId: string): Promise<PublicationReading>;
  /**
   * Lê a entrada atual numa transação, entrega-a a `decide` e grava o que ele devolver. `decide` é pura
   * e pode rodar mais de uma vez (a transação se repete sob concorrência); recusa é exceção dela.
   */
  commit(pluginId: string, decide: (current: CatalogEntry | null) => PublicationWrite): Promise<PublicationWrite>;
}
