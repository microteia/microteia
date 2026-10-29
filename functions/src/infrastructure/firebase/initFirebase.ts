import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';

let firestore: Firestore | null = null;
let bucket: Bucket | null = null;

/**
 * Configura o Firestore no cold start, antes de qualquer handler correr. O `getFirestore()` do Admin SDK
 * devolve UMA instância por app, e o `settings()` só pega antes do primeiro uso dela: configurada aqui,
 * qualquer leitura — de quem for, na ordem que for — já encontra a instância pronta. Deixar para o
 * primeiro `getDb()` fazia o resultado depender de qual repositório abria o banco primeiro.
 */
export const initFirebase = (): void => {
  if (!getApps().length) {
    initializeApp();
  }
  getDb();
};

/**
 * A instância é guardada só DEPOIS de configurada. Se alguém a usou antes, o `settings()` recusa, e
 * a recusa sobe: guardá-la sem `ignoreUndefinedProperties` faria a gravação que leva um campo vazio
 * falhar depois, longe da causa — e depois de os efeitos do fluxo já terem sido aplicados.
 */
export const getDb = (): Firestore => {
  if (!firestore) {
    const instance = getFirestore();
    try {
      instance.settings({ ignoreUndefinedProperties: true });
    } catch (cause) {
      throw new Error(
        'Firestore was used before getDb() could configure it. Open the database through getDb(), never getFirestore().',
        { cause },
      );
    }
    firestore = instance;
  }
  return firestore;
};

export const getBucket = (): Bucket => {
  if (!bucket) {
    bucket = getStorage().bucket();
  }
  return bucket;
};
