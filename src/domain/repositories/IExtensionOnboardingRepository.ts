import type { DefaultExtensionsOnboarding } from '../schema/plugin/defaultExtensions';

/**
 * A lista de extensões padrão que o escritório novo ainda tem a instalar
 * (`tenants/{id}/extension_onboarding/defaults`). O servidor a cria na criação do escritório; o
 * navegador de quem instala só tira dela o que concluiu.
 */
export interface IExtensionOnboardingRepository {
  /** `null` quando o escritório não tem lista — o caso de quase todos. */
  subscribe(
    tenantId: string,
    onChange: (onboarding: DefaultExtensionsOnboarding | null) => void,
    onError: (error: Error) => void,
  ): () => void;
  /**
   * Tira a extensão da fila. `deferred` é a que não foi instalada — falhou e quem instalava seguiu
   * sem ela, ou saiu do catálogo depois de o escritório nascer — e fica registrada em `failed`.
   */
  settle(tenantId: string, pluginId: string, outcome: 'installed' | 'deferred'): Promise<void>;
}
