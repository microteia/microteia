import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';

let firestore: Firestore | null = null;
let bucket: Bucket | null = null;

export const initFirebase = (): void => {
  if (!getApps().length) {
    initializeApp();
  }
};

export const getDb = (): Firestore => {
  if (!firestore) {
    firestore = getFirestore();
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
};

export const getBucket = (): Bucket => {
  if (!bucket) {
    bucket = getStorage().bucket();
  }
  return bucket;
};
