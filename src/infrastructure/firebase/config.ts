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

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

// Falha na hora se o arquivo do ambiente estiver incompleto. Sem isto, o Firebase inicializa
// pela metade e o erro só aparece na primeira consulta — ou, pior, num projeto que não é o
// pretendido. Por isso também não existe um `.env` comum servindo de fallback entre dev e prod.
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(
    // Diagnóstico de BOOT, para quem instala o sistema: não há catálogo carregado neste ponto.
    // eslint-disable-next-line no-restricted-syntax -- ver acima
    `Configuração do Firebase incompleta (${missingKeys.join(', ')}). ` +
    `Verifique o arquivo .env.${import.meta.env.MODE} na raiz do projeto — veja .env.example.`,
  );
}

const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const analytics: Analytics = getAnalytics(app);
export const functions: Functions = getFunctions(app, 'southamerica-east1');

// if (import.meta.env.DEV) {
//   connectFunctionsEmulator(functions, '127.0.0.1', 5001);
// }

export default app;
