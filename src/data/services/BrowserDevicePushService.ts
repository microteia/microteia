import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { DevicePushStatus } from '../../domain/entities/InboxNotification';
import type { IDevicePushService } from '../../domain/repositories/INotificationRepositories';
import { PUSH_SUBSCRIPTIONS_COLLECTION } from '../../domain/schema/notifications';

const SERVICE_WORKER_URL = '/notification-sw.js';

const publicKeyCall = httpsCallable<Record<string, never>, { publicKey: string }>(functions, 'getWebPushPublicKey');

const isSupported = (): boolean =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
};

/** O id do documento é o hash do endpoint: o mesmo aparelho inscrito duas vezes é um documento só. */
const subscriptionId = async (endpoint: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const subscriptionRef = async (userId: string, endpoint: string) =>
  doc(db, 'users', userId, PUSH_SUBSCRIPTIONS_COLLECTION, await subscriptionId(endpoint));

const currentSubscription = async (): Promise<PushSubscription | null> => {
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  return registration ? registration.pushManager.getSubscription() : null;
};

/**
 * Push padrão do navegador (Push API + service worker), sem Firebase Cloud Messaging — a chave é da
 * instalação, sorteada pelo servidor, e não exige configuração nenhuma no bundle.
 *
 * "Ativado" quer dizer que ESTE navegador tem inscrição E que ela está gravada para a pessoa: só a
 * metade do navegador não chega a ninguém, porque é a gravação que diz ao servidor para onde enviar.
 */
export class BrowserDevicePushService implements IDevicePushService {
  async status(userId: string): Promise<DevicePushStatus> {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const subscription = await currentSubscription();
    if (!subscription) return 'available';
    const stored = await getDoc(await subscriptionRef(userId, subscription.endpoint));
    return stored.exists() ? 'enabled' : 'available';
  }

  async enable(userId: string): Promise<DevicePushStatus> {
    if (!isSupported()) return 'unsupported';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'available';

    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    await navigator.serviceWorker.ready;
    const { publicKey } = (await publicKeyCall({})).data;
    const subscription = (await registration.pushManager.getSubscription())
      ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      });

    const json = subscription.toJSON();
    await setDoc(await subscriptionRef(userId, subscription.endpoint), {
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
      userAgent: navigator.userAgent.slice(0, 300),
      createdAt: serverTimestamp(),
    });
    return 'enabled';
  }

  async disable(userId: string): Promise<DevicePushStatus> {
    if (!isSupported()) return 'unsupported';
    const subscription = await currentSubscription();
    if (subscription) {
      await deleteDoc(await subscriptionRef(userId, subscription.endpoint));
      await subscription.unsubscribe();
    }
    return 'available';
  }
}
