import { describe, it, expect, beforeEach } from 'vitest';
import { makeCreateOrUpdatePushUseCase, type CreateOrUpdatePushInput } from './CreateOrUpdatePushUseCase';
import type { IPushRepository } from '../repositories/IPushRepository';
import type { Push } from '../entities/Push';

class FakePushRepository implements IPushRepository {
  pushes: Push[] = [];
  private seq = 0;

  async create(tenantId: string, push: Omit<Push, 'id' | 'tenantId' | 'createdAt'>): Promise<Push> {
    const created: Push = { id: `id${++this.seq}`, tenantId, createdAt: new Date(), ...push };
    this.pushes.push(created);
    return created;
  }

  async getByEmailId(): Promise<Push | null> {
    return null;
  }

  async getByEmailIdAndProcessNumber(_tenantId: string, emailId: string, processNumber: string): Promise<Push[]> {
    return this.pushes.filter((p) => p.emailId === emailId && (p.processNumber ?? '') === processNumber);
  }

  async update(_tenantId: string, pushId: string, updates: Partial<Push>): Promise<void> {
    const target = this.pushes.find((p) => p.id === pushId);
    if (target) Object.assign(target, updates);
  }
}

const PROCESS = '0174338-61.2025.8.05.0001';

function makeInput(overrides: Partial<CreateOrUpdatePushInput>): CreateOrUpdatePushInput {
  return {
    emailId: 'EMAIL_1',
    from: 'oabba@recortedigital.adv.br',
    to: 'user@gmail.com',
    subject: 'Public.',
    receivedAt: new Date('2026-07-10T00:00:00Z'),
    processNumber: PROCESS,
    status: 'pending',
    parsedByAI: false,
    createdBy: 'system',
    ...overrides,
  };
}

describe('CreateOrUpdatePushUseCase — deduplicação por intimação', () => {
  let repo: FakePushRepository;
  let uc: ReturnType<typeof makeCreateOrUpdatePushUseCase>;

  beforeEach(() => {
    repo = new FakePushRepository();
    uc = makeCreateOrUpdatePushUseCase(repo);
  });

  it('cria um push por intimação mesmo com o MESMO número de processo (URLs distintas)', async () => {
    const urls = ['hash=27C98252', 'hash=27C98248', 'hash=27C8C862', 'hash=27C8C86C'];
    for (const url of urls) {
      const r = await uc.execute('t1', makeInput({ movements: [{ date: new Date(), type: 'Intimação', documentUrl: url }] }));
      expect(r.wasUpdated).toBe(false);
    }
    expect(repo.pushes).toHaveLength(4);
  });

  it('é idempotente: reprocessar o mesmo e-mail não duplica pushes', async () => {
    const inputs = [1, 2, 3, 4].map((n) => makeInput({ movements: [{ date: new Date(), type: 'Intimação', documentUrl: `hash=${n}` }] }));
    for (const input of inputs) await uc.execute('t1', input);
    for (const input of inputs) await uc.execute('t1', input);
    expect(repo.pushes).toHaveLength(4);
  });

  it('distingue intimações sem URL pela composição de campos (polo/assunto/data)', async () => {
    const base = { movements: [{ date: new Date('2026-07-08T00:00:00Z'), type: 'Intimação' }] };
    await uc.execute('t1', makeInput({ ...base, activeParty: 'ANA CAROLINA TABAJARA DOS SANTOS' }));
    await uc.execute('t1', makeInput({ ...base, activeParty: 'ALEXNALDO CARVALHO DOS SANTOS' }));
    expect(repo.pushes).toHaveLength(2);
  });

  it('reprocessa um push com falha (fault) atualizando em vez de duplicar', async () => {
    const movement = [{ date: new Date(), type: 'Intimação', documentUrl: 'hash=1' }];
    await uc.execute('t1', makeInput({ status: 'fault', movements: movement }));
    expect(repo.pushes[0].status).toBe('fault');

    const r = await uc.execute('t1', makeInput({ status: 'pending', movements: movement, activeParty: 'FULANO' }));
    expect(r.wasUpdated).toBe(true);
    expect(repo.pushes).toHaveLength(1);
    expect(repo.pushes[0].status).toBe('pending');
    expect(repo.pushes[0].activeParty).toBe('FULANO');
  });
});
