import type { HttpRequestSpec, HttpTestResult } from '../schema/httpRequestSpec';

/**
 * O "Testar chamada" do editor do passo HTTP. A chamada sai do SERVIDOR, nunca do navegador: é lá que
 * moram a lista de domínios, a credencial e a proteção contra endereço interno — um teste feito pelo
 * navegador provaria outra coisa, e esbarraria no CORS da API de fora.
 */
export interface IHttpRequestTester {
  test(tenantId: string, request: HttpRequestSpec): Promise<HttpTestResult>;
}
