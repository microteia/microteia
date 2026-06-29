import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

let firestore: Firestore | null = null;

export const initFirebase = (): void => {
  if (!getApps().length) {
    initializeApp();
  }
};

export const getDb = (): Firestore => {
  if (!firestore) {
    firestore = getFirestore();
  }
  return firestore;
};
