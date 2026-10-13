import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { INotificationEmailService } from '../../domain/repositories/INotificationRepositories';
import type { NotificationEmailSettings, NotificationEmailSettingsView } from '../../domain/schema/notifications';

interface ManageNotificationEmailPayload {
  tenantId: string;
  op: 'get' | 'save' | 'clear' | 'test';
  settings?: NotificationEmailSettings;
  password?: string;
}

type ManageNotificationEmailResult = NotificationEmailSettingsView | { sentTo: string };

const manage = httpsCallable<ManageNotificationEmailPayload, ManageNotificationEmailResult>(
  functions,
  'manageNotificationEmail',
);

const viewOf = (result: ManageNotificationEmailResult): NotificationEmailSettingsView =>
  result as NotificationEmailSettingsView;

export class FirebaseNotificationEmailService implements INotificationEmailService {
  async get(tenantId: string): Promise<NotificationEmailSettingsView> {
    return viewOf((await manage({ tenantId, op: 'get' })).data);
  }

  async save(tenantId: string, settings: NotificationEmailSettings, password: string): Promise<NotificationEmailSettingsView> {
    return viewOf((await manage({ tenantId, op: 'save', settings, ...(password ? { password } : {}) })).data);
  }

  async clear(tenantId: string): Promise<NotificationEmailSettingsView> {
    return viewOf((await manage({ tenantId, op: 'clear' })).data);
  }

  async sendTest(tenantId: string): Promise<string> {
    const result = (await manage({ tenantId, op: 'test' })).data as { sentTo: string };
    return result.sentTo;
  }
}
