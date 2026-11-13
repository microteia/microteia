import type { HttpConnection, HttpConnectionData } from '../schema/httpConnection';

/**
 * As credenciais de integração do escritório. O segredo só ENTRA por aqui (criar, trocar): não há
 * método que o devolva, e as regras do Firestore recusam a leitura de qualquer forma.
 */
export interface IHttpConnectionRepository {
  list(tenantId: string): Promise<HttpConnection[]>;
  /** A lista ao vivo. `onError` recebe a recusa das regras — quem não pode ler não tem lista, e não uma vazia. */
  subscribe(tenantId: string, onChange: (connections: HttpConnection[]) => void, onError: () => void): () => void;
  create(tenantId: string, data: HttpConnectionData, secret: string): Promise<HttpConnection>;
  /** `secret` ausente mantém o segredo gravado. */
  update(tenantId: string, id: string, data: HttpConnectionData, secret?: string): Promise<void>;
  remove(tenantId: string, id: string): Promise<void>;
}
