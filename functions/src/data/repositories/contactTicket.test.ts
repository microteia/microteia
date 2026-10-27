import { describe, expect, it } from 'vitest';
import { contactTicketOf } from './FirestoreNotificationRepositories';
import { isOptOutTicket } from '../../domain/schema/notificationContacts';

const key = Buffer.alloc(32, 7);

describe('contactTicketOf', () => {
  it('o mesmo endereço dá o mesmo bilhete — é o que reencontra o descadastro no envio seguinte', () => {
    const ticket = contactTicketOf(key, 't1', { channel: 'email', address: 'a@x.com' });
    expect(contactTicketOf(key, 't1', { channel: 'email', address: 'a@x.com' })).toBe(ticket);
    expect(isOptOutTicket(ticket)).toBe(true);
  });

  it('outro escritório, outro canal ou outra chave dão outro bilhete', () => {
    const ticket = contactTicketOf(key, 't1', { channel: 'email', address: 'a@x.com' });
    expect(contactTicketOf(key, 't2', { channel: 'email', address: 'a@x.com' })).not.toBe(ticket);
    expect(contactTicketOf(key, 't1', { channel: 'sms', address: 'a@x.com' })).not.toBe(ticket);
    expect(contactTicketOf(Buffer.alloc(32, 8), 't1', { channel: 'email', address: 'a@x.com' })).not.toBe(ticket);
  });
});
