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
  apiKey: import.meta.env.VITE_CURATINO_API_KEY,
  authDomain: import.meta.env.VITE_CURATINO_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_CURATINO_PROJECT_ID,
  storageBucket: import.meta.env.VITE_CURATINO_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_CURATINO_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_CURATINO_APP_ID,
  measurementId: import.meta.env.VITE_CURATINO_MEASUREMENT_ID,
};

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
