/**
 * A configuração que o kernel espera encontrar em `window.__MICROTEIA_CONFIG__`.
 *
 * É o CONTRATO entre o Console e o kernel, e está declarado aqui de novo de propósito: o Console
 * precisa poder ser publicado sem o `src/` do kernel junto, então não pode importar de lá. Para que
 * as duas pontas não se separem em silêncio, `runtimeConfigShape.test.ts` confere esta lista contra
 * `REQUIRED_CONFIG_KEYS` de `src/infrastructure/firebase/runtimeConfig.ts`.
 */
export interface MicroteiaRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  functionsRegion?: string;
}

export const REQUIRED_CONFIG_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

export const OPTIONAL_CONFIG_KEYS = ['measurementId'] as const;

/**
 * Monta a configuração a partir do que o `firebase apps:sdkconfig` devolveu, recusando-se a seguir
 * com campo faltando: uma instalação carimbada pela metade só falha quando alguém abre a aplicação.
 */
export const runtimeConfigFrom = (
  sdkConfig: Record<string, string>,
  functionsRegion: string,
): MicroteiaRuntimeConfig => {
  const missing = REQUIRED_CONFIG_KEYS.filter((key) => (sdkConfig[key] ?? '') === '');

  if (missing.length > 0) {
    throw new Error(
      `The Firebase web app configuration is missing: ${missing.join(', ')}.\n`
      + 'Check the web app in the Firebase console, then run "microteia connect" again.',
    );
  }

  const config: MicroteiaRuntimeConfig = {
    apiKey: sdkConfig.apiKey,
    authDomain: sdkConfig.authDomain,
    projectId: sdkConfig.projectId,
    storageBucket: sdkConfig.storageBucket,
    messagingSenderId: sdkConfig.messagingSenderId,
    appId: sdkConfig.appId,
    functionsRegion,
  };

  for (const key of OPTIONAL_CONFIG_KEYS) {
    const value = sdkConfig[key];
    if (value !== undefined && value !== '') config[key] = value;
  }

  return config;
};
