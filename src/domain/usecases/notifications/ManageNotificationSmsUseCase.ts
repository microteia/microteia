import type { INotificationSmsService } from '../../repositories/INotificationRepositories';
import type { NotificationSmsSettings, NotificationSmsSettingsView } from '../../schema/notificationContacts';
import { notificationSmsSettingsIssue } from '../../schema/notificationContacts';
import { LocalizedError } from '../../errors/LocalizedError';

export type ManageNotificationSmsUseCase = {
  get: (tenantId: string) => Promise<NotificationSmsSettingsView>;
  save: (tenantId: string, settings: NotificationSmsSettings, secret: string) => Promise<NotificationSmsSettingsView>;
  clear: (tenantId: string) => Promise<NotificationSmsSettingsView>;
  verify: (tenantId: string) => Promise<void>;
};

export const makeManageNotificationSmsUseCase = (service: INotificationSmsService): ManageNotificationSmsUseCase => ({
  get: (tenantId) => service.get(tenantId),
  save: async (tenantId, settings, secret) => {
    const issue = notificationSmsSettingsIssue(settings);
    if (issue) throw new LocalizedError(issue);
    return service.save(tenantId, settings, secret);
  },
  clear: (tenantId) => service.clear(tenantId),
  verify: (tenantId) => service.verify(tenantId),
});
