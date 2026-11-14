import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IMailboxService, SaveMailboxInput } from '../../domain/repositories/IMailboxService';
import type { MailboxListing, MailboxSettings } from '../../domain/schema/mailbox';

interface ManageMailboxPayload {
  tenantId: string;
  op: 'list' | 'save' | 'remove' | 'test';
  id?: string;
  scope?: 'own' | 'office';
  settings?: MailboxSettings;
  password?: string;
}

type ManageMailboxResult = MailboxListing | { id: string } | { ok: true };

const manage = httpsCallable<ManageMailboxPayload, ManageMailboxResult>(functions, 'manageMailbox');

export class FirebaseMailboxService implements IMailboxService {
  async list(tenantId: string): Promise<MailboxListing> {
    return (await manage({ tenantId, op: 'list' })).data as MailboxListing;
  }

  async save(tenantId: string, input: SaveMailboxInput): Promise<string> {
    const result = await manage({
      tenantId,
      op: 'save',
      ...(input.id ? { id: input.id } : { scope: input.scope }),
      settings: input.settings,
      ...(input.password ? { password: input.password } : {}),
    });
    return (result.data as { id: string }).id;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await manage({ tenantId, op: 'remove', id });
  }

  async test(tenantId: string, id: string): Promise<void> {
    await manage({ tenantId, op: 'test', id });
  }
}
