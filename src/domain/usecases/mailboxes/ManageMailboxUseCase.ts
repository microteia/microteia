import type { IMailboxService, SaveMailboxInput } from '../../repositories/IMailboxService';
import type { MailboxView } from '../../schema/mailbox';
import { mailboxSettingsIssue } from '../../schema/mailbox';
import { LocalizedError } from '../../errors/LocalizedError';

export type ManageMailboxUseCase = {
  list: (tenantId: string) => Promise<MailboxView[]>;
  save: (tenantId: string, input: SaveMailboxInput) => Promise<string>;
  remove: (tenantId: string, id: string) => Promise<void>;
  test: (tenantId: string, id: string) => Promise<void>;
};

export const makeManageMailboxUseCase = (service: IMailboxService): ManageMailboxUseCase => ({
  list: (tenantId) => service.list(tenantId),
  save: async (tenantId, input) => {
    const issue = mailboxSettingsIssue(input.settings);
    if (issue) throw new LocalizedError(issue);
    if (!input.id && !input.password) throw new LocalizedError('@core.automation/mailbox.issue.password');
    return service.save(tenantId, input);
  },
  remove: (tenantId, id) => service.remove(tenantId, id),
  test: (tenantId, id) => service.test(tenantId, id),
});
