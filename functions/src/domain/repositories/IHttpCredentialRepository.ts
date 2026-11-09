import type { HttpConnection } from '../schema/httpConnection';

/**
 * A credencial de integração do escritório, pela CHAVE, com o segredo. Só o servidor chega ao
 * segredo — as regras do Firestore não deixam o navegador lê-lo.
 */
export interface IHttpCredentialRepository {
  /** `null` quando não há credencial com a chave; `secret: null` quando ela existe sem segredo gravado. */
  findByKey(tenantId: string, key: string): Promise<{ connection: HttpConnection; secret: string | null } | null>;
}
