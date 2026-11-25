import { describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

const asked: string[] = [];
vi.mock('./shared/requirePermission', () => ({
  requirePermission: async (_tenantId: string, _auth: unknown, permission: string) => {
    asked.push(permission);
    throw new HttpsError('permission-denied', '@core.access/permission.denied', { permission });
  },
}));
vi.mock('../di/container', () => ({ getDI: () => ({}) }));
vi.mock('../firebase/initFirebase', () => ({ getDb: () => ({}) }));

import { runScript } from './runScript';

type Callable = { run: (request: unknown) => Promise<unknown> };

describe('runScript — a depuração de script', () => {
  it('exige gerenciar automações, e não só executá-las: o código vem do cliente', async () => {
    const call = (runScript as unknown as Callable).run({
      data: { tenantId: 't1', compiledJs: 'return 1;' },
      auth: { uid: 'u1', token: {} },
    });
    await expect(call).rejects.toMatchObject({ code: 'permission-denied' });
    expect(asked).toEqual(['automation.manage']);
  });
});
