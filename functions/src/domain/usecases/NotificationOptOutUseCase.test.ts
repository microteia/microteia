import { describe, expect, it, vi } from 'vitest';
import { makeNotificationOptOutUseCase } from './NotificationOptOutUseCase';
import type { ContactState, INotificationContactLog } from '../repositories/INotificationDelivery';
import { DomainError } from '../errors/DomainError';

const TICKET = 'tk_abcdefghijklmnopqrstuvwx';

const setup = (stored: ContactState | null) => {
  let current = stored;
  const changes: boolean[] = [];
  const contacts: INotificationContactLog = {
    status: async () => [],
    touch: async () => undefined,
    find: async (_tenantId, ticket) => (current && current.ticket === ticket ? { ...current } : null),
    setOptedOut: async (_tenantId, _ticket, optedOut) => {
      changes.push(optedOut);
      if (current) current = { ...current, optedOut };
    },
  };
  const audit = vi.fn(async () => undefined);
  const uc = makeNotificationOptOutUseCase({
    contacts,
    audit: { execute: audit },
    tenantName: async () => 'Prefeitura',
    now: () => new Date('2026-10-26T12:00:00Z'),
  });
  return { uc, audit, changes };
};

const stored: ContactState = { channel: 'email', address: 'fiscal@empresa.com.br', ticket: TICKET, optedOut: false };

describe('NotificationOptOutUseCase', () => {
  it('abrir a página só consulta — o filtro de e-mail que abre o link não descadastra ninguém', async () => {
    const { uc, changes, audit } = setup(stored);
    const state = await uc.execute({ tenantId: 't1', ticket: TICKET, op: 'get' });
    expect(state).toEqual({ tenant: 'Prefeitura', channel: 'email', address: 'f***@empresa.com.br', optedOut: false });
    expect(changes).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it('descadastra, registra na Auditoria com o endereço inteiro, e desfaz', async () => {
    const { uc, changes, audit } = setup(stored);
    expect((await uc.execute({ tenantId: 't1', ticket: TICKET, op: 'opt-out' })).optedOut).toBe(true);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      title: '@core.automation/notifications.contacts.audit.email.unsubscribed',
      titleParams: { address: 'fiscal@empresa.com.br' },
      entityId: TICKET,
    }));
    expect((await uc.execute({ tenantId: 't1', ticket: TICKET, op: 'opt-in' })).optedOut).toBe(false);
    expect(changes).toEqual([true, false]);
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({
      title: '@core.automation/notifications.contacts.audit.email.resubscribed',
    }));
  });

  it('repetir a decisão não grava nem audita de novo', async () => {
    const { uc, changes, audit } = setup({ ...stored, optedOut: true });
    await uc.execute({ tenantId: 't1', ticket: TICKET, op: 'opt-out' });
    expect(changes).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it('bilhete que nunca foi enviado não existe — e um bilhete malformado nem é procurado', async () => {
    const { uc } = setup(stored);
    await expect(uc.execute({ tenantId: 't1', ticket: 'tk_zzzzzzzzzzzzzzzzzzzzzzzz', op: 'opt-out' }))
      .rejects.toMatchObject({ code: 'not-found' });
    await expect(uc.execute({ tenantId: 't1', ticket: '../x', op: 'get' })).rejects.toBeInstanceOf(DomainError);
    await expect(uc.execute({ tenantId: 'a/b', ticket: TICKET, op: 'get' })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('operação desconhecida é recusada', async () => {
    const { uc } = setup(stored);
    await expect(uc.execute({ tenantId: 't1', ticket: TICKET, op: 'delete' as never })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});
