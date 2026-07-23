/**
 * Marcador SERIALIZÁVEL de uma view de código, registrado na `ImplementationRegistry` no lugar do
 * componente. A camada de domínio/stores não pode compilar nem importar React, então guarda apenas
 * a referência (id do plugin, chave da view e a fonte). A camada de apresentação (`useResolvePage`)
 * a reconhece e a avalia sob demanda contra a API do host. É o que mantém o Kernel puro e a
 * hierarquia de camadas intacta: o marcador satisfaz a resolução `impl: code` sem carregar código.
 */
export interface ExtensionViewRef {
  readonly kind: 'extension-view';
  readonly pluginId: string;
  readonly viewKey: string;
  readonly source: string;
}

export const makeExtensionViewRef = (
  pluginId: string,
  viewKey: string,
  source: string,
): ExtensionViewRef => ({ kind: 'extension-view', pluginId, viewKey, source });

export const isExtensionViewRef = (value: unknown): value is ExtensionViewRef =>
  typeof value === 'object' &&
  value !== null &&
  (value as { kind?: unknown }).kind === 'extension-view' &&
  typeof (value as { source?: unknown }).source === 'string';
