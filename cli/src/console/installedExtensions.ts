import { decodeFields, documentId, listDocuments } from './firestoreRest.js';

/**
 * O CAMINHO ÚNICO até o que um escritório instalou.
 *
 * Estava dentro do `provision`, e é dele que a leitura nasceu: para saber quais Cloud Functions subir,
 * o comando precisa do `manifest.backend` de cada extensão instalada. O `export-catalog` faz a mesma
 * pergunta com outro propósito, e um segundo caminho até o mesmo documento seria uma segunda chance de
 * discordar — a forma do documento, o que conta como instalada, o que fazer com a desativada.
 *
 * Então o caminho é este, e o `provision` também passa por aqui.
 */

/** Um escritório do projeto. O `name` existe para que escolher um `--tenant` não seja adivinhar um id. */
export interface TenantSummary {
  id: string;
  name: string;
}

export interface InstalledExtensionRecord {
  tenantId: string;
  documentPath: string;
  /** O id do documento, que pode diferir do `manifest.id` — é por ele que a cópia é endereçada. */
  documentId: string;
  id: string;
  name: string;
  version: string;
  /** Desligada no escritório: o pacote continua ali, e nada dele está no ar. */
  active: boolean;
  /** O manifesto cru da cópia instalada — é dele que sai `backend`, e nada aqui o interpreta. */
  manifest: Record<string, unknown> | undefined;
  /** O documento inteiro, decodificado, para quem precisa de mais que o manifesto. */
  data: Record<string, unknown>;
}

export const listTenants = async (projectId: string): Promise<TenantSummary[]> => {
  const documents = await listDocuments(projectId, '/tenants');
  return documents
    .map((document) => {
      const id = documentId(document);
      const data = decodeFields(document.fields);
      return { id, name: typeof data.name === 'string' && data.name !== '' ? data.name : id };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
};

/**
 * As extensões instaladas num escritório.
 *
 * A DESATIVADA vem junto, marcada. Quem decide o que fazer com ela é quem chamou: para o `provision`
 * ela não exige backend nenhum; para o catálogo ela ainda explica de onde veio uma tela que continua
 * gravada no banco.
 */
export const readInstalledExtensions = async (
  projectId: string,
  tenantId: string,
): Promise<InstalledExtensionRecord[]> => {
  const documents = await listDocuments(projectId, `/tenants/${tenantId}/installed_extensions`);

  return documents.map((document) => {
    const data = decodeFields(document.fields);
    const pkg = data.package as Record<string, unknown> | undefined;
    const manifest = pkg?.manifest as Record<string, unknown> | undefined;
    const fallbackId = documentId(document);

    return {
      tenantId,
      documentPath: `/tenants/${tenantId}/installed_extensions/${fallbackId}`,
      documentId: fallbackId,
      id: String(manifest?.id ?? fallbackId),
      name: String(manifest?.name ?? manifest?.id ?? fallbackId),
      version: String(manifest?.version ?? '0.0.0'),
      active: data.active !== false,
      manifest,
      data,
    };
  });
};
