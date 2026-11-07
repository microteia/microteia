import type { InstalledCatalogSources } from '../usecases/plugins/installedCatalogSnapshot';

/**
 * O que o retrato da instalação lê de um escritório, CRU — as quatro coleções de definição, sem
 * passar pelo mapeamento das entidades. Ver `installedCatalogSnapshot.ts` para o porquê do cru.
 *
 * Somente leitura, e com a identidade do MEMBRO: as quatro coleções são `isMember` nas regras, e é isso
 * que deixa quem administra só o escritório tirar o retrato sem papel no projeto Firebase.
 */
export interface InstalledCatalogSourceRead extends InstalledCatalogSources {
  /** O projeto Firebase em que a aplicação roda — o retrato se anuncia com ele. */
  projectId: string;
}

export interface IInstalledCatalogSourceRepository {
  read: (tenantId: string) => Promise<InstalledCatalogSourceRead>;
}
