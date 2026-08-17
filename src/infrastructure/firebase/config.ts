import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { getFunctions/*, connectFunctionsEmulator*/ } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import {
  DEFAULT_FUNCTIONS_REGION,
  missingConfigKeys,
  readStampedConfig,
} from './runtimeConfig';
import type { MicroteiaRuntimeConfig } from './runtimeConfig';

// Em desenvolvimento e nos builds com TARGET, o Vite inlina o `.env.<modo>` aqui.
const buildTimeConfig: Partial<MicroteiaRuntimeConfig> = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

// O arquivo carimbado vence o build. A ordem é essa de propósito: o pacote distribuído é compilado
// SEM projeto nenhum, então o `.env` só entra quando ninguém carimbou — o caso de `npm run dev`. Se
// fosse ao contrário, um artefato mal carimbado apontaria para o Firebase de quem empacotou em vez
// do de quem instalou, e faria isso em silêncio.
const stampedConfig = readStampedConfig();
const runtimeConfig = stampedConfig ?? buildTimeConfig;

// Falha na hora se a configuração estiver incompleta. Sem isto, o Firebase inicializa pela metade e
// o erro só aparece na primeira consulta — ou, pior, num projeto que não é o pretendido. Por isso
// também não existe um `.env` comum servindo de fallback entre dev e prod.
const missingKeys = missingConfigKeys(runtimeConfig);

if (missingKeys.length > 0) {
  // Diagnóstico de BOOT, para quem INSTALA o sistema: não há catálogo carregado neste ponto, e o
  // leitor pode não ser quem empacotou. Por isso a frase é em inglês e diz qual das duas origens
  // falhou — carimbo ausente e carimbo incompleto se corrigem em lugares diferentes.
  throw new Error(
    stampedConfig
      ? `Microteia is not configured (missing: ${missingKeys.join(', ')}). `
        + 'The firebase-config.js file at the site root was stamped incompletely. Run the installer again.'
      : `Microteia is not configured (missing: ${missingKeys.join(', ')}). `
        + `No firebase-config.js was stamped, and .env.${import.meta.env.MODE} is incomplete — see .env.example.`,
  );
}

const app: FirebaseApp = initializeApp({
  apiKey: runtimeConfig.apiKey,
  authDomain: runtimeConfig.authDomain,
  projectId: runtimeConfig.projectId,
  storageBucket: runtimeConfig.storageBucket,
  messagingSenderId: runtimeConfig.messagingSenderId,
  appId: runtimeConfig.appId,
  measurementId: runtimeConfig.measurementId,
});

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Nulo quando o projeto não tem Analytics: `getAnalytics` quebra sem `measurementId`, e derrubar o
// boot inteiro por um produto opcional impediria a instalação em qualquer projeto que não o use.
export const analytics: Analytics | null = runtimeConfig.measurementId ? getAnalytics(app) : null;

export const functions: Functions = getFunctions(
  app,
  runtimeConfig.functionsRegion ?? DEFAULT_FUNCTIONS_REGION,
);

// if (import.meta.env.DEV) {
//   connectFunctionsEmulator(functions, '127.0.0.1', 5001);
// }

export default app;
