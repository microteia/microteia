import type { PublicExtension, PublicExtensionStatus } from '../entities/PublicExtension';

export interface PublishExtensionOptions {
  /** Quem publica viu as extensões do catálogo que esta versão deixa fora da faixa, e concordou. */
  acceptDependentRanges?: boolean;
}

/** `publish` levou uma versão nova ao catálogo; `prove` só comprovou a que já estava lá. */
export interface PublishExtensionOutcome {
  kind: 'publish' | 'prove';
  version: string;
}

/**
 * Catálogo global `public_extensions`. Publicar não é escrita do navegador: é a callable
 * `publishExtension`, que lê a cópia INSTALADA no escritório e a publica só quando ela está completa.
 * O navegador ainda modera (`setStatus`, `delete`), e só o SYSTEM — as Rules cobram.
 */
export interface IPublicExtensionRepository {
  subscribe(onChange: (items: PublicExtension[]) => void): () => void;
  publish(tenantId: string, pluginId: string, options?: PublishExtensionOptions): Promise<PublishExtensionOutcome>;
  setStatus(domain: string, status: PublicExtensionStatus): Promise<void>;
  delete(domain: string): Promise<void>;
}
