import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { INotificationSmsService } from '../../domain/repositories/INotificationRepositories';
import type { NotificationSmsSettings, NotificationSmsSettingsView } from '../../domain/schema/notificationContacts';

interface ManageNotificationSmsPayload {
  tenantId: string;
  op: 'get' | 'save' | 'clear' | 'test';
  settings?: NotificationSmsSettings;
  secret?: string;
}

type ManageNotificationSmsResult = NotificationSmsSettingsView | { verified: true };

const manage = httpsCallable<ManageNotificationSmsPayload, ManageNotificationSmsResult>(functions, 'manageNotificationSms');

const viewOf = (result: ManageNotificationSmsResult): NotificationSmsSettingsView => result as NotificationSmsSettingsView;

export class FirebaseNotificationSmsService implements INotificationSmsService {
  async get(tenantId: string): Promise<NotificationSmsSettingsView> {
    return viewOf((await manage({ tenantId, op: 'get' })).data);
  }

  async save(tenantId: string, settings: NotificationSmsSettings, secret: string): Promise<NotificationSmsSettingsView> {
    return viewOf((await manage({ tenantId, op: 'save', settings, ...(secret ? { secret } : {}) })).data);
  }

  async clear(tenantId: string): Promise<NotificationSmsSettingsView> {
    return viewOf((await manage({ tenantId, op: 'clear' })).data);
  }

  async verify(tenantId: string): Promise<void> {
    await manage({ tenantId, op: 'test' });
  }
}
