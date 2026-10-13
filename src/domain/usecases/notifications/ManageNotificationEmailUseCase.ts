import type { INotificationEmailService } from '../../repositories/INotificationRepositories';
import type { NotificationEmailSettings, NotificationEmailSettingsView } from '../../schema/notifications';
import { notificationEmailSettingsIssue } from '../../schema/notifications';
import { LocalizedError } from '../../errors/LocalizedError';

export type ManageNotificationEmailUseCase = {
  get: (tenantId: string) => Promise<NotificationEmailSettingsView>;
  save: (tenantId: string, settings: NotificationEmailSettings, password: string) => Promise<NotificationEmailSettingsView>;
  clear: (tenantId: string) => Promise<NotificationEmailSettingsView>;
  sendTest: (tenantId: string) => Promise<string>;
};

export const makeManageNotificationEmailUseCase = (
  service: INotificationEmailService,
): ManageNotificationEmailUseCase => ({
  get: (tenantId) => service.get(tenantId),
  save: async (tenantId, settings, password) => {
    const issue = notificationEmailSettingsIssue(settings);
    if (issue) throw new LocalizedError(issue);
    return service.save(tenantId, settings, password);
  },
  clear: (tenantId) => service.clear(tenantId),
  sendTest: (tenantId) => service.sendTest(tenantId),
});
