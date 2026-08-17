/**
 * A configuração do Firebase que o Runtime precisa para subir.
 *
 * Ela existe como tipo próprio porque tem DUAS origens e uma delas não é conhecida em tempo de
 * build: numa instalação distribuída, o pacote é montado sem saber em que projeto Firebase vai
 * rodar, e quem carimba `/firebase-config.js` é o Console, na máquina de quem instala.
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

declare global {
  interface Window {
    __MICROTEIA_CONFIG__?: Partial<MicroteiaRuntimeConfig>;
  }
}

export const DEFAULT_FUNCTIONS_REGION = 'southamerica-east1';

/**
 * `measurementId` ficou de FORA: Analytics é opcional num projeto do cliente, e exigi-lo derrubaria
 * o boot de quem simplesmente não habilitou o produto. `functionsRegion` também é opcional — tem
 * default, e só quem fugir da região padrão precisa declará-la.
 */
export const REQUIRED_CONFIG_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

/**
 * O `projectId` é o que distingue "carimbado" de "placeholder". Checar apenas a presença do global
 * não serve: o arquivo que viaja no pacote pode declarar um objeto vazio, e um objeto vazio venceria
 * o `.env` sem trazer configuração nenhuma.
 */
export const readStampedConfig = (): Partial<MicroteiaRuntimeConfig> | null => {
  const stamped = typeof window === 'undefined' ? undefined : window.__MICROTEIA_CONFIG__;
  return stamped?.projectId ? stamped : null;
};

export const missingConfigKeys = (config: Partial<MicroteiaRuntimeConfig>): string[] =>
  REQUIRED_CONFIG_KEYS.filter((key) => !config[key]);
