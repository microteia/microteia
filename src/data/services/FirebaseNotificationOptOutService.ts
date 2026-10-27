import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { INotificationOptOutService, NotificationOptOutState } from '../../domain/repositories/INotificationRepositories';

interface NotificationOptOutPayload {
  tenantId: string;
  ticket: string;
  op: 'get' | 'opt-out' | 'opt-in';
}

const run = httpsCallable<NotificationOptOutPayload, NotificationOptOutState>(functions, 'notificationOptOut');

export class FirebaseNotificationOptOutService implements INotificationOptOutService {
  async run(tenantId: string, ticket: string, op: 'get' | 'opt-out' | 'opt-in'): Promise<NotificationOptOutState> {
    return (await run({ tenantId, ticket, op })).data;
  }
}
